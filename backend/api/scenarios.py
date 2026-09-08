"""Replay scenario catalog and playback control."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.pipeline import ReplayEngine
from backend.runtime import replay_worker

router = APIRouter(tags=["replay"])


class ScenarioSummary(BaseModel):
    scenario_id: str
    title: str
    description: str
    mode: str
    frame_count: int
    checkpoints: list[str]
    facility: dict | None = None


class SpeedRequest(BaseModel):
    speed: float = Field(description="Playback speed", examples=[0.5, 1.0, 4.0])


class JumpRequest(BaseModel):
    checkpoint: str


@router.get("/scenarios", response_model=list[ScenarioSummary])
async def list_scenarios() -> list[ScenarioSummary]:
    scenarios = replay_worker.catalog.list()
    return [
        ScenarioSummary(
            scenario_id=s.scenario_id,
            title=s.title,
            description=s.description,
            mode=s.mode.value,
            frame_count=len(s.frames),
            checkpoints=[f.checkpoint for f in s.frames if f.checkpoint],
            facility=s.facility,
        )
        for s in scenarios
    ]


@router.post("/scenarios/{scenario_id}/start")
async def start_scenario(scenario_id: str) -> dict:
    try:
        current = replay_worker.status().get("scenario_id")
        if current != scenario_id:
            replay_worker.load(scenario_id)
        await replay_worker.start()
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}") from error
    return replay_worker.status()


@router.post("/scenarios/{scenario_id}/reset")
async def reset_scenario(scenario_id: str) -> dict:
    try:
        if replay_worker.status().get("scenario_id") != scenario_id:
            replay_worker.load(scenario_id)
        else:
            await replay_worker.reset()
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}") from error
    return replay_worker.status()


@router.post("/replay/pause")
async def pause_replay() -> dict:
    replay_worker.pause()
    return replay_worker.status()


@router.post("/replay/resume")
async def resume_replay() -> dict:
    replay_worker.resume()
    return replay_worker.status()


@router.post("/replay/speed")
async def set_replay_speed(request: SpeedRequest) -> dict:
    if request.speed not in ReplayEngine.ALLOWED_SPEEDS:
        raise HTTPException(
            status_code=422,
            detail=f"speed must be one of {sorted(ReplayEngine.ALLOWED_SPEEDS)}",
        )
    replay_worker.set_speed(request.speed)
    return replay_worker.status()


@router.post("/replay/jump")
async def jump_replay(request: JumpRequest) -> dict:
    try:
        replay_worker.jump_to(request.checkpoint)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return replay_worker.status()


@router.get("/replay/status")
async def replay_status() -> dict:
    return replay_worker.status()
