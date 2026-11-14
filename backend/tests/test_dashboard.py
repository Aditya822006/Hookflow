from fastapi import status
from app.models.event import Event, EventStatus
from app.models.delivery_attempt import DeliveryAttempt


def test_dashboard_stats_empty(client):
    response = client.get("/api/v1/dashboard/stats")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_events"] == 0
    assert data["total_endpoints"] == 0
    assert data["success_rate_pct"] == 0.0
    assert len(data["daily_trends"]) == 7


def test_dashboard_stats_with_data(client, db_session, sample_endpoint):
    # Create 1 DELIVERED event and 1 FAILED event
    ev1 = Event(
        event_id="evt_stat_001",
        event_type="test.one",
        payload={},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.DELIVERED.value,
        attempt_count=1,
    )
    ev2 = Event(
        event_id="evt_stat_002",
        event_type="test.two",
        payload={},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.FAILED.value,
        attempt_count=3,
    )
    db_session.add_all([ev1, ev2])
    db_session.commit()

    # Add corresponding delivery attempts
    att1 = DeliveryAttempt(
        event_id=ev1.id,
        attempt_number=1,
        response_status=200,
        success=True,
    )
    att2 = DeliveryAttempt(
        event_id=ev2.id,
        attempt_number=1,
        response_status=500,
        success=False,
    )
    db_session.add_all([att1, att2])
    db_session.commit()

    response = client.get("/api/v1/dashboard/stats")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_events"] == 2
    assert data["delivered_count"] == 1
    assert data["failed_count"] == 1
    assert data["total_attempts"] == 2
    # 1 delivered out of 2 completed = 50.0%
    assert data["success_rate_pct"] == 50.0


def test_dashboard_recent_activity(client, db_session, sample_endpoint):
    ev = Event(
        event_id="evt_recent_001",
        event_type="user.registered",
        payload={"username": "alice"},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.PENDING.value,
    )
    db_session.add(ev)
    db_session.commit()

    response = client.get("/api/v1/dashboard/recent?limit=5")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 1
    assert data[0]["event_id"] == "evt_recent_001"
