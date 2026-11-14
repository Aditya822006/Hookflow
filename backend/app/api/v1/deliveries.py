from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.delivery_attempt import DeliveryAttempt
from app.models.event import Event
from app.models.endpoint import Endpoint
from app.schemas.delivery import DeliveryLogItem

router = APIRouter()


@router.get("", response_model=List[DeliveryLogItem])
def list_delivery_logs(
    success: Optional[bool] = Query(None),
    event_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve all historical delivery attempts across events with filtering and search."""
    query = (
        db.query(DeliveryAttempt)
        .join(Event, DeliveryAttempt.event_id == Event.id)
        .join(Endpoint, Event.endpoint_id == Endpoint.id)
    )

    if success is not None:
        query = query.filter(DeliveryAttempt.success == success)

    if event_id:
        query = query.filter(Event.event_id == event_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Event.event_id.ilike(search_pattern),
                Event.event_type.ilike(search_pattern),
                Endpoint.name.ilike(search_pattern),
                Endpoint.url.ilike(search_pattern),
                DeliveryAttempt.error_message.ilike(search_pattern),
            )
        )

    attempts = query.order_by(DeliveryAttempt.attempted_at.desc()).offset(skip).limit(limit).all()

    results = []
    for att in attempts:
        event = att.event
        endpoint = event.endpoint if event else None

        results.append(
            DeliveryLogItem(
                id=att.id,
                attempt_number=att.attempt_number,
                event_db_id=att.event_id,
                event_id_str=event.event_id if event else "N/A",
                event_type=event.event_type if event else "N/A",
                endpoint_name=endpoint.name if endpoint else "Deleted Endpoint",
                endpoint_url=endpoint.url if endpoint else "N/A",
                response_status=att.response_status,
                error_message=att.error_message,
                execution_time_ms=att.execution_time_ms,
                success=att.success,
                attempted_at=att.attempted_at,
            )
        )

    return results
