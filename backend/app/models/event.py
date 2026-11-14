import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class EventStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, index=True, nullable=False)
    event_type = Column(String(100), index=True, nullable=False)
    payload = Column(JSON, nullable=False)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default=EventStatus.PENDING.value, index=True, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    endpoint = relationship("Endpoint", back_populates="events")
    attempts = relationship(
        "DeliveryAttempt",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="DeliveryAttempt.attempt_number",
    )

    def __repr__(self) -> str:
        return f"<Event(id={self.id}, event_id='{self.event_id}', type='{self.event_type}', status='{self.status}')>"
