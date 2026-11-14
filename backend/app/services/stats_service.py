from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.event import Event, EventStatus
from app.models.endpoint import Endpoint
from app.models.delivery_attempt import DeliveryAttempt
from app.schemas.stats import DashboardStats, StatusCount, DailyTrend


def get_dashboard_metrics(db: Session) -> DashboardStats:
    """Calculates all key metrics for the HookFlow operational dashboard."""
    total_events = db.query(func.count(Event.id)).scalar() or 0
    total_endpoints = db.query(func.count(Endpoint.id)).scalar() or 0
    active_endpoints = db.query(func.count(Endpoint.id)).filter(Endpoint.is_active == True).scalar() or 0

    delivered_count = db.query(func.count(Event.id)).filter(Event.status == EventStatus.DELIVERED.value).scalar() or 0
    failed_count = db.query(func.count(Event.id)).filter(Event.status == EventStatus.FAILED.value).scalar() or 0
    pending_count = db.query(func.count(Event.id)).filter(Event.status == EventStatus.PENDING.value).scalar() or 0
    processing_count = db.query(func.count(Event.id)).filter(Event.status == EventStatus.PROCESSING.value).scalar() or 0

    total_attempts = db.query(func.count(DeliveryAttempt.id)).scalar() or 0

    # Calculate overall success rate percentage
    completed_events = delivered_count + failed_count
    if completed_events > 0:
        success_rate_pct = round((delivered_count / completed_events) * 100, 1)
    elif total_events > 0 and delivered_count > 0:
        success_rate_pct = 100.0
    else:
        success_rate_pct = 0.0

    status_breakdown = [
        StatusCount(status=EventStatus.DELIVERED.value, count=delivered_count),
        StatusCount(status=EventStatus.FAILED.value, count=failed_count),
        StatusCount(status=EventStatus.PENDING.value, count=pending_count),
        StatusCount(status=EventStatus.PROCESSING.value, count=processing_count),
    ]

    # Calculate daily trends for the last 7 days
    now = datetime.now(timezone.utc)
    daily_trends: List[DailyTrend] = []
    
    for i in range(6, -1, -1):
        day_date = (now - timedelta(days=i)).date()
        day_start = datetime.combine(day_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(day_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        delivered = (
            db.query(func.count(DeliveryAttempt.id))
            .filter(
                DeliveryAttempt.attempted_at >= day_start,
                DeliveryAttempt.attempted_at <= day_end,
                DeliveryAttempt.success == True
            )
            .scalar() or 0
        )

        failed = (
            db.query(func.count(DeliveryAttempt.id))
            .filter(
                DeliveryAttempt.attempted_at >= day_start,
                DeliveryAttempt.attempted_at <= day_end,
                DeliveryAttempt.success == False
            )
            .scalar() or 0
        )

        daily_trends.append(
            DailyTrend(
                date=day_date.strftime("%b %d"),
                delivered=delivered,
                failed=failed,
                total=delivered + failed,
            )
        )

    return DashboardStats(
        total_events=total_events,
        total_endpoints=total_endpoints,
        active_endpoints=active_endpoints,
        delivered_count=delivered_count,
        failed_count=failed_count,
        pending_count=pending_count,
        processing_count=processing_count,
        total_attempts=total_attempts,
        success_rate_pct=success_rate_pct,
        status_breakdown=status_breakdown,
        daily_trends=daily_trends,
    )
