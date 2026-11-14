from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Text, Boolean, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class DeliveryAttempt(Base):
    __tablename__ = "delivery_attempts"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    response_headers = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Float, nullable=True)
    success = Column(Boolean, nullable=False, default=False)
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    event = relationship("Event", back_populates="attempts")

    def __repr__(self) -> str:
        return (
            f"<DeliveryAttempt(id={self.id}, event_id={self.event_id}, "
            f"attempt={self.attempt_number}, success={self.success}, status={self.response_status})>"
        )
