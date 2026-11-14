import logging
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.delivery_service import deliver_webhook_sync, calculate_backoff_delay
from app.models.event import Event, EventStatus

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.webhook_tasks.deliver_webhook_task",
    max_retries=3,
    acks_late=True,
)
def deliver_webhook_task(self, event_db_id: int):
    """
    Celery background worker task for webhook delivery.
    Performs HTTP POST, captures response, logs attempt,
    and handles automatic retry with exponential backoff.
    """
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_db_id).first()
        if not event:
            logger.error(f"Event ID {event_db_id} not found in database.")
            return {"status": "error", "message": "Event not found"}

        logger.info(
            f"Delivering webhook for event_id='{event.event_id}', "
            f"attempt={event.attempt_count + 1}/{event.max_retries}"
        )

        success, response_status, error_message = deliver_webhook_sync(db, event_db_id)

        # Refresh event to get updated attempt_count and status
        db.refresh(event)

        if success:
            logger.info(
                f"Successfully delivered event_id='{event.event_id}' with status {response_status}"
            )
            return {
                "event_id": event.event_id,
                "status": "DELIVERED",
                "attempt": event.attempt_count,
                "response_status": response_status,
            }
        else:
            logger.warning(
                f"Delivery attempt {event.attempt_count} failed for event_id='{event.event_id}': "
                f"{error_message} (status: {response_status})"
            )

            # Check if automatic retries are remaining
            if (
                event.status == EventStatus.PENDING.value
                and event.attempt_count < event.max_retries
            ):
                delay = calculate_backoff_delay(event.attempt_count)
                logger.info(
                    f"Scheduling retry {event.attempt_count + 1} for event '{event.event_id}' "
                    f"in {delay}s (exponential backoff)"
                )
                # Raise Celery retry with calculated countdown
                raise self.retry(
                    exc=Exception(f"Delivery failed: {error_message}"),
                    countdown=delay
                )
            else:
                logger.error(
                    f"All {event.max_retries} delivery attempts exhausted for event '{event.event_id}'."
                )
                return {
                    "event_id": event.event_id,
                    "status": "FAILED",
                    "attempt": event.attempt_count,
                    "error": error_message,
                }
    finally:
        db.close()
