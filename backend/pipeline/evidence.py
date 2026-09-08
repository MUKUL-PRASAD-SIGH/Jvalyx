"""Evidence-card assembly (Comprehensive plan §2 "Evidence Cards").

Explainability as a visible product feature, not a hidden SHAP plot. Every decision
produces four cards: thermal, context, temporal, decision.
"""

from typing import Any

from backend.models import SensorAgreementState
from backend.models.intelligence import EvidenceCard


def build_evidence_cards(
    *,
    features: dict[str, float],
    class_probabilities: dict[int, float],
    anomaly_score: float,
    fusion_state: SensorAgreementState,
    rule_fired: str,
    context: dict[str, Any],
) -> list[EvidenceCard]:
    frp = features.get("total_frp_mw", 0.0)
    facility_z = features.get("facility_frp_zscore", 0.0)
    cluster = int(features.get("cluster_pixel_count", 1))
    drift = features.get("centroid_drift_velocity_mph", 0.0)
    trend = features.get("frp_trend_mw_per_hour", 0.0)
    persistence = features.get("persistence_score", 0.0)
    top_class = max(class_probabilities, key=class_probabilities.get) if class_probabilities else 5

    return [
        EvidenceCard(
            category="thermal",
            title="Thermal evidence",
            metrics={
                "Observed FRP": f"{frp:.1f} MW",
                "FRP trend": f"{trend:+.0f} MW/h",
                "Cluster size": f"{cluster} px",
                "Temp ratio (ti4/ti5)": f"{features.get('temp_ratio', 0.0):.3f}",
            },
            why_it_matters=(
                "A rising FRP trend across several linked pixels is stronger evidence of "
                "escalation than one isolated hot reading."
            ),
        ),
        EvidenceCard(
            category="context",
            title="Context evidence",
            metrics={
                "Inside industrial polygon": "yes" if features.get("is_in_industrial_polygon") else "no",
                "Facility": str(context.get("facility_name", "open terrain")),
                "Land cover": str(context.get("lulc_class", "unknown")),
                "Distance to industry": f"{features.get('distance_to_industrial_m', 0.0):.0f} m",
            },
            why_it_matters=(
                "Where the heat sits — a refinery boundary versus forest or cropland — "
                "changes what the same thermal signature most likely means."
            ),
        ),
        EvidenceCard(
            category="temporal",
            title="Temporal evidence",
            metrics={
                "Facility FRP z-score": f"{facility_z:+.1f} sigma",
                "Coordinate z-score": f"{features.get('frp_z_score', 0.0):+.1f} sigma",
                "Coordinate persistence": f"{persistence:.2f}",
                "Centroid drift": f"{drift:.0f} m/h",
            },
            why_it_matters=(
                "Deviation from this facility's own 90-day normal is the signal that a "
                "routine source has changed behaviour."
            ),
        ),
        EvidenceCard(
            category="decision",
            title="Decision evidence",
            metrics={
                "Top class": f"C{top_class} ({class_probabilities.get(top_class, 0.0) * 100:.0f}%)",
                "P(industrial fire)": f"{class_probabilities.get(1, 0.0) * 100:.0f}%",
                "Anomaly score": f"{anomaly_score:.2f}",
                "Sensor consensus": fusion_state.value.replace("_", " "),
                "Routing rule": rule_fired,
            },
            why_it_matters=(
                "The route state comes from an inspectable rule over the model "
                "distribution, the independent anomaly score and sensor agreement — not a "
                "single opaque confidence number."
            ),
        ),
    ]
