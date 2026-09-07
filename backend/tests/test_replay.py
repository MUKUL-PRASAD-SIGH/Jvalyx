import pytest

from backend.pipeline import ReplayEngine, ReplayStatus, ScenarioCatalog


async def no_wait(_: float) -> None:
    return None


def test_catalog_loads_the_two_committed_scenarios() -> None:
    catalog = ScenarioCatalog()

    assert [scenario.scenario_id for scenario in catalog.list()] == [
        "industrial_escalation",
        "persistent_flare",
    ]
    assert catalog.get("industrial_escalation").frames[-1].checkpoint == "critical_state"
    assert catalog.get("persistent_flare").mode.value == "HISTORICAL REPLAY"


@pytest.mark.asyncio
async def test_replay_publishes_frames_in_order_and_completes() -> None:
    catalog = ScenarioCatalog()
    engine = ReplayEngine(sleep=no_wait)
    engine.load(catalog.get("industrial_escalation"))
    published_frame_ids: list[str] = []

    async def publish(frame) -> None:
        published_frame_ids.append(frame.frame_id)

    await engine.run(publish)

    assert published_frame_ids == [
        "industrial_escalation:0",
        "industrial_escalation:1",
        "industrial_escalation:2",
        "industrial_escalation:3",
    ]
    assert engine.status is ReplayStatus.COMPLETED
    assert engine.current_frame_index == 4


def test_replay_controls_validate_speed_jump_and_reset() -> None:
    catalog = ScenarioCatalog()
    engine = ReplayEngine(sleep=no_wait)
    engine.load(catalog.get("industrial_escalation"))

    engine.set_speed(4.0)
    engine.jump_to("before_anomaly")

    assert engine.speed == 4.0
    assert engine.current_frame_index == 1
    assert engine.status is ReplayStatus.IDLE

    engine.reset()

    assert engine.current_frame_index == 0
    assert engine.status is ReplayStatus.IDLE

    with pytest.raises(ValueError, match="speed"):
        engine.set_speed(2.0)
