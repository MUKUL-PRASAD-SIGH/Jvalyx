"""Versioned policy configuration for the dashboard (audit + honesty labelling)."""

from fastapi import APIRouter

from backend.config import load_config

router = APIRouter(tags=["system"])


@router.get("/config")
async def get_config() -> dict:
    config = load_config()
    return {
        "versions": config.versions.model_dump(),
        "arbitration": config.arbitration.model_dump(),
        "risk": config.risk.model_dump(),
        "baseline": config.baseline.model_dump(),
        "fusion": config.fusion.model_dump(),
        "plume": config.plume.model_dump(),
        "honesty_notice": (
            "Research prototype. Outputs support analyst review and are not a substitute "
            "for official emergency response systems. Model outputs are stub-derived until "
            "trained CatBoost / Isolation Forest models replace them."
        ),
    }
