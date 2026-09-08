"""Placeholder for the CatBoost triage classifier + Isolation Forest anomaly path.

Training is out of scope for this phase. ``stub_infer`` returns a hand-authored
probability distribution and anomaly score per replay frame, matching the exact output
shape the trained models will eventually produce. Swapping in the real models touches
only this module.
"""

from typing import Any

MODEL_VERSION = "stub-0.1.0"
ANOMALY_MODEL_VERSION = "iforest-stub-0.1.0"

CLASS_NAMES = {
    1: "Accidental Industrial Fire / Explosion",
    2: "Wildfire or Forest Fire",
    3: "Uncontrolled Mining / Coal-Seam Fire",
    4: "Agricultural / Stubble Burning",
    5: "Persistent Flare / Routine Heat",
}


def _normalize(probs: dict[int, float]) -> dict[int, float]:
    filled = {k: max(0.0, float(probs.get(k, 0.0))) for k in range(1, 6)}
    total = sum(filled.values()) or 1.0
    scaled = {k: v / total for k, v in filled.items()}
    # Repair rounding drift so the distribution sums to exactly 1.0.
    drift = 1.0 - sum(scaled.values())
    top = max(scaled, key=scaled.get)
    scaled[top] = round(scaled[top] + drift, 12)
    return scaled


class StubInference:
    """Per-frame outputs, shaped like ``predict_proba`` + ``decision_function``."""

    def infer(self, context: dict[str, Any]) -> dict[str, Any]:
        raw = context.get("stub_class_probabilities") or {5: 1.0}
        probs = _normalize({int(k): float(v) for k, v in raw.items()})
        class_id = max(probs, key=probs.get)
        anomaly = float(context.get("stub_anomaly_score", 0.1))
        return {
            "class_probabilities": probs,
            "class_id": class_id,
            "class_name": CLASS_NAMES[class_id],
            "anomaly_score": max(0.0, min(1.0, anomaly)),
            "model_version": MODEL_VERSION,
        }


stub_inference = StubInference()
