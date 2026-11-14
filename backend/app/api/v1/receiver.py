import asyncio
import hmac
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Literal
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.endpoint import Endpoint
from app.services.delivery_service import generate_hmac_signature

router = APIRouter()


class ReceiverConfig(BaseModel):
    simulate_failure: bool = False
    failure_status_code: int = Field(default=500, ge=400, le=599)
    simulated_delay_seconds: float = Field(default=0.0, ge=0, le=3)
    failure_mode: Literal["always", "fail_first_2", "timeout"] = "always"


# In-memory storage for simulated receiver
_receiver_config = ReceiverConfig()
_received_webhooks: List[Dict[str, Any]] = []
_event_attempt_tracker: Dict[str, int] = {}


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Simulated external destination receiver endpoint.
    Accepts incoming webhooks, validates signatures, captures headers/payload,
    and returns responses according to active simulation config.
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8") if raw_body else "{}"
    
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw": body_str}

    headers_dict = dict(request.headers)
    event_id = headers_dict.get("x-hookflow-event-id", "unknown")
    event_type = headers_dict.get("x-hookflow-event-type", "unknown")
    attempt_num = int(headers_dict.get("x-hookflow-delivery-attempt", "1"))
    signature = headers_dict.get("x-hookflow-signature", "")
    endpoint_id_header = headers_dict.get("x-hookflow-endpoint-id")

    # Validate HMAC signature if provided
    signature_valid = None
    if signature:
        signing_secret = settings.WEBHOOK_SECRET_KEY
        if endpoint_id_header:
            try:
                endpoint = db.get(Endpoint, int(endpoint_id_header))
            except ValueError:
                endpoint = None
            if endpoint is None:
                signature_valid = False
            else:
                signing_secret = endpoint.secret_token or settings.WEBHOOK_SECRET_KEY
        if signature_valid is None and signature.startswith("sha256="):
            expected_hash = generate_hmac_signature(signing_secret, body_str)
            provided_hash = signature.removeprefix("sha256=")
            signature_valid = hmac.compare_digest(expected_hash, provided_hash)
        elif signature_valid is None:
            signature_valid = False

    # Apply simulated delay if configured
    if _receiver_config.simulated_delay_seconds > 0:
        await asyncio.sleep(_receiver_config.simulated_delay_seconds)

    # Track attempts for fail_first_2 simulation
    _event_attempt_tracker[event_id] = _event_attempt_tracker.get(event_id, 0) + 1
    current_attempt_for_event = _event_attempt_tracker[event_id]

    status_code = 200
    status_notes = "Delivered successfully"

    if _receiver_config.simulate_failure:
        if _receiver_config.failure_mode == "always":
            status_code = _receiver_config.failure_status_code
            status_notes = f"Simulated failure: HTTP {status_code}"
        elif _receiver_config.failure_mode == "fail_first_2":
            if current_attempt_for_event <= 2:
                status_code = _receiver_config.failure_status_code
                status_notes = f"Simulated transient failure on attempt {current_attempt_for_event} (HTTP {status_code})"
            else:
                status_code = 200
                status_notes = f"Succeeded on attempt {current_attempt_for_event} after previous retries!"
        elif _receiver_config.failure_mode == "timeout":
            # Sleep longer than timeout
            await asyncio.sleep(settings.WEBHOOK_TIMEOUT_SECONDS + 2)
            status_code = 504
            status_notes = "Simulated gateway timeout"

    log_entry = {
        "id": f"rec_{uuid.uuid4().hex[:8]}",
        "event_id": event_id,
        "event_type": event_type,
        "attempt_number": attempt_num,
        "headers": headers_dict,
        "payload": payload,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "response_status": status_code,
        "signature_valid": signature_valid,
        "notes": status_notes,
    }

    _received_webhooks.insert(0, log_entry)
    if len(_received_webhooks) > 100:
        _received_webhooks.pop()

    response.status_code = status_code
    return {
        "status": "success" if 200 <= status_code < 300 else "error",
        "received_at": log_entry["received_at"],
        "event_id": event_id,
        "event_type": event_type,
        "attempt_number": attempt_num,
        "signature_valid": signature_valid,
        "notes": status_notes,
    }


@router.get("/config", response_model=ReceiverConfig)
def get_receiver_config():
    """Get active receiver simulation configuration."""
    return _receiver_config


@router.post("/config", response_model=ReceiverConfig)
def update_receiver_config(config: ReceiverConfig):
    """Update receiver simulation parameters (simulate failure, error code, delays)."""
    global _receiver_config
    _receiver_config = config
    return _receiver_config


@router.get("/logs")
def list_received_logs(limit: int = 50):
    """List webhooks received by the simulated external receiver."""
    return _received_webhooks[:limit]


@router.delete("/logs")
def clear_received_logs():
    """Clear received webhooks history and attempt counters."""
    _received_webhooks.clear()
    _event_attempt_tracker.clear()
    return {"message": "Received webhooks log cleared successfully"}
