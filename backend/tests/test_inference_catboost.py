"""Trained CatBoost classifier: feature contract and live inference over classes 1-5.

These tests exercise the real artifact. They assert the *mechanical* contract — feature
order, categorical encoding, a valid distribution over classes 1-5 — and deliberately do
not pin semantic outcomes, which belong to whatever model version is shipped.
"""

from datetime import datetime, timezone

import pytest

from backend.models import Detection
from backend.pipeline import ScenarioCatalog, process_frame
from backend.pipeline.inference import (
    CATEGORICAL_INDICES,
    FEATURE_NAMES,
    TRAINED_FACILITY_TYPES,
    TRAINED_LULC_CODES,
    build_feature_row,
    catboost_inference,
    get_inference_engine,
    normalize_facility_type,
    normalize_lulc,
)
from backend.pipeline.inference_stub import stub_inference

pytestmark = pytest.mark.skipif(
    not catboost_inference.available, reason="catboost or the model artifact is unavailable"
)

CATALOG = ScenarioCatalog()


def _detection(**overrides) -> Detection:
    base = dict(
        detection_id="det-1",
        sensor="VIIRS",
        timestamp=datetime(2026, 9, 5, 10, 14, tzinfo=timezone.utc),
        latitude=12.978,
        longitude=74.838,
        frp_mw=41.2,
        bright_ti4_k=342.5,
        bright_ti5_k=295.1,
        scan_km=0.38,
        track_km=0.38,
    )
    base.update(overrides)
    return Detection(**base)


def test_artifact_matches_documented_feature_schema() -> None:
    model = catboost_inference._load()  # noqa: SLF001 - asserting the artifact contract
    assert tuple(model.feature_names_) == FEATURE_NAMES
    assert len(FEATURE_NAMES) == 12
    assert tuple(model.get_cat_feature_indices()) == CATEGORICAL_INDICES
    assert [int(c) for c in model.classes_] == [1, 2, 3, 4, 5]


def test_feature_row_is_ordered_and_typed() -> None:
    context = {
        "is_in_industrial_polygon": True,
        "distance_to_industrial_m": 0,
        "facility_type": "Petrochemical Refining",
        "lulc_class": "industrial_developed",
        "lulc_entropy_500m": 1.84,
    }
    row, lulc_known = build_feature_row([_detection()], context)

    assert len(row) == len(FEATURE_NAMES)
    named = dict(zip(FEATURE_NAMES, row))
    assert named["bright_ti4"] == 342.5
    assert named["bright_ti5"] == 295.1
    assert named["temp_ratio"] == pytest.approx(342.5 / 295.1, rel=1e-6)
    assert named["frp"] == pytest.approx(41.2)
    assert named["scan"] == 0.38 and named["track"] == 0.38
    assert named["is_in_industrial_polygon"] == 1
    assert named["daynight"] in (0, 1)
    # Categorical columns must stay strings, mapped into the trained vocabulary.
    assert isinstance(row[CATEGORICAL_INDICES[0]], str)
    assert isinstance(row[CATEGORICAL_INDICES[1]], str)
    assert named["facility_type"] in TRAINED_FACILITY_TYPES
    assert named["lulc_class"] == "50" and lulc_known


def test_event_frp_is_summed_and_radiometrics_frp_weighted() -> None:
    detections = [
        _detection(detection_id="a", frp_mw=100.0, bright_ti4_k=350.0),
        _detection(detection_id="b", frp_mw=300.0, bright_ti4_k=390.0),
    ]
    row = dict(zip(FEATURE_NAMES, build_feature_row(detections, {})[0]))

    assert row["frp"] == pytest.approx(400.0)
    # Weighted toward the hotter, higher-FRP pixel rather than a flat mean of 370.
    assert row["bright_ti4"] == pytest.approx((350.0 * 100 + 390.0 * 300) / 400)


def test_categorical_normalisation() -> None:
    assert normalize_lulc("tree_cover") == "10"
    assert normalize_lulc("Industrial Developed") == "50"
    assert normalize_lulc("30") == "30"          # codes pass through
    assert normalize_lulc(None) == "0"           # unknown, not silently defaulted to a real class
    # Cropland has a true ESA code that is now included in the retrained model.
    assert normalize_lulc("cropland") == "40"
    assert "40" in TRAINED_LULC_CODES

    assert normalize_facility_type("Petrochemical Refining", in_industrial_polygon=True) == "general_industrial"
    assert normalize_facility_type("Deciduous Forest Canopy", in_industrial_polygon=False) == "none"


def test_daynight_derived_from_local_solar_time() -> None:
    day = _detection(timestamp=datetime(2026, 9, 5, 7, 0, tzinfo=timezone.utc))   # ~12:00 IST
    night = _detection(timestamp=datetime(2026, 9, 5, 20, 0, tzinfo=timezone.utc))  # ~01:00 IST
    assert dict(zip(FEATURE_NAMES, build_feature_row([day], {})[0]))["daynight"] == 1
    assert dict(zip(FEATURE_NAMES, build_feature_row([night], {})[0]))["daynight"] == 0
    # An explicit feed flag always wins over the derivation.
    flagged = _detection(timestamp=datetime(2026, 9, 5, 7, 0, tzinfo=timezone.utc), daynight=0)
    assert dict(zip(FEATURE_NAMES, build_feature_row([flagged], {})[0]))["daynight"] == 0


@pytest.mark.parametrize(
    "scenario_id", ["industrial_escalation", "persistent_flare", "wildfire", "sensor_disagreement"]
)
def test_real_inference_returns_valid_distribution_for_every_frame(scenario_id: str) -> None:
    scenario = CATALOG.get(scenario_id)
    for index in range(len(scenario.frames)):
        intel = process_frame(scenario, index, inference=catboost_inference)
        probs = intel.decision.class_probabilities

        assert set(probs) == {1, 2, 3, 4, 5}
        assert abs(sum(probs.values()) - 1.0) < 1e-6
        assert all(0.0 <= p <= 1.0 for p in probs.values())
        assert intel.decision.class_id == max(probs, key=probs.get)
        assert intel.decision.model_version == "catboost-multiclass-12f-0.1.0"


def test_anomaly_score_remains_pack_derived_and_separately_versioned() -> None:
    scenario = CATALOG.get("industrial_escalation")
    frame = scenario.frames[3]
    prediction = catboost_inference.infer(frame.detections, frame.context)

    assert prediction["anomaly_score"] == frame.context["stub_anomaly_score"]
    assert prediction["anomaly_model_version"] == "iforest-stub-0.1.0"
    assert prediction["model_version"] != prediction["anomaly_model_version"]


def test_engine_selection_honours_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JVALYX_INFERENCE", "stub")
    assert get_inference_engine() is stub_inference

    monkeypatch.setenv("JVALYX_INFERENCE", "catboost")
    assert get_inference_engine() is catboost_inference


def test_both_engines_share_the_same_output_shape() -> None:
    scenario = CATALOG.get("wildfire")
    frame = scenario.frames[0]

    trained = catboost_inference.infer(frame.detections, frame.context)
    stub = stub_inference.infer(frame.detections, frame.context)

    shared = {"class_probabilities", "class_id", "class_name", "anomaly_score", "model_version"}
    assert shared <= set(trained) and shared <= set(stub)
    assert set(trained["class_probabilities"]) == set(stub["class_probabilities"]) == {1, 2, 3, 4, 5}
