"""Typed contracts for deterministic, historical replay scenarios."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .schemas import DataMode, Detection


class ReplayFrame(BaseModel):
    """One ordered replay frame with original observation timestamps preserved."""

    model_config = ConfigDict(extra="forbid")

    frame_id: str = Field(min_length=1)
    elapsed_seconds: float = Field(ge=0)
    checkpoint: str | None = None
    detections: list[Detection] = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class ReplayScenario(BaseModel):
    """A self-contained, versioned replay definition."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(min_length=1)
    scenario_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    mode: DataMode
    source_provenance: str = Field(min_length=1)
    classification_note: str = Field(min_length=1)
    baseline: dict[str, float] = Field(default_factory=dict)
    frames: list[ReplayFrame] = Field(min_length=1)

    @model_validator(mode="after")
    def frames_are_ordered_and_unique(self) -> "ReplayScenario":
        frame_ids = [frame.frame_id for frame in self.frames]
        if len(frame_ids) != len(set(frame_ids)):
            raise ValueError("scenario frame IDs must be unique")
        elapsed_times = [frame.elapsed_seconds for frame in self.frames]
        if elapsed_times != sorted(elapsed_times):
            raise ValueError("scenario frames must be ordered by elapsed_seconds")
        return self
