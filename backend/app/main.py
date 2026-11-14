from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import init_db, get_db
from app.api.v1 import api_router
from app.models.endpoint import Endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager: handles startup and shutdown."""
    # 1. Initialize database tables
    init_db()

    # 2. Seed default endpoint if database is empty
    from app.core.database import SessionLocal
    with SessionLocal() as db:
        existing_endpoint = db.query(Endpoint).first()
        if not existing_endpoint:
            default_endpoint = Endpoint(
                name="Default Mock Receiver",
                url=settings.SAMPLE_RECEIVER_URL,
                description="Built-in HookFlow sample receiver for testing delivery & retries",
                secret_token=settings.WEBHOOK_SECRET_KEY,
                is_active=True,
            )
            db.add(default_endpoint)
            db.commit()
        elif (
            existing_endpoint.name == "Default Mock Receiver"
            and existing_endpoint.url == "http://localhost:8000/api/v1/receiver/webhook"
            and settings.SAMPLE_RECEIVER_URL != existing_endpoint.url
        ):
            existing_endpoint.url = settings.SAMPLE_RECEIVER_URL
            if existing_endpoint.secret_token == "hookflow_secret_token_123":
                existing_endpoint.secret_token = settings.WEBHOOK_SECRET_KEY
            db.commit()

    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="HookFlow API",
    description="Reliable Webhook Delivery & Event Management Platform",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
def root():
    """Root endpoint returning API metadata and documentation link."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint verifying database connectivity."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database health check failed.",
        ) from exc

    return {
        "status": "healthy",
        "database": "healthy",
        "version": settings.VERSION,
    }
