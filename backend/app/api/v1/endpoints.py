from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.endpoint import Endpoint
from app.models.event import Event
from app.schemas.endpoint import EndpointCreate, EndpointUpdate, EndpointResponse

router = APIRouter()


@router.post("", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(payload: EndpointCreate, db: Session = Depends(get_db)):
    """Register a new webhook destination endpoint."""
    # Check if an endpoint with the exact same URL already exists
    existing = db.query(Endpoint).filter(Endpoint.url == payload.url).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An endpoint with URL '{payload.url}' is already registered."
        )

    endpoint = Endpoint(
        name=payload.name,
        url=payload.url,
        description=payload.description,
        secret_token=payload.secret_token,
        is_active=payload.is_active,
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return endpoint


@router.get("", response_model=List[EndpointResponse])
def list_endpoints(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Retrieve all registered destination endpoints."""
    query = db.query(Endpoint)
    if active_only:
        query = query.filter(Endpoint.is_active == True)
    
    endpoints = query.order_by(Endpoint.created_at.desc()).all()
    
    # Annotate with total events count for each endpoint
    results = []
    for ep in endpoints:
        total_events = db.query(func.count(Event.id)).filter(Event.endpoint_id == ep.id).scalar() or 0
        resp = EndpointResponse.model_validate(ep)
        resp.total_events = total_events
        results.append(resp)
        
    return results


@router.get("/{endpoint_id}", response_model=EndpointResponse)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    """Retrieve a destination endpoint by ID."""
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Endpoint with ID {endpoint_id} not found."
        )
    total_events = db.query(func.count(Event.id)).filter(Event.endpoint_id == endpoint.id).scalar() or 0
    resp = EndpointResponse.model_validate(endpoint)
    resp.total_events = total_events
    return resp


@router.patch("/{endpoint_id}", response_model=EndpointResponse)
def update_endpoint(
    endpoint_id: int,
    payload: EndpointUpdate,
    db: Session = Depends(get_db)
):
    """Update destination endpoint properties (name, url, is_active, etc.)."""
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Endpoint with ID {endpoint_id} not found."
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "url" in update_data and update_data["url"] != endpoint.url:
        duplicate = (
            db.query(Endpoint)
            .filter(Endpoint.url == update_data["url"], Endpoint.id != endpoint_id)
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An endpoint with this URL is already registered.",
            )
    for field, val in update_data.items():
        setattr(endpoint, field, val)

    db.commit()
    db.refresh(endpoint)
    
    total_events = db.query(func.count(Event.id)).filter(Event.endpoint_id == endpoint.id).scalar() or 0
    resp = EndpointResponse.model_validate(endpoint)
    resp.total_events = total_events
    return resp


@router.post("/{endpoint_id}/toggle", response_model=EndpointResponse)
def toggle_endpoint_status(endpoint_id: int, db: Session = Depends(get_db)):
    """Toggle an endpoint between active and inactive status."""
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Endpoint with ID {endpoint_id} not found."
        )

    endpoint.is_active = not endpoint.is_active
    db.commit()
    db.refresh(endpoint)

    total_events = db.query(func.count(Event.id)).filter(Event.endpoint_id == endpoint.id).scalar() or 0
    resp = EndpointResponse.model_validate(endpoint)
    resp.total_events = total_events
    return resp


@router.delete("/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    """Delete a registered destination endpoint and its associated events."""
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Endpoint with ID {endpoint_id} not found."
        )
    db.delete(endpoint)
    db.commit()
    return None
