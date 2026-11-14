from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
import uuid
from app.schemas.delivery import DeliveryAttemptResponse


def generate_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"


class EventSubmitRequest(BaseModel):
    event_id: Optional[str] = Field(default_factory=generate_event_id)
    event_type: str = Field(min_length=1, max_length=100)
    payload: Dict[str, Any]
    endpoint_id: Optional[int] = None
    max_retries: int = Field(default=3, ge=1, le=3)

    @field_validator("event_id", mode="before")
    @classmethod
    def set_or_validate_event_id(cls, v: Optional[str]) -> str:
        if v is None or not str(v).strip():
            return generate_event_id()
        v = str(v).strip()
        if len(v) > 100:
            raise ValueError("event_id cannot exceed 100 characters")
        return v

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("event_type cannot be empty")
        if len(v) > 100:
            raise ValueError("event_type cannot exceed 100 characters")
        return v


class EventListItem(BaseModel):
    id: int
    event_id: str
    event_type: str
    endpoint_id: int
    endpoint_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    status: str
    attempt_count: int
    max_retries: int
    created_at: datetime
    updated_at: datetime
    last_attempted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EventResponse(BaseModel):
    id: int
    event_id: str
    event_type: str
    payload: Dict[str, Any]
    endpoint_id: int
    endpoint_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    status: str
    attempt_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    attempts: List[DeliveryAttemptResponse] = []

    model_config = ConfigDict(from_attributes=True)
