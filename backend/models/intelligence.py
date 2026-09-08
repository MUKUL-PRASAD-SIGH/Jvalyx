"""Combined event-intelligence output produced by the deterministic pipeline."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .schemas import DataMode, DecisionOutput, FusedEvent, RouteState


class RiskBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0, le=100)
    severity: float = Field(ge=0)
    anomaly: float = Field(ge=0, le=1)
    spread: float = Field(ge=0, le=1)
    exposure: float = Field(ge=0, le=1)


class EvidenceCard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Literal["thermal", "context", "temporal", "decision"]
    title: str = Field(min_length=1)
    metrics: dict[str, str]
    why_it_matters: str = Field(min_length=1)


class PlumeCorridor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    centerline: list[tuple[float, float]]
    cone50: list[tuple[float, float]]
    cone90: list[tuple[float, float]]
    wind_speed_mps: float = Field(ge=0)
    wind_direction_deg: float


class AffectedAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    type: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    distance_m: float = Field(ge=0)
    criticality_weight: float = Field(ge=0, le=1)
    population_at_risk: int | None = Field(default=None, ge=0)


class TacticalOverlay(BaseModel):
    model_config = ConfigDict(extra="forbid")

    segmentation_geojson: dict[str, Any] | None = None
    burn_area_m2: float | None = None
    smoke_area_m2: float | None = None
    plume_corridor: PlumeCorridor | None = None
    affected_assets: list[AffectedAsset] = Field(default_factory=list)
    consequence_score: float = Field(default=0.0, ge=0, le=1)
    population_at_risk: int = Field(default=0, ge=0)
    swir_nir_ratio: float | None = None
    delta_nbr: float | None = None
    delta_ndvi: float | None = None


VerificationStatus = Literal["unverified", "human_confirmed", "human_rejected"]


class EventIntelligence(BaseModel):
    """Everything the dashboard needs for one replay frame / event snapshot."""

    model_config = ConfigDict(extra="forbid")

    event_id: str
    scenario_id: str
    frame_index: int = Field(ge=0)
    checkpoint: str | None = None
    label: str
    description: str
    timestamp: str
    mode: DataMode
    route_state: RouteState
    fused_event: FusedEvent
    features: dict[str, float]
    decision: DecisionOutput
    risk: RiskBreakdown
    evidence: list[EvidenceCard]
    tactical: TacticalOverlay | None = None
    historical_baseline_timeline: list[dict[str, float | str]] = Field(default_factory=list)
    verification_status: VerificationStatus = "unverified"
    simulated: bool = False
    deviation: float = Field(default=0.0, ge=0, le=1)
