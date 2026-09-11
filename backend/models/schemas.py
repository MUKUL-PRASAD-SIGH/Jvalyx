"""Canonical, transport-safe data models for the Jvalyx event pipeline."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RouteState(StrEnum):
    NORMAL = "NORMAL"
    UNCERTAIN = "UNCERTAIN"
    CRITICAL = "CRITICAL"


class DataMode(StrEnum):
    LIVE_DATA = "LIVE DATA"
    HISTORICAL_REPLAY = "HISTORICAL REPLAY"
    DEMO_SIMULATION = "DEMO SIMULATION MODE"


class SensorAgreementState(StrEnum):
    SINGLE_SENSOR = "single_sensor"
    MULTI_SENSOR_SAME_INSTRUMENT = "multi_sensor_same_instrument"
    MULTI_SENSOR_CROSS_CONFIRMED = "multi_sensor_cross_confirmed"
    DISAGREEMENT = "disagreement"
    UNKNOWN = "unknown"
    # Legacy alias support
    AGREEMENT = "agreement"


class ConfidenceState(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Detection(BaseModel):
    """A normalized thermal detection; raw source records remain separately auditable."""

    model_config = ConfigDict(extra="forbid")

    detection_id: str = Field(min_length=1)
    sensor: Literal["VIIRS", "MODIS", "REPLAY"]
    timestamp: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    frp_mw: float | None = Field(default=None, ge=0)
    bright_ti4_k: float | None = Field(default=None, ge=0)
    bright_ti5_k: float | None = Field(default=None, ge=0)
    scan_km: float | None = Field(default=None, gt=0)
    track_km: float | None = Field(default=None, gt=0)
    confidence: str | None = None
    daynight: int | None = Field(default=None, ge=0, le=1)
    cloud_flag: bool = False
    raw_quality: dict[str, Any] = Field(default_factory=dict)


class FusedEvent(BaseModel):
    """The stable event representation consumed by feature and decision layers."""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=1)
    created_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    detections: list[Detection] = Field(min_length=1)
    sensor_count: int = Field(ge=1)
    corroboration_count: int = Field(default=1, ge=0)
    data_quality_pass: bool = Field(default=True)
    sensor_agreement_state: SensorAgreementState = SensorAgreementState.UNKNOWN
    data_quality_flag: str = "UNKNOWN"
    facility_id: str | None = None
    facility_type: str = "none"
    persistence_score: float = Field(default=0.0, ge=0)
    facility_frp_zscore: float = 0.0
    route_state: RouteState = RouteState.UNCERTAIN
    mode: DataMode = DataMode.HISTORICAL_REPLAY


class DecisionOutput(BaseModel):
    """A human-readable routing result with explicit model and policy provenance."""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=1)
    class_id: int = Field(ge=1, le=5)
    class_name: str = Field(min_length=1)
    class_probabilities: dict[int, float]
    anomaly_score: float = Field(ge=0, le=1)
    route_state: RouteState
    risk_score: int = Field(ge=0, le=100)
    confidence_state: ConfidenceState
    explanation: list[str] = Field(default_factory=list)
    recommended_action: str = Field(min_length=1)
    model_version: str = Field(default="stub-0.1.0", min_length=1)
    policy_version: str = Field(default="arbitrator-0.1.0", min_length=1)
    mode: DataMode = DataMode.HISTORICAL_REPLAY

    @model_validator(mode="after")
    def validate_class_probabilities(self) -> "DecisionOutput":
        expected_class_ids = {1, 2, 3, 4, 5}
        if set(self.class_probabilities) != expected_class_ids:
            raise ValueError("class_probabilities must contain exactly class IDs 1 through 5")
        if any(probability < 0 or probability > 1 for probability in self.class_probabilities.values()):
            raise ValueError("class probabilities must be between 0 and 1")
        if abs(sum(self.class_probabilities.values()) - 1.0) > 1e-6:
            raise ValueError("class probabilities must sum to 1")
        return self
