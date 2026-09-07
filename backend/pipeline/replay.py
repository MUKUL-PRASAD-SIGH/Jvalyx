"""Deterministic replay state machine independent of downstream decision processing."""

import asyncio
from collections.abc import Awaitable, Callable
from enum import StrEnum

from backend.models import ReplayFrame, ReplayScenario


class ReplayStatus(StrEnum):
    IDLE = "IDLE"
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


FramePublisher = Callable[[ReplayFrame], Awaitable[None]]
SleepFunction = Callable[[float], Awaitable[None]]


class ReplayEngine:
    """Runs one scenario at a time and exposes deterministic demo controls."""

    ALLOWED_SPEEDS = frozenset({0.5, 1.0, 4.0})

    def __init__(self, sleep: SleepFunction = asyncio.sleep) -> None:
        self._sleep = sleep
        self._scenario: ReplayScenario | None = None
        self._frame_index = 0
        self._speed = 1.0
        self._status = ReplayStatus.IDLE
        self._resume_event = asyncio.Event()
        self._resume_event.set()

    @property
    def status(self) -> ReplayStatus:
        return self._status

    @property
    def speed(self) -> float:
        return self._speed

    @property
    def current_frame_index(self) -> int:
        return self._frame_index

    def load(self, scenario: ReplayScenario) -> None:
        """Reset the engine with a scenario before running it."""
        self._scenario = scenario
        self.reset()

    def set_speed(self, speed: float) -> None:
        if speed not in self.ALLOWED_SPEEDS:
            raise ValueError(f"speed must be one of {sorted(self.ALLOWED_SPEEDS)}")
        self._speed = speed

    def pause(self) -> None:
        if self._status is ReplayStatus.PLAYING:
            self._status = ReplayStatus.PAUSED
            self._resume_event.clear()

    def resume(self) -> None:
        if self._status is ReplayStatus.PAUSED:
            self._status = ReplayStatus.PLAYING
            self._resume_event.set()

    def reset(self) -> None:
        self._frame_index = 0
        self._status = ReplayStatus.IDLE
        self._resume_event.set()

    def jump_to(self, checkpoint: str) -> None:
        scenario = self._require_scenario()
        for index, frame in enumerate(scenario.frames):
            if frame.checkpoint == checkpoint:
                self._frame_index = index
                self._status = ReplayStatus.IDLE
                return
        raise ValueError(f"Unknown scenario checkpoint: {checkpoint}")

    async def run(self, publish: FramePublisher) -> None:
        """Publish remaining frames in order, respecting current speed and pause state."""
        scenario = self._require_scenario()
        self._status = ReplayStatus.PLAYING

        while self._frame_index < len(scenario.frames):
            await self._resume_event.wait()
            frame = scenario.frames[self._frame_index]
            if self._frame_index > 0:
                previous_frame = scenario.frames[self._frame_index - 1]
                await self._sleep((frame.elapsed_seconds - previous_frame.elapsed_seconds) / self._speed)
                await self._resume_event.wait()
            await publish(frame)
            self._frame_index += 1

        self._status = ReplayStatus.COMPLETED

    def _require_scenario(self) -> ReplayScenario:
        if self._scenario is None:
            raise RuntimeError("A scenario must be loaded before controlling or running replay")
        return self._scenario
