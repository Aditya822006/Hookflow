from fastapi import status
from app.models.event import Event, EventStatus


def test_submit_event_success(client, sample_endpoint):
    payload = {
        "event_id": "evt_success_001",
        "event_type": "payment.completed",
        "payload": {"payment_id": "PAY-123", "amount": 5000, "currency": "INR"},
        "endpoint_id": sample_endpoint.id,
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == status.HTTP_202_ACCEPTED
    data = response.json()
    assert data["event_id"] == "evt_success_001"
    assert data["event_type"] == "payment.completed"
    assert data["status"] == "PENDING"
    assert data["endpoint_id"] == sample_endpoint.id
    assert "id" in data


def test_submit_event_auto_generated_id(client, sample_endpoint):
    payload = {
        "event_type": "invoice.generated",
        "payload": {"invoice_id": "INV-555"},
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == status.HTTP_202_ACCEPTED
    data = response.json()
    assert data["event_id"].startswith("evt_")
    assert data["status"] == "PENDING"


def test_submit_event_duplicate_rejected(client, sample_endpoint, sample_event):
    # Attempt to submit an event with the exact same event_id as sample_event
    duplicate_payload = {
        "event_id": sample_event.event_id,
        "event_type": "order.placed",
        "payload": {"duplicate": True},
        "endpoint_id": sample_endpoint.id,
    }
    response = client.post("/api/v1/events", json=duplicate_payload)
    assert response.status_code == status.HTTP_409_CONFLICT
    error_detail = response.json()["detail"]
    assert "duplicate event submission rejected" in error_detail["message"].lower()


def test_submit_event_invalid_missing_type(client):
    payload = {
        "event_id": "evt_missing_type",
        "payload": {"foo": "bar"},
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_event_rejects_attempt_limit_above_three(client, sample_endpoint):
    response = client.post(
        "/api/v1/events",
        json={
            "event_id": "evt_too_many_attempts",
            "event_type": "order.created",
            "payload": {},
            "endpoint_id": sample_endpoint.id,
            "max_retries": 4,
        },
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_event_reports_unavailable_broker_without_losing_event(
    client, db_session, sample_endpoint, monkeypatch
):
    from app.api.v1 import events as events_api

    monkeypatch.setattr(events_api, "enqueue_webhook_delivery", lambda event_id: False)
    event_id = "evt_broker_unavailable"
    response = client.post(
        "/api/v1/events",
        json={
            "event_id": event_id,
            "event_type": "order.created",
            "payload": {"order_id": 42},
            "endpoint_id": sample_endpoint.id,
        },
    )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json()["detail"]["event_id"] == event_id
    stored = db_session.query(Event).filter(Event.event_id == event_id).one()
    assert stored.status == EventStatus.FAILED.value


def test_submit_event_to_disabled_endpoint(client, sample_endpoint):
    # Disable endpoint first
    client.post(f"/api/v1/endpoints/{sample_endpoint.id}/toggle")

    payload = {
        "event_id": "evt_to_disabled",
        "event_type": "order.updated",
        "payload": {},
        "endpoint_id": sample_endpoint.id,
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "disabled" in response.json()["detail"].lower()


def test_list_events(client, sample_event):
    response = client.get("/api/v1/events")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 1
    event_ids = [item["event_id"] for item in data]
    assert sample_event.event_id in event_ids


def test_list_events_filtering(client, sample_event):
    # Filter by matching status
    res1 = client.get(f"/api/v1/events?status={sample_event.status}")
    assert res1.status_code == status.HTTP_200_OK
    assert len(res1.json()) >= 1

    # Filter by non-existent status
    res2 = client.get("/api/v1/events?status=NON_EXISTENT")
    assert res2.status_code == status.HTTP_200_OK
    assert len(res2.json()) == 0


def test_get_event_by_id_and_identifier(client, sample_event):
    # Retrieve by numeric ID
    res1 = client.get(f"/api/v1/events/{sample_event.id}")
    assert res1.status_code == status.HTTP_200_OK
    assert res1.json()["event_id"] == sample_event.event_id

    # Retrieve by string event_id
    res2 = client.get(f"/api/v1/events/{sample_event.event_id}")
    assert res2.status_code == status.HTTP_200_OK
    assert res2.json()["id"] == sample_event.id


def test_get_event_not_found(client):
    response = client.get("/api/v1/events/evt_does_not_exist_999")
    assert response.status_code == status.HTTP_404_NOT_FOUND
