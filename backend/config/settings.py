"""Typed loading and validation for versioned policy configuration."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


class VersionsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_version: str = Field(min_length=1)
    policy_version: str = Field(min_length=1)


class ArbitrationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class1_threshold: float = Field(ge=0, le=1)
    class2_threshold: float = Field(ge=0, le=1)
    facility_z_threshold: float = Field(ge=0)
    anomaly_threshold: float = Field(ge=0, le=1)
    min_model_confidence: float = Field(ge=0, le=1)


class RiskConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    severity_weight: float = Field(ge=0, le=1)
    anomaly_weight: float = Field(ge=0, le=1)
    spread_weight: float = Field(ge=0, le=1)
    exposure_weight: float = Field(ge=0, le=1)
    exposure_default: float = Field(default=0.0, ge=0, le=1)

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


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    versions: VersionsConfig
    arbitration: ArbitrationConfig
    risk: RiskConfig


CONFIG_PATH = Path(__file__).with_name("thresholds.yaml")


@lru_cache
def load_config() -> AppConfig:
    """Load the committed policy file once and fail fast on malformed configuration."""
    with CONFIG_PATH.open(encoding="utf-8") as config_file:
        raw_config = yaml.safe_load(config_file)
    return AppConfig.model_validate(raw_config)
