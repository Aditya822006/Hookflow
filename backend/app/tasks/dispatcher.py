import logging
from app.tasks.webhook_tasks import deliver_webhook_task

logger = logging.getLogger(__name__)


def enqueue_webhook_delivery(event_db_id: int) -> bool:
    """
    Enqueues webhook delivery to Celery worker.
    Returns False when the broker is unavailable so the API can report that
    the event was persisted but not queued. Delivery is never silently moved
    to an untracked background thread.
    """
    try:
        deliver_webhook_task.delay(event_db_id)
        logger.info(f"Enqueued event {event_db_id} to Celery worker queue.")
        return True
    except Exception as exc:
        logger.exception("Could not enqueue event %s with Celery", event_db_id)
        return False
