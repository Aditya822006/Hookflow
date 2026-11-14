from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class ReceiverConfig(BaseModel):
    simulate_failure: bool = False
    failure_status_code: int = 500
    simulated_delay_seconds: float = 0.0
    failure_mode: str = "always"  # "always", "fail_first_2", "timeout"
    auto_respond_200: bool = True


class ReceivedWebhookLog(BaseModel):
    id: str
    event_id: Optional[str] = None
    event_type: Optional[str] = None
    headers: Dict[str, str]
    payload: Dict[str, Any]
    received_at: datetime
    response_status: int
    signature_valid: Optional[bool] = None
    notes: Optional[str] = None
