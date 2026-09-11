import asyncio

import pytest

from backend.runtime import Broadcaster, ReplayWorker
from backend.storage import EventStore


class RecordingBroadcaster(Broadcaster):
    def __init__(self) -> None:
        super().__init__()
        self.messages: list[dict] = []

    async def publish(self, message: dict) -> None:  # type: ignore[override]
        self.messages.append(message)


@pytest.fixture
def fast_worker(monkeypatch: pytest.MonkeyPatch) -> ReplayWorker:
    monkeypatch.setenv("JVALYX_REPLAY_COMPRESSION", "100000")
    monkeypatch.setenv("JVALYX_REPLAY_MAX_GAP_SECONDS", "0")
    return ReplayWorker(store=EventStore(), broadcaster=RecordingBroadcaster())


async def test_worker_replays_industrial_escalation_to_critical(fast_worker: ReplayWorker) -> None:
    fast_worker.load("industrial_escalation")
    await fast_worker.start()
    await asyncio.wait_for(fast_worker._task, timeout=5)  # noqa: SLF001 - test drives internals

    updates = [m for m in fast_worker.broadcaster.messages if m["type"] == "event_update"]  # type: ignore[attr-defined]
    assert [m["frame_index"] for m in updates] == [0, 1, 2, 3]
    assert updates[0]["payload"]["route_state"] == "NORMAL"
    assert updates[-1]["payload"]["route_state"] == "CRITICAL"

    event = fast_worker.store.get_event("evt-industrial_escalation")
    assert event is not None and event.route_state.value == "CRITICAL"


async def test_worker_verify_overrides_route_and_writes_audit(fast_worker: ReplayWorker) -> None:
    fast_worker.load("industrial_escalation")
    await fast_worker.jump_to("critical_state")

    updated = fast_worker.verify("evt-industrial_escalation", "reject", "OPS-1", "")
    assert updated.route_state.value == "NORMAL"
    assert updated.verification_status == "human_rejected"

    actions = [entry.action for entry in fast_worker.store.audit_log()]
    assert "REJECT_NORMAL" in actions


async def test_worker_simulate_tags_demo_mode(fast_worker: ReplayWorker) -> None:
    fast_worker.load("industrial_escalation")

    simulated = fast_worker.simulate("evt-industrial_escalation", 1.0)

    assert simulated.mode.value == "DEMO SIMULATION MODE"
    assert simulated.route_state.value == "CRITICAL"


async def test_worker_step_scrubs_frames_and_publishes(fast_worker: ReplayWorker) -> None:
    fast_worker.load("industrial_escalation")

    await fast_worker.step(1)
    await fast_worker.step(1)
    assert fast_worker.status()["frame_index"] == 2

    await fast_worker.step(-1)
    assert fast_worker.status()["frame_index"] == 1

    # Clamped at the start; never negative.
    await fast_worker.step(-1)
    await fast_worker.step(-1)
    assert fast_worker.status()["frame_index"] == 0

    updates = [m for m in fast_worker.broadcaster.messages if m["type"] == "event_update"]  # type: ignore[attr-defined]
    assert [m["frame_index"] for m in updates] == [1, 2, 1, 0, 0]


async def test_worker_jump_wins_over_running_playback(fast_worker: ReplayWorker) -> None:
    fast_worker.load("industrial_escalation")
    await fast_worker.start()
    await fast_worker.jump_to("baseline")

    status = fast_worker.status()
    assert status["replay_status"] == "IDLE"
    assert status["frame_index"] == 0  # "baseline" is frame 0
