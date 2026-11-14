import time
import json
import pytest
from fastapi import status
from app.models.endpoint import Endpoint
from app.models.event import Event, EventStatus
from app.models.delivery_attempt import DeliveryAttempt
from app.core.config import settings
from app.services.delivery_service import generate_hmac_signature, deliver_webhook_sync


def test_live_health_check(client):
    """Verify GET /health returns operational database connectivity status."""
    res = client.get("/health")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"
    assert "version" in data


def test_live_dashboard_stats_real_data(client, db_session, sample_endpoint):
    """Verify GET /api/v1/dashboard/stats returns real aggregated operational data."""
    # Seed 1 delivered and 1 pending event
    ev1 = Event(
        event_id="evt_live_stat_01",
        event_type="order.completed",
        payload={"amount": 100},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.DELIVERED.value,
        attempt_count=1,
    )
    ev2 = Event(
        event_id="evt_live_stat_02",
        event_type="order.failed",
        payload={"amount": 50},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.FAILED.value,
        attempt_count=3,
    )
    db_session.add_all([ev1, ev2])
    db_session.commit()

    att1 = DeliveryAttempt(
        event_id=ev1.id,
        attempt_number=1,
        response_status=200,
        execution_time_ms=25.4,
        success=True,
    )
    att2 = DeliveryAttempt(
        event_id=ev2.id,
        attempt_number=1,
        response_status=500,
        execution_time_ms=110.8,
        success=False,
    )
    db_session.add_all([att1, att2])
    db_session.commit()

    res = client.get("/api/v1/dashboard/stats")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total_events"] >= 2
    assert data["delivered_count"] >= 1
    assert data["failed_count"] >= 1
    assert len(data["daily_trends"]) == 7


def test_live_event_submission_and_duplicate_conflict(client, sample_endpoint):
    """Verify POST /api/v1/events and 409 Conflict rejection on duplicate event_id."""
    event_id = "evt_idempotency_check_999"
    payload = {
        "event_id": event_id,
        "event_type": "invoice.paid",
        "payload": {"invoice_id": "INV-2026", "amount": 1200},
        "endpoint_id": sample_endpoint.id,
    }

    # 1. First submission succeeds (202 Accepted)
    res1 = client.post("/api/v1/events", json=payload)
    assert res1.status_code == status.HTTP_202_ACCEPTED
    data1 = res1.json()
    assert data1["event_id"] == event_id
    assert data1["status"] == "PENDING"
    assert data1["endpoint_id"] == sample_endpoint.id

    # 2. Duplicate submission with exact same event_id is rejected with 409 Conflict
    res2 = client.post("/api/v1/events", json=payload)
    assert res2.status_code == status.HTTP_409_CONFLICT
    error_detail = res2.json()["detail"]
    assert "duplicate event submission rejected" in error_detail["message"].lower()
    assert error_detail["existing_event_id"] == event_id


def test_live_mock_receiver_delivery_and_signature(client):
    """Verify built-in mock receiver verifies HMAC-SHA256 signature and logs webhook."""
    secret = settings.WEBHOOK_SECRET_KEY
    event_id = "evt_mock_delivery_101"
    payload_dict = {"event": "user.signup", "user_id": 42}
    payload_json = json.dumps(payload_dict)
    
    signature = generate_hmac_signature(secret, payload_json)
    
    res = client.post(
        "/api/v1/receiver/webhook",
        content=payload_json,
        headers={
            "Content-Type": "application/json",
            "X-HookFlow-Event-Id": event_id,
            "X-HookFlow-Event-Type": "user.signup",
            "X-HookFlow-Delivery-Attempt": "1",
            "X-HookFlow-Signature": f"sha256={signature}",
        }
    )
    assert res.status_code == status.HTTP_200_OK
    res_data = res.json()
    assert res_data["status"] == "success"
    assert res_data["signature_valid"] is True
    assert res_data["event_id"] == event_id

    # Verify audit inspection
    r_inspect = client.get("/api/v1/receiver/logs")
    assert r_inspect.status_code == status.HTTP_200_OK
    captured = [item for item in r_inspect.json() if item["event_id"] == event_id]
    assert len(captured) >= 1
    assert captured[0]["signature_valid"] is True


def test_live_manual_retry_preserves_delivery_history(client, db_session, sample_endpoint):
    """Verify POST /api/v1/events/{id}/retry preserves all prior delivery attempt logs."""
    # Create event with an initial failed attempt
    ev = Event(
        event_id="evt_retry_audit_log_preserve",
        event_type="subscription.renewed",
        payload={"sub_id": "SUB-88"},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.FAILED.value,
        attempt_count=1,
    )
    db_session.add(ev)
    db_session.commit()
    db_session.refresh(ev)

    first_attempt = DeliveryAttempt(
        event_id=ev.id,
        attempt_number=1,
        response_status=503,
        execution_time_ms=62.5,
        error_message="HTTP 503: Service Unavailable",
        success=False,
    )
    db_session.add(first_attempt)
    db_session.commit()

    # Trigger manual retry endpoint
    res_retry = client.post(f"/api/v1/events/{ev.id}/retry")
    assert res_retry.status_code == status.HTTP_200_OK
    retry_data = res_retry.json()
    assert retry_data["status"] == "PENDING"

    # Query event detail and verify history
    res_detail = client.get(f"/api/v1/events/{ev.id}")
    assert res_detail.status_code == status.HTTP_200_OK
    detail_data = res_detail.json()
    assert len(detail_data["attempts"]) == 1
    assert detail_data["attempts"][0]["attempt_number"] == 1
    assert detail_data["attempts"][0]["response_status"] == 503
    assert detail_data["attempts"][0]["error_message"] == "HTTP 503: Service Unavailable"
    assert detail_data["max_retries"] == 4


def test_live_receiver_rejects_invalid_hmac_signature(client):
    response = client.post(
        "/api/v1/receiver/webhook",
        json={"event": "order.created"},
        headers={
            "X-HookFlow-Event-Id": "evt_invalid_signature",
            "X-HookFlow-Signature": "sha256=invalid",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["signature_valid"] is False


def test_live_receiver_verifies_destination_specific_secret(client, sample_endpoint):
    body = json.dumps({"order_id": "ORD-44"})
    signature = generate_hmac_signature(sample_endpoint.secret_token, body)

    response = client.post(
        "/api/v1/receiver/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-HookFlow-Endpoint-Id": str(sample_endpoint.id),
            "X-HookFlow-Signature": f"sha256={signature}",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["signature_valid"] is True
