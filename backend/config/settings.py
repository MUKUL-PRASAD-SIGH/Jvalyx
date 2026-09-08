"""Typed loading and validation for versioned policy configuration."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


class VersionsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_version: str = Field(min_length=1)
    anomaly_model_version: str = Field(default="iforest-stub-0.1.0", min_length=1)
    policy_version: str = Field(min_length=1)


class BaselineConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coordinate_window_days: int = Field(default=90, ge=1)
    minimum_history_points: int = Field(default=10, ge=1)
    epsilon: float = Field(default=1e-6, gt=0)


class FusionConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spatial_margin_m: float = Field(default=250.0, ge=0)
    polar_temporal_window_minutes: float = Field(default=30.0, gt=0)
    geostationary_window_minutes: float = Field(default=45.0, gt=0)


class ArbitrationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class1_threshold: float = Field(ge=0, le=1)
    class2_threshold: float = Field(ge=0, le=1)
    facility_z_threshold: float = Field(ge=0)
    anomaly_threshold: float = Field(ge=0, le=1)
    min_quality: float = Field(default=0.45, ge=0, le=1)
    min_model_confidence: float = Field(ge=0, le=1)


class RiskConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    severity_weight: float = Field(ge=0, le=1)
    anomaly_weight: float = Field(ge=0, le=1)
    spread_weight: float = Field(ge=0, le=1)
    exposure_weight: float = Field(ge=0, le=1)
    exposure_default: float = Field(default=0.0, ge=0, le=1)
    class_impact_weights: dict[str, float] = Field(
        default_factory=lambda: {"1": 1.00, "2": 0.80, "3": 0.55, "4": 0.20, "5": 0.05}
    )

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "RiskConfig":
        if abs(
            self.severity_weight
            + self.anomaly_weight
            + self.spread_weight
            + self.exposure_weight
            - 1.0
        ) > 1e-6:
            raise ValueError("risk weights must sum to 1")
        return self


class PlumeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    monte_carlo_samples: int = Field(default=250, ge=1)
    speed_sigma_mps: float = Field(default=1.5, ge=0)
    direction_sigma_deg: float = Field(default=12.0, ge=0)


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    versions: VersionsConfig
    arbitration: ArbitrationConfig
    risk: RiskConfig
    baseline: BaselineConfig = Field(default_factory=BaselineConfig)
    fusion: FusionConfig = Field(default_factory=FusionConfig)
    plume: PlumeConfig = Field(default_factory=PlumeConfig)


CONFIG_PATH = Path(__file__).with_name("thresholds.yaml")


@lru_cache
def load_config() -> AppConfig:
    """Load the committed policy file once and fail fast on malformed configuration."""
    with CONFIG_PATH.open(encoding="utf-8") as config_file:
        raw_config = yaml.safe_load(config_file)
    return AppConfig.model_validate(raw_config)
