from unittest.mock import patch, MagicMock
from fastapi import status
from app.services.delivery_service import deliver_webhook_sync, calculate_backoff_delay
from app.models.event import EventStatus
from app.models.delivery_attempt import DeliveryAttempt


def test_calculate_backoff_delay():
    # Base delay 5s:
    # Attempt 1: 5 * 2^0 = 5
    # Attempt 2: 5 * 2^1 = 10
    # Attempt 3: 5 * 2^2 = 20
    assert calculate_backoff_delay(1, base_seconds=5) == 5
    assert calculate_backoff_delay(2, base_seconds=5) == 10
    assert calculate_backoff_delay(3, base_seconds=5) == 20
    assert calculate_backoff_delay(4, base_seconds=5) == 40


@patch("httpx.Client.post")
def test_retry_exhaustion_marks_event_failed(mock_post, db_session, sample_event):
    """
    Simulate consecutive failures until max_retries (3) is exhausted.
    Verifies that event status changes to FAILED and all 3 attempts are persisted.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 503
    mock_resp.reason_phrase = "Service Unavailable"
    mock_resp.text = "Down for maintenance"
    mock_resp.headers = {}
    mock_post.return_value = mock_resp

    # Attempt 1
    s1, _, _ = deliver_webhook_sync(db_session, sample_event.id)
    assert s1 is False
    db_session.refresh(sample_event)
    assert sample_event.attempt_count == 1
    assert sample_event.status == EventStatus.PENDING.value

    # Attempt 2
    s2, _, _ = deliver_webhook_sync(db_session, sample_event.id)
    assert s2 is False
    db_session.refresh(sample_event)
    assert sample_event.attempt_count == 2
    assert sample_event.status == EventStatus.PENDING.value

    # Attempt 3 (Final attempt)
    s3, _, _ = deliver_webhook_sync(db_session, sample_event.id)
    assert s3 is False
    db_session.refresh(sample_event)
    assert sample_event.attempt_count == 3
    assert sample_event.status == EventStatus.FAILED.value

    # Verify all 3 attempts are recorded separately in DeliveryAttempt table
    attempts = (
        db_session.query(DeliveryAttempt)
        .filter(DeliveryAttempt.event_id == sample_event.id)
        .order_by(DeliveryAttempt.attempt_number)
        .all()
    )
    assert len(attempts) == 3
    assert [a.attempt_number for a in attempts] == [1, 2, 3]
    assert all(a.response_status == 503 for a in attempts)
    assert all(a.success is False for a in attempts)


def test_manual_retry_preserves_logs(client, db_session, sample_event):
    """
    Test manual retry via API endpoint.
    Verifies event status is reset to PENDING and existing delivery logs remain intact.
    """
    # Create an initial failed attempt manually
    sample_event.status = EventStatus.FAILED.value
    sample_event.attempt_count = 3
    initial_attempt = DeliveryAttempt(
        event_id=sample_event.id,
        attempt_number=1,
        response_status=500,
        error_message="Initial server crash",
        success=False,
    )
    db_session.add(initial_attempt)
    db_session.commit()

    # Trigger manual retry endpoint
    response = client.post(f"/api/v1/events/{sample_event.id}/retry")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == EventStatus.PENDING.value
    assert data["event_id"] == sample_event.event_id
    assert data["max_retries"] == 6

    # Verify previous attempt is still in the database
    db_session.refresh(sample_event)
    assert len(sample_event.attempts) == 1
    assert sample_event.attempts[0].error_message == "Initial server crash"
