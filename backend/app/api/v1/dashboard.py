from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.stats_service import get_dashboard_metrics
from app.schemas.stats import DashboardStats
from app.schemas.event import EventListItem
from app.models.event import Event
from app.models.endpoint import Endpoint

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    """Retrieve operational dashboard metrics, success rate, and 7-day trends."""
    return get_dashboard_metrics(db)


@router.get("/recent", response_model=List[EventListItem])
def get_recent_activity(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve the most recent events for the dashboard activity feed."""
    events = (
        db.query(Event)
        .join(Endpoint)
        .order_by(Event.created_at.desc())
        .limit(limit)
        .all()
    )

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
