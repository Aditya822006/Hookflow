from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "HookFlow"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    # Default is SQLite for quick local standalone execution, override with PostgreSQL in Docker / Prod
    DATABASE_URL: str = "sqlite:///./hookflow.db"
    
    # Redis & Celery Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    # When True or in testing, Celery runs synchronously in-process
    CELERY_ALWAYS_EAGER: bool = False
    
    # Webhook Delivery Settings
    # This value is the maximum delivery attempts, including the first attempt.
    MAX_DELIVERY_RETRIES: int = Field(default=3, ge=1, le=3)
    RETRY_BACKOFF_BASE_SECONDS: int = 5
    WEBHOOK_TIMEOUT_SECONDS: int = 10
    SAMPLE_RECEIVER_URL: str = "http://localhost:8000/api/v1/receiver/webhook"
    
    # Secret key for HMAC signature on outgoing webhooks
    WEBHOOK_SECRET_KEY: str = "hookflow-signing-secret-key-32chars"
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
