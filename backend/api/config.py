"""Versioned policy configuration for the dashboard (audit + honesty labelling)."""

from fastapi import APIRouter

from backend.config import load_config
from backend.pipeline import active_model_version

router = APIRouter(tags=["system"])


@router.get("/config")
async def get_config() -> dict:
    config = load_config()
    versions = config.versions.model_dump()
    # The configured default is declarative; report what is actually loaded.
    versions["model_version"] = active_model_version()
    return {
        "versions": versions,
        "arbitration": config.arbitration.model_dump(),
        "risk": config.risk.model_dump(),
        "baseline": config.baseline.model_dump(),
        "fusion": config.fusion.model_dump(),
        "plume": config.plume.model_dump(),
        "honesty_notice": (
            "Research prototype. Outputs support analyst review and are not a substitute "
            "for official emergency response systems. Class probabilities come from the "
            "trained CatBoost classifier; the anomaly score is still stub-derived, as no "
            "Isolation Forest artifact exists in this repository."
        ),
    }
