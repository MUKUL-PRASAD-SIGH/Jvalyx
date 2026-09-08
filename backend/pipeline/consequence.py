"""Deterministic consequence / exposure scoring (math doc §12)."""

from typing import Any

from backend.models.intelligence import AffectedAsset

POPULATION_CAP = 100_000
ASSET_COUNT_CAP = 10
PROXIMITY_M = 2_000


def _asset(raw: dict[str, Any]) -> AffectedAsset:
    return AffectedAsset(
        id=str(raw["id"]),
        name=str(raw["name"]),
        type=str(raw["type"]),
        latitude=float(raw["latitude"]),
        longitude=float(raw["longitude"]),
        distance_m=float(raw.get("distance_m", 0.0)),
        criticality_weight=float(raw.get("criticality_weight", 0.5)),
        population_at_risk=(
            int(raw["population_at_risk"]) if raw.get("population_at_risk") is not None else None
        ),
    )


def assess_consequence(context: dict[str, Any]) -> tuple[list[AffectedAsset], float, int]:
    """Return (affected assets, consequence score in [0, 1], population at risk)."""
    raw_assets = context.get("affected_assets") or []
    assets = [_asset(a) for a in raw_assets]

    population = sum(a.population_at_risk or 0 for a in assets)
    nearest_m = min((a.distance_m for a in assets), default=PROXIMITY_M * 2)

    pop_factor = min(population / POPULATION_CAP, 1.0)
    asset_factor = min(
        sum(a.criticality_weight for a in assets) / ASSET_COUNT_CAP, 1.0
    )
    proximity = 1.0 if nearest_m < PROXIMITY_M else 0.4

    score = min(1.0, 0.5 * pop_factor + 0.3 * asset_factor + 0.2 * proximity) if assets else 0.0
    return assets, round(score, 3), population
