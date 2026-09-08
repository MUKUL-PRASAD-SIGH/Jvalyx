"""Deterministic feature engineering (math doc §3-6).

Baseline statistics are frozen before the simulated anomaly begins in each replay
scenario, so a frame is never scored against a baseline contaminated by its own surge.
"""

from typing import Any

from backend.models import Detection

EPS = 1e-6


def safe_z(value: float, mean: float, std: float) -> float:
    return (value - mean) / max(std, EPS)


def temperature_ratio(ti4_k: float | None, ti5_k: float | None) -> float:
    return round((ti4_k or 0.0) / max(ti5_k or 1.0, 1.0), 3)


def total_frp(detections: list[Detection]) -> float:
    return round(sum(d.frp_mw or 0.0 for d in detections), 2)


def derive_features(
    detections: list[Detection],
    context: dict[str, Any],
    baseline: dict[str, float],
) -> dict[str, float]:
    """Low-latency radiometric / temporal / spatial features for one frame."""
    lead = detections[0]
    frp = total_frp(detections)

    coord_mean = baseline.get("coordinate_mean", context.get("baseline_frp_mean", frp))
    coord_std = baseline.get("coordinate_std", context.get("baseline_frp_std", 1.0))
    facility_mean = baseline.get("facility_mean", coord_mean)
    facility_std = baseline.get("facility_std", coord_std)

    # Curated scenarios pin authoritative z-scores; fall back to computing them.
    frp_z = float(context.get("frp_z_score", round(safe_z(frp, coord_mean, coord_std), 2)))
    facility_z = float(
        context.get("facility_frp_zscore", round(safe_z(frp, facility_mean, facility_std), 2))
    )

    return {
        "total_frp_mw": frp,
        "temp_ratio": temperature_ratio(lead.bright_ti4_k, lead.bright_ti5_k),
        "frp_z_score": frp_z,
        "facility_frp_zscore": facility_z,
        "persistence_score": float(context.get("persistence_score", 0.0)),
        "cluster_pixel_count": float(context.get("cluster_pixel_count", len(detections))),
        "centroid_drift_velocity_mph": float(context.get("centroid_drift_velocity_mph", 0.0)),
        "frp_trend_mw_per_hour": float(context.get("frp_trend_mw_per_hour", 0.0)),
        "lulc_entropy_500m": float(context.get("lulc_entropy_500m", 0.0)),
        "distance_to_industrial_m": float(context.get("distance_to_industrial_m", 0.0)),
        "data_quality_score": float(context.get("data_quality_score", 0.0)),
        "is_in_industrial_polygon": 1.0 if context.get("is_in_industrial_polygon") else 0.0,
        "is_mine_polygon": 1.0 if context.get("is_mine_polygon") else 0.0,
    }
