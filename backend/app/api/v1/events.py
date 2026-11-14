from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import get_db
from app.models.event import Event, EventStatus
from app.models.endpoint import Endpoint
from app.schemas.event import EventSubmitRequest, EventResponse, EventListItem
from app.schemas.delivery import DeliveryAttemptResponse
from app.tasks.dispatcher import enqueue_webhook_delivery

router = APIRouter()


@router.post("", response_model=EventResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_event(
    payload: EventSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Ingest a new event to be reliably delivered to destination webhooks.
    
    Validates request payload, prevents duplicate submissions (idempotency),
    persists event to database, and enqueues delivery task to Celery.
    """
    # 1. Idempotency Check: Reject duplicate event_id
    existing_event = db.query(Event).filter(Event.event_id == payload.event_id).first()
    if existing_event:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Duplicate event submission rejected: Event ID '{payload.event_id}' already exists.",
                "existing_event_id": existing_event.event_id,
                "current_status": existing_event.status,
                "created_at": existing_event.created_at.isoformat(),
            }
        )

    # 2. Determine target endpoint
    target_endpoint: Optional[Endpoint] = None
    if payload.endpoint_id:
        target_endpoint = db.query(Endpoint).filter(Endpoint.id == payload.endpoint_id).first()
        if not target_endpoint:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Specified endpoint ID {payload.endpoint_id} does not exist."
            )
        if not target_endpoint.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Specified endpoint '{target_endpoint.name}' is currently disabled."
            )
    else:
        # Default to first active endpoint
        target_endpoint = db.query(Endpoint).filter(Endpoint.is_active == True).first()
        if not target_endpoint:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active destination endpoints available. Please register an endpoint first."
            )

    # 3. Save event to database
    resolved_event_id = payload.event_id or f"evt_{uuid.uuid4().hex[:12]}"
    event = Event(
        event_id=resolved_event_id,
        event_type=payload.event_type,
        payload=payload.payload,
        endpoint_id=target_endpoint.id,
        status=EventStatus.PENDING.value,
        attempt_count=0,
        max_retries=payload.max_retries or settings.MAX_DELIVERY_RETRIES,
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Event ID '{resolved_event_id}' has already been submitted.",
        ) from exc
    db.refresh(event)

    # 4. Enqueue background delivery task via Celery
    if not enqueue_webhook_delivery(event.id):
        event.status = EventStatus.FAILED.value
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Event was stored but could not be queued. Retry it after the broker is available.",
                "event_id": event.event_id,
            },
        )

    # Prepare response
    resp = EventResponse.model_validate(event)
    resp.endpoint_name = target_endpoint.name
    resp.endpoint_url = target_endpoint.url
    resp.attempts = []
    return resp


@router.get("", response_model=List[EventListItem])
def list_events(
    status_filter: Optional[str] = Query(None, alias="status"),
    event_type: Optional[str] = Query(None),
    endpoint_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve submitted events with filtering, search, and pagination."""
    query = db.query(Event).join(Endpoint)

    if status_filter:
        query = query.filter(Event.status == status_filter.upper())

    if event_type:
        query = query.filter(Event.event_type == event_type)

    if endpoint_id:
        query = query.filter(Event.endpoint_id == endpoint_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Event.event_id.ilike(search_pattern),
                Event.event_type.ilike(search_pattern),
                Endpoint.name.ilike(search_pattern),
                Endpoint.url.ilike(search_pattern),
            )
        )

    events = query.order_by(Event.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for ev in events:
        last_attempt = ev.attempts[-1] if ev.attempts else None
        item = EventListItem(
            id=ev.id,
            event_id=ev.event_id,
            event_type=ev.event_type,
            endpoint_id=ev.endpoint_id,
            endpoint_name=ev.endpoint.name if ev.endpoint else None,
            endpoint_url=ev.endpoint.url if ev.endpoint else None,
            status=ev.status,
            attempt_count=ev.attempt_count,
            max_retries=ev.max_retries,
            created_at=ev.created_at,
            updated_at=ev.updated_at,
            last_attempted_at=last_attempt.attempted_at if last_attempt else None,
        )
        results.append(item)

    return results


@router.get("/{identifier}", response_model=EventResponse)
def get_event(
    identifier: str,
    db: Session = Depends(get_db)
):
    """Retrieve detailed information about a single event by ID or event_id."""
    query = db.query(Event)
    if identifier.isdigit():
        event = query.filter(Event.id == int(identifier)).first()
    else:
        event = query.filter(Event.event_id == identifier).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{identifier}' not found."
        )

    resp = EventResponse.model_validate(event)
    if event.endpoint:
        resp.endpoint_name = event.endpoint.name
        resp.endpoint_url = event.endpoint.url

    resp.attempts = [
        DeliveryAttemptResponse.model_validate(attempt)
        for attempt in event.attempts
    ]
    return resp


@router.post("/{identifier}/retry", response_model=EventResponse)
def manual_retry_event(
    identifier: str,
    db: Session = Depends(get_db)
):
    """
    Manually retry an event that has failed or needs redelivery.
    
    Queues a new background delivery task while preserving all historical delivery logs.
    """
    query = db.query(Event)
    if identifier.isdigit():
        event = query.filter(Event.id == int(identifier)).first()
    else:
        event = query.filter(Event.event_id == identifier).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{identifier}' not found."
        )

    # Check endpoint is active
    if not event.endpoint or not event.endpoint.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot retry: Target destination endpoint is missing or disabled."
        )

    if event.status != EventStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed events can be manually retried.",
        )

    # Give a manual retry a fresh bounded cycle while keeping attempt history ordered.
    event.max_retries = event.attempt_count + settings.MAX_DELIVERY_RETRIES
    event.status = EventStatus.PENDING.value
    event.next_retry_at = None
    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)

    # Enqueue background delivery
    if not enqueue_webhook_delivery(event.id):
        event.status = EventStatus.FAILED.value
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Retry was saved but could not be queued. Try again after the broker is available.",
                "event_id": event.event_id,
            },
        )

    resp = EventResponse.model_validate(event)
    resp.endpoint_name = event.endpoint.name
    resp.endpoint_url = event.endpoint.url
    resp.attempts = [
        DeliveryAttemptResponse.model_validate(a) for a in event.attempts
    ]
    return resp
