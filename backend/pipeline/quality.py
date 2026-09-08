"""Per-detection data-quality scoring (math doc §7.1)."""

from backend.models import Detection

CLOUD_PENALTY = 0.35
SUN_GLINT_PENALTY = 0.25
LOW_CONFIDENCE_PENALTY = 0.20
EXTREME_GEOMETRY_PENALTY = 0.15
EXTREME_GEOMETRY_KM = 35.0


def quality_score(detection: Detection) -> float:
    """Interpretable 0..1 penalty score. Weak detections are kept, not discarded."""
    penalties = 0.0
    if detection.cloud_flag:
        penalties += CLOUD_PENALTY
    if bool(detection.raw_quality.get("sun_glint_flag")):
        penalties += SUN_GLINT_PENALTY
    if (detection.confidence or "").lower() == "low":
        penalties += LOW_CONFIDENCE_PENALTY
    if (detection.scan_km or 0.0) > EXTREME_GEOMETRY_KM or (detection.track_km or 0.0) > EXTREME_GEOMETRY_KM:
        penalties += EXTREME_GEOMETRY_PENALTY

    explicit = detection.raw_quality.get("quality_score")
    if isinstance(explicit, (int, float)):
        # Trust a curated per-detection score when present, but never above the penalty ceiling.
        return max(0.0, min(float(explicit), 1.0 - penalties if penalties else 1.0))
    return max(0.0, min(1.0, 1.0 - penalties))
