from fastapi import APIRouter
from app.api.v1.endpoints import router as endpoints_router
from app.api.v1.events import router as events_router
from app.api.v1.deliveries import router as deliveries_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.receiver import router as receiver_router

api_router = APIRouter()

api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(endpoints_router, prefix="/endpoints", tags=["Endpoints"])
api_router.include_router(events_router, prefix="/events", tags=["Events"])
api_router.include_router(deliveries_router, prefix="/deliveries", tags=["Delivery Logs"])
api_router.include_router(receiver_router, prefix="/receiver", tags=["Sample Receiver"])
