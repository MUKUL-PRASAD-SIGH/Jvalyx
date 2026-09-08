from datetime import UTC, datetime

from backend.config import load_config
from backend.models import Detection, SensorAgreementState
from backend.pipeline.arbitration import arbitrate, risk_score
from backend.pipeline.plume import generate_plume_corridor
from backend.pipeline.quality import quality_score

CONFIG = load_config()


def _detection(**overrides) -> Detection:
    base = dict(
        detection_id="det-x",
        sensor="VIIRS",
        timestamp=datetime(2026, 9, 5, tzinfo=UTC),
        latitude=12.0,
        longitude=74.0,
        frp_mw=40.0,
    )
    base.update(overrides)
    return Detection(**base)


def test_quality_score_penalises_cloud_and_low_confidence() -> None:
    clean = _detection(raw_quality={"quality_score": 0.95})
    obstructed = _detection(cloud_flag=True, confidence="low", raw_quality={"quality_score": 0.45})

    assert quality_score(clean) == 0.95
    assert quality_score(obstructed) <= 0.45


def test_arbitration_escalates_on_confident_industrial_class() -> None:
    probs = {1: 0.82, 2: 0.05, 3: 0.03, 4: 0.02, 5: 0.08}
    features = {"is_in_industrial_polygon": 1.0, "facility_frp_zscore": 10.0, "data_quality_score": 0.95}

    route = arbitrate(probs, 0.9, features, SensorAgreementState.AGREEMENT, CONFIG)

    assert route.value == "CRITICAL"


def test_arbitration_routes_disagreement_to_uncertain_not_suppressed() -> None:
    # p1 below threshold, industrial z-score high, but sensors disagree under cloud.
    probs = {1: 0.42, 2: 0.08, 3: 0.18, 4: 0.02, 5: 0.30}
    features = {"is_in_industrial_polygon": 1.0, "facility_frp_zscore": 4.43, "data_quality_score": 0.45}

    route = arbitrate(probs, 0.76, features, SensorAgreementState.DISAGREEMENT, CONFIG)

    assert route.value == "UNCERTAIN"


def test_arbitration_normal_when_nothing_fires() -> None:
    probs = {1: 0.03, 2: 0.02, 3: 0.01, 4: 0.02, 5: 0.92}
    features = {"is_in_industrial_polygon": 1.0, "facility_frp_zscore": 0.4, "data_quality_score": 0.95}

    route = arbitrate(probs, 0.10, features, SensorAgreementState.SINGLE_SENSOR, CONFIG)

    assert route.value == "NORMAL"


def test_risk_score_is_bounded_and_ordered() -> None:
    low = risk_score(
        {1: 0.02, 2: 0.01, 3: 0.01, 4: 0.01, 5: 0.95},
        {"facility_frp_zscore": -0.2, "cluster_pixel_count": 1.0, "centroid_drift_velocity_mph": 0.0},
        0.0,
        CONFIG,
    )
    high = risk_score(
        {1: 0.95, 2: 0.03, 3: 0.01, 4: 0.00, 5: 0.01},
        {"facility_frp_zscore": 35.0, "cluster_pixel_count": 6.0, "centroid_drift_velocity_mph": 310.0},
        0.9,
        CONFIG,
    )

    assert 0 <= low.total <= 100
    assert 0 <= high.total <= 100
    assert high.total > low.total


def test_plume_corridor_is_deterministic_with_fixed_seed() -> None:
    a = generate_plume_corridor((12.98, 74.84), 6.5, 135.0, CONFIG, seed=42)
    b = generate_plume_corridor((12.98, 74.84), 6.5, 135.0, CONFIG, seed=42)

    assert a.model_dump() == b.model_dump()
    assert len(a.cone90) == 5
