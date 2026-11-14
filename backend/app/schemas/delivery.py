from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DeliveryAttemptResponse(BaseModel):
    id: int
    event_id: int
    attempt_number: int
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[float] = None
    success: bool
    attempted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeliveryLogItem(BaseModel):
    id: int
    attempt_number: int
    event_db_id: int
    event_id_str: str
    event_type: str
    endpoint_name: str
    endpoint_url: str
    response_status: Optional[int] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[float] = None
    success: bool
    attempted_at: datetime

    model_config = ConfigDict(from_attributes=True)
