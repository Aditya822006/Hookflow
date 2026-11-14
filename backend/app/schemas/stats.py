from typing import List
from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class DailyTrend(BaseModel):
    date: str
    delivered: int
    failed: int
    total: int


class DashboardStats(BaseModel):
    total_events: int
    total_endpoints: int
    active_endpoints: int
    delivered_count: int
    failed_count: int
    pending_count: int
    processing_count: int
    total_attempts: int
    success_rate_pct: float
    status_breakdown: List[StatusCount]
    daily_trends: List[DailyTrend]
