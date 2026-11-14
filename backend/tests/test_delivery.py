from unittest.mock import patch, MagicMock
import httpx
from app.services.delivery_service import deliver_webhook_sync, generate_hmac_signature
from app.models.event import Event, EventStatus
from app.models.delivery_attempt import DeliveryAttempt


def test_hmac_signature_generation():
    secret = "test_signing_secret"
    payload = '{"order_id": "123"}'
    sig = generate_hmac_signature(secret, payload)
    assert isinstance(sig, str)
    assert len(sig) == 64  # SHA256 hex digest length
    # Verify deterministic
    sig2 = generate_hmac_signature(secret, payload)
    assert sig == sig2


@patch("httpx.Client.post")
def test_successful_webhook_delivery(mock_post, db_session, sample_event):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"status": "received"}'
    mock_resp.headers = {"content-type": "application/json"}
    mock_post.return_value = mock_resp

    success, status_code, error = deliver_webhook_sync(db_session, sample_event.id)

    assert success is True
    assert status_code == 200
    assert error is None

    # Check that event was updated to DELIVERED
    db_session.refresh(sample_event)
    assert sample_event.status == EventStatus.DELIVERED.value
    assert sample_event.attempt_count == 1

    # Check delivery attempt record
    attempt = db_session.query(DeliveryAttempt).filter(DeliveryAttempt.event_id == sample_event.id).first()
    assert attempt is not None
    assert attempt.attempt_number == 1
    assert attempt.response_status == 200
    assert attempt.success is True
    assert attempt.execution_time_ms is not None
    assert attempt.execution_time_ms >= 0


@patch("httpx.Client.post")
def test_failed_webhook_delivery_http_500(mock_post, db_session, sample_event):
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.reason_phrase = "Internal Server Error"
    mock_resp.text = "Server error occurred"
    mock_resp.headers = {}
    mock_post.return_value = mock_resp

    success, status_code, error = deliver_webhook_sync(db_session, sample_event.id)

    assert success is False
    assert status_code == 500
    assert "500" in error

    db_session.refresh(sample_event)
    # Failed attempts waiting for a Celery countdown are pending, not in-flight.
    assert sample_event.status == EventStatus.PENDING.value
    assert sample_event.attempt_count == 1

    attempt = db_session.query(DeliveryAttempt).filter(DeliveryAttempt.event_id == sample_event.id).first()
    assert attempt is not None
    assert attempt.success is False
    assert attempt.response_status == 500


@patch("httpx.Client.post")
def test_permanent_http_error_does_not_consume_retry_budget(
    mock_post, db_session, sample_event
):
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.reason_phrase = "Not Found"
    mock_resp.text = "Unknown route"
    mock_resp.headers = {}
    mock_post.return_value = mock_resp

    success, status_code, error = deliver_webhook_sync(db_session, sample_event.id)

    assert success is False
    assert status_code == 404
    assert "404" in error
    db_session.refresh(sample_event)
    assert sample_event.status == EventStatus.FAILED.value
    assert sample_event.attempt_count == 1


@patch("httpx.Client.post")
def test_delivery_timeout_handling(mock_post, db_session, sample_event):
    mock_post.side_effect = httpx.TimeoutException("Connection timed out after 10.0 seconds")

    success, status_code, error = deliver_webhook_sync(db_session, sample_event.id)

    assert success is False
    assert status_code is None
    assert "timed out" in error.lower()

    db_session.refresh(sample_event)
    attempt = db_session.query(DeliveryAttempt).filter(DeliveryAttempt.event_id == sample_event.id).first()
    assert attempt is not None
    assert attempt.success is False
    assert "timed out" in attempt.error_message.lower()


@patch("httpx.Client.post")
def test_delivery_connection_error_handling(mock_post, db_session, sample_event):
    mock_post.side_effect = httpx.ConnectError("Failed to resolve host or connect to port")

    success, status_code, error = deliver_webhook_sync(db_session, sample_event.id)

    assert success is False
    assert status_code is None
    assert "connection failed" in error.lower()
