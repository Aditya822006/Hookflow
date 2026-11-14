from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from urllib.parse import urlparse


class EndpointBase(BaseModel):
    name: str
    url: str
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Endpoint URL must have an http:// or https:// scheme")
        if not parsed.netloc:
            raise ValueError("Endpoint URL must contain a valid host")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Endpoint name cannot be empty")
        if len(v) > 100:
            raise ValueError("Endpoint name cannot exceed 100 characters")
        return v


class EndpointCreate(EndpointBase):
    secret_token: Optional[str] = None


class EndpointUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    secret_token: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_updated_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Endpoint name cannot be empty")
        if len(v) > 100:
            raise ValueError("Endpoint name cannot exceed 100 characters")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Endpoint URL must have an http:// or https:// scheme")
        if not parsed.netloc:
            raise ValueError("Endpoint URL must contain a valid host")
        return v


class EndpointResponse(EndpointBase):
    id: int
    has_secret: bool = False
    created_at: datetime
    updated_at: datetime
    total_events: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
