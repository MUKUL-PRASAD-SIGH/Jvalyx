"""Hand-authored fallback for the triage classifier + Isolation Forest anomaly path.

The trained CatBoost classifier now lives in ``pipeline/inference.py`` and is the default
path. This module remains the fallback when the model or the ``catboost`` dependency is
unavailable, and the pinned deterministic path for the golden-scenario tests
(``JVALYX_INFERENCE=stub``). It still supplies the anomaly score in both cases: no
Isolation Forest artifact exists anywhere in the repo.

Both engines expose the same ``infer(detections, context)`` signature.
"""

from typing import Any

from backend.models import Detection

MODEL_VERSION = "stub-0.1.0"
ANOMALY_MODEL_VERSION = "iforest-stub-0.1.0"

CLASS_NAMES = {
    # C1 = a normally quiet industrial/flare site suddenly burning; C5 = heat a site produces
    # routinely (gas flares, furnaces, kilns, power plants). See _stage6_relabel_persistence.py.
    1: "Unusual Industrial Fire",
    2: "Wildfire or Forest Fire",
    3: "Uncontrolled Mining / Coal-Seam Fire",
    4: "Agricultural / Stubble Burning",
    5: "Routine Industrial Heat / Flare",
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

    def infer(
        self, detections: list[Detection], context: dict[str, Any], *, live: bool = False
    ) -> dict[str, Any]:
        """``detections``/``live`` are accepted for interface parity; the stub reads only context."""
        del detections, live
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
            "anomaly_model_version": ANOMALY_MODEL_VERSION,
            # Scripted demos pin class_probabilities directly via context, so trained-
            # vocabulary status is moot here - always "in vocabulary" for the stub path.
            "lulc_in_vocabulary": True,
        }

    def infer_batch(self, items: list[tuple[list[Detection], dict[str, Any]]]) -> list[dict[str, Any]]:
        return [self.infer(detections, context, live=True) for detections, context in items]


stub_inference = StubInference()
