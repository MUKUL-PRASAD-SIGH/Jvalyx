"""An unusual-industrial-fire call on water land cover is verified, never auto-escalated."""

from backend.config import load_config
from backend.models import RouteState, SensorAgreementState
from backend.pipeline.arbitration import arbitrate, which_rule_fired

C1 = {1: 0.97, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.03}
C5 = {1: 0.02, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.98}
FEATURES = {"data_quality_score": 0.9}
AGREE = SensorAgreementState.SINGLE_SENSOR if hasattr(SensorAgreementState, "SINGLE_SENSOR") else list(SensorAgreementState)[0]


def _route(probs, on_water):
    return arbitrate(probs, 0.3, FEATURES, AGREE, load_config(), on_water=on_water)


def test_c1_on_water_is_uncertain_not_critical() -> None:
    assert _route(C1, on_water=False) is RouteState.CRITICAL
    assert _route(C1, on_water=True) is RouteState.UNCERTAIN
    assert "water" in which_rule_fired(C1, 0.3, FEATURES, AGREE, load_config(), on_water=True)


def test_routine_heat_on_water_is_unaffected() -> None:
    assert _route(C5, on_water=True) is _route(C5, on_water=False)
