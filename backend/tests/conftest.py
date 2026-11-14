import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure test settings
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CELERY_ALWAYS_EAGER"] = "True"

from app.core.database import Base, get_db
from app.main import app
from app.models.endpoint import Endpoint
from app.models.event import Event, EventStatus
from app.models.delivery_attempt import DeliveryAttempt

# Create in-memory SQLite engine for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_database():
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """Provides a transactional database session for tests."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session, monkeypatch):
    """Provides a FastAPI test client with the test DB dependency injected."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    
    # Mock enqueue_webhook_delivery by default to avoid actual network/worker calls in pure API tests
    monkeypatch.setattr("app.api.v1.events.enqueue_webhook_delivery", lambda event_id: True)

    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def sample_endpoint(db_session) -> Endpoint:
    """Fixture to create a sample destination endpoint."""
    ep = Endpoint(
        name="Test Webhook Endpoint",
        url="https://api.testreceiver.org/webhook",
        description="Endpoint for automated test suites",
        secret_token="test_secret_key_123",
        is_active=True,
    )
    db_session.add(ep)
    db_session.commit()
    db_session.refresh(ep)
    return ep


@pytest.fixture
def sample_event(db_session, sample_endpoint) -> Event:
    """Fixture to create a sample event in the database."""
    event = Event(
        event_id="evt_test_001",
        event_type="order.placed",
        payload={"order_id": "ORD-999", "amount": 2500, "currency": "USD"},
        endpoint_id=sample_endpoint.id,
        status=EventStatus.PENDING.value,
        attempt_count=0,
        max_retries=3,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event
