"""Golden-scenario expectations: stable route + risk + evidence per replay pack.

These validate the deterministic pipeline independent of any trained model.
"""

import pytest

from backend.pipeline import ScenarioCatalog, process_frame

CATALOG = ScenarioCatalog()

REQUIRED_EVIDENCE_CATEGORIES = {"thermal", "context", "temporal", "decision"}


def _run(scenario_id: str, frame_index: int):
    return process_frame(CATALOG.get(scenario_id), frame_index)


def test_industrial_escalation_transitions_normal_to_critical() -> None:
    before = _run("industrial_escalation", 0)
    at_anomaly = _run("industrial_escalation", 1)
    uncertain = _run("industrial_escalation", 2)
    critical = _run("industrial_escalation", 3)

    assert before.route_state.value == "NORMAL"
    assert at_anomaly.route_state.value == "NORMAL"
    assert uncertain.route_state.value == "UNCERTAIN"
    assert critical.route_state.value == "CRITICAL"
    assert critical.decision.class_id == 1
    assert critical.risk.total >= 70
    assert critical.tactical is not None
    assert critical.tactical.plume_corridor is not None
    assert {card.category for card in critical.evidence} == REQUIRED_EVIDENCE_CATEGORIES


def test_persistent_flare_stays_normal_low_risk() -> None:
    frame = _run("persistent_flare", 0)

    assert frame.route_state.value == "NORMAL"
    assert frame.decision.class_id == 5
    assert frame.risk.total < 30


def test_wildfire_is_critical_class_two() -> None:
    frame = _run("wildfire", 0)

    assert frame.route_state.value == "CRITICAL"
    assert frame.decision.class_id == 2
    assert frame.tactical is not None and frame.tactical.plume_corridor is not None


def test_sensor_disagreement_routes_to_uncertain() -> None:
    frame = _run("sensor_disagreement", 0)

    assert frame.route_state.value == "UNCERTAIN"
    decision_card = next(c for c in frame.evidence if c.category == "decision")
    assert "disagreement" in decision_card.metrics["Routing rule"].lower()


@pytest.mark.parametrize("scenario_id", ["industrial_escalation", "persistent_flare", "wildfire", "sensor_disagreement"])
def test_every_frame_produces_valid_probability_distribution(scenario_id: str) -> None:
    scenario = CATALOG.get(scenario_id)
    for index in range(len(scenario.frames)):
        intel = process_frame(scenario, index)
        probs = intel.decision.class_probabilities
        assert set(probs) == {1, 2, 3, 4, 5}
        assert abs(sum(probs.values()) - 1.0) < 1e-6


def test_counterfactual_slider_drives_escalation() -> None:
    normal = process_frame(CATALOG.get("industrial_escalation"), 0, deviation=0.0)
    surged = process_frame(CATALOG.get("industrial_escalation"), 0, deviation=1.0)

    assert normal.route_state.value == "NORMAL"
    assert surged.route_state.value == "CRITICAL"
    assert surged.mode.value == "DEMO SIMULATION MODE"
    assert surged.risk.total > normal.risk.total
