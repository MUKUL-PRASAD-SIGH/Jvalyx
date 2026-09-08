"""Event intelligence, counterfactual simulation, and operator verification."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.models import EventIntelligence
from backend.runtime import replay_worker
from backend.storage import AuditEntry

router = APIRouter(tags=["events"])


class SimulateRequest(BaseModel):
    deviation: float = Field(ge=0.0, le=1.0, description="Operational deviation / incident intensity")


class VerifyRequest(BaseModel):
    decision: Literal["confirm", "reject"]
    operator: str = "DUTY-SUPERVISOR-1"
    notes: str = ""


@router.get("/events", response_model=list[EventIntelligence])
async def list_events() -> list[EventIntelligence]:
    return replay_worker.store.list_events()


@router.get("/events/{event_id}", response_model=EventIntelligence)
async def get_event(event_id: str) -> EventIntelligence:
    event = replay_worker.store.get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Unknown event: {event_id}")
    return event


@router.post("/events/{event_id}/simulate", response_model=EventIntelligence)
async def simulate_event(event_id: str, request: SimulateRequest) -> EventIntelligence:
    try:
        return replay_worker.simulate(event_id, request.deviation)
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/events/{event_id}/verify", response_model=EventIntelligence)
async def verify_event(event_id: str, request: VerifyRequest) -> EventIntelligence:
    try:
        return replay_worker.verify(event_id, request.decision, request.operator, request.notes)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Unknown event: {event_id}") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/audit", response_model=list[AuditEntry])
async def audit_log() -> list[AuditEntry]:
    return replay_worker.store.audit_log()
