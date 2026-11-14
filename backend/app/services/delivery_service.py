import json
import hmac
import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.event import Event, EventStatus
from app.models.endpoint import Endpoint
from app.models.delivery_attempt import DeliveryAttempt


def generate_hmac_signature(secret: str, payload_str: str) -> str:
    """Compute HMAC-SHA256 hex digest for webhook payload integrity."""
    return hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_str.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()


def calculate_backoff_delay(attempt_number: int, base_seconds: int = None) -> int:
    """
    Calculate exponential backoff delay in seconds.
    Formula: base * 2^(attempt - 1)
    e.g. base 5: attempt 1 -> 5s, attempt 2 -> 10s, attempt 3 -> 20s
    """
    base = base_seconds or settings.RETRY_BACKOFF_BASE_SECONDS
    return int(base * (2 ** max(0, attempt_number - 1)))


def deliver_webhook_sync(
    db: Session,
    event_db_id: int,
    is_manual_retry: bool = False
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Executes a single webhook delivery attempt for an event.
    Records delivery attempt logs and updates event status.
    
    Returns:
        (success: bool, response_status: Optional[int], error_message: Optional[str])
    """
    event = db.query(Event).filter(Event.id == event_db_id).first()
    if not event:
        return False, None, "Event not found"

    endpoint = db.query(Endpoint).filter(Endpoint.id == event.endpoint_id).first()
    if not endpoint:
        event.status = EventStatus.FAILED.value
        db.commit()
        return False, None, "Associated destination endpoint not found"

    if not endpoint.is_active:
        event.status = EventStatus.FAILED.value
        db.commit()
        return False, None, "Destination endpoint is currently disabled"

    # Increment attempt count
    event.attempt_count += 1
    current_attempt = event.attempt_count
    event.status = EventStatus.PROCESSING.value
    event.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Prepare payload and headers
    payload_dict = event.payload or {}
    payload_json = json.dumps(payload_dict)
    
    timestamp_str = datetime.now(timezone.utc).isoformat()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "HookFlow-Webhook-Delivery/1.0",
        "X-HookFlow-Event-Id": event.event_id,
        "X-HookFlow-Event-Type": event.event_type,
        "X-HookFlow-Endpoint-Id": str(event.endpoint_id),
        "X-HookFlow-Delivery-Attempt": str(current_attempt),
        "X-HookFlow-Timestamp": timestamp_str,
    }

    # If endpoint or system has secret token, add HMAC signature
    signing_secret = endpoint.secret_token or settings.WEBHOOK_SECRET_KEY
    if signing_secret:
        sig = generate_hmac_signature(signing_secret, payload_json)
        headers["X-HookFlow-Signature"] = f"sha256={sig}"

    # Execute HTTP POST request
    start_time = time.perf_counter()
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    success: bool = False
    retryable: bool = False

    try:
        with httpx.Client(timeout=float(settings.WEBHOOK_TIMEOUT_SECONDS)) as client:
            resp = client.post(
                url=endpoint.url,
                content=payload_json,
                headers=headers
            )
            response_status = resp.status_code
            response_body = resp.text[:2000] if resp.text else ""
            response_headers = dict(resp.headers)
            
            # Consider 2xx HTTP response codes as successful delivery
            if 200 <= resp.status_code < 300:
                success = True
            else:
                error_message = f"HTTP {resp.status_code}: {resp.reason_phrase}"
                retryable = (
                    resp.status_code in {408, 429} or resp.status_code >= 500
                )
    except httpx.TimeoutException as exc:
        error_message = f"Delivery timed out after {settings.WEBHOOK_TIMEOUT_SECONDS}s: {str(exc)}"
        retryable = True
    except httpx.ConnectError as exc:
        error_message = f"Connection failed to {endpoint.url}: {str(exc)}"
        retryable = True
    except httpx.RequestError as exc:
        error_message = f"Network/Request error: {str(exc)}"
        retryable = True
    except httpx.InvalidURL as exc:
        error_message = f"Invalid destination URL: {exc}"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Record delivery attempt
    attempt_record = DeliveryAttempt(
        event_id=event.id,
        attempt_number=current_attempt,
        response_status=response_status,
        response_body=response_body,
        response_headers=response_headers,
        error_message=error_message,
        execution_time_ms=elapsed_ms,
        success=success,
        attempted_at=datetime.now(timezone.utc),
    )
    db.add(attempt_record)

    # Update event status
    if success:
        event.status = EventStatus.DELIVERED.value
        event.next_retry_at = None
    else:
        if not retryable or current_attempt >= event.max_retries:
            event.status = EventStatus.FAILED.value
            event.next_retry_at = None
        else:
            event.status = EventStatus.PENDING.value
            delay_seconds = calculate_backoff_delay(current_attempt)
            event.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)

    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)

    return success, response_status, error_message
