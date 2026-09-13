"""Deterministic, inspectable routing + transparent risk score (math doc §12-13).

This is the port of the frontend ``utils/math.ts`` (``routeEvent`` + ``computeRiskScore``).
The backend is the single source of truth; the SPA should render these results, not
recompute them.
"""

import math

from backend.config import AppConfig
from backend.models import RouteState, SensorAgreementState
from backend.models.intelligence import RiskBreakdown


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def arbitrate(
    class_probabilities: dict[int, float],
    anomaly_score: float,
    features: dict[str, float],
    fusion_state: SensorAgreementState,
    config: AppConfig,
    lulc_in_vocabulary: bool = True,
    history_complete: bool = True,
    on_water: bool = False,
) -> RouteState:
    cfg = config.arbitration
    p1 = class_probabilities.get(1, 0.0)
    p2 = class_probabilities.get(2, 0.0)
    max_p = max(class_probabilities.values()) if class_probabilities else 0.0

    is_industrial = features.get("is_in_industrial_polygon", 0.0) >= 1.0
    facility_z = features.get("facility_frp_zscore", 0.0)
    quality = features.get("data_quality_score", 1.0)
    disagreement = fusion_state == SensorAgreementState.DISAGREEMENT

    # A confident model call escalates on its own. The facility-anomaly heuristic only
    # escalates when the z-score rests on adequate-quality, corroborated data - otherwise
    # a cloud-attenuated reading is routed to verification, never auto-escalated.
    strong_model_critical = (
        (p1 >= cfg.class1_threshold or p2 >= cfg.class2_threshold)
        and not disagreement
    )
    industrial_anomaly_critical = (
        is_industrial
        and facility_z >= cfg.facility_z_threshold
        and quality >= cfg.min_quality
        and not disagreement
    )
    critical = strong_model_critical or industrial_anomaly_critical
    # The classifier's own class_probabilities are near-meaningless when lulc_class fell
    # outside the artifact's trained vocabulary (see backend/models/artifacts/README.md
    # "Measured vocabulary") — a high max_p in that state reflects the model's unknown-
    # category default, not evidence, so it must not clear the uncertain gate on its own.
    uncertain = (
        disagreement
        or anomaly_score >= cfg.anomaly_threshold
        or quality < cfg.min_quality
        or max_p < cfg.min_model_confidence
        or not lulc_in_vocabulary
        # Without 90 days of history the recurrence count can be too low, making routine
        # site heat look like an unusual fire - never settle that as CRITICAL or NORMAL.
        or not history_complete
    )

    if disagreement or not history_complete:
        return RouteState.UNCERTAIN
    # Water land cover under an "unusual industrial fire" is mostly ash ponds, reservoirs,
    # mine pit lakes and river banks next to routine sites (9 of 11 such CRITICALs in the
    # week of 2026-09-07). Never auto-escalate it; send it to verification instead.
    if on_water and class_probabilities and max(class_probabilities, key=class_probabilities.get) == 1:
        return RouteState.UNCERTAIN
    if critical:
        return RouteState.CRITICAL
    if uncertain:
        return RouteState.UNCERTAIN
    return RouteState.NORMAL


def risk_score(
    class_probabilities: dict[int, float],
    features: dict[str, float],
    exposure: float,
    config: AppConfig,
) -> RiskBreakdown:
    cfg = config.risk
    weights = {int(k): v for k, v in cfg.class_impact_weights.items()}

    severity = sum(weights.get(k, 0.0) * p for k, p in class_probabilities.items())
    anomaly = sigmoid((features.get("facility_frp_zscore", 0.0) - 3.0) / 1.0)
    spread = sigmoid(
        0.45 * math.log1p(features.get("cluster_pixel_count", 1.0))
        + 0.002 * features.get("centroid_drift_velocity_mph", 0.0)
        - 1.2
    )
    exp = max(0.0, min(1.0, exposure))

    raw = (
        cfg.severity_weight * severity
        + cfg.anomaly_weight * anomaly
        + cfg.spread_weight * spread
        + cfg.exposure_weight * exp
    )
    total = round(100 * max(0.0, min(1.0, raw)))
    return RiskBreakdown(
        total=total,
        severity=round(severity, 3),
        anomaly=round(anomaly, 3),
        spread=round(spread, 3),
        exposure=round(exp, 3),
    )


def confidence_state(class_probabilities: dict[int, float]) -> str:
    max_p = max(class_probabilities.values()) if class_probabilities else 0.0
    if max_p >= 0.80:
        return "high"
    if max_p >= 0.55:
        return "medium"
    return "low"


def which_rule_fired(
    class_probabilities: dict[int, float],
    anomaly_score: float,
    features: dict[str, float],
    fusion_state: SensorAgreementState,
    config: AppConfig,
    lulc_in_vocabulary: bool = True,
    history_complete: bool = True,
    on_water: bool = False,
) -> str:
    cfg = config.arbitration
    p1 = class_probabilities.get(1, 0.0)
    p2 = class_probabilities.get(2, 0.0)
    is_industrial = features.get("is_in_industrial_polygon", 0.0) >= 1.0
    facility_z = features.get("facility_frp_zscore", 0.0)

    quality = features.get("data_quality_score", 1.0)
    disagreement = fusion_state == SensorAgreementState.DISAGREEMENT

    if disagreement:
        return "UNCERTAIN: sensor disagreement is routed to verification, never suppressed"
    if not history_complete:
        return "UNCERTAIN: FIRMS history does not cover the 90 days before this detection - recurrence may be undercounted"
    if on_water and class_probabilities and max(class_probabilities, key=class_probabilities.get) == 1:
        return "UNCERTAIN: unusual industrial fire on water land cover (often an ash pond, reservoir or river bank) - verify"
    if p1 >= cfg.class1_threshold:
        return f"CRITICAL: P(unusual industrial fire) {p1:.2f} >= {cfg.class1_threshold}"
    if p2 >= cfg.class2_threshold:
        return f"CRITICAL: P(wildfire) {p2:.2f} >= {cfg.class2_threshold}"
    if (
        is_industrial
        and facility_z >= cfg.facility_z_threshold
        and quality >= cfg.min_quality
    ):
        return f"CRITICAL: industrial polygon and facility Z {facility_z:.1f} >= {cfg.facility_z_threshold}"
    if anomaly_score >= cfg.anomaly_threshold:
        return f"UNCERTAIN: anomaly score {anomaly_score:.2f} >= {cfg.anomaly_threshold}"
    if features.get("data_quality_score", 1.0) < cfg.min_quality:
        return f"UNCERTAIN: data quality {features.get('data_quality_score', 1.0):.2f} < {cfg.min_quality}"
    max_p = max(class_probabilities.values()) if class_probabilities else 0.0
    if max_p < cfg.min_model_confidence:
        return f"UNCERTAIN: top class confidence {max_p:.2f} < {cfg.min_model_confidence}"
    if not lulc_in_vocabulary:
        return "UNCERTAIN: lulc_class outside the model's trained vocabulary - class label is not evidence-backed"
    return "NORMAL: no critical or uncertain condition met"
