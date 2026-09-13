from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from backend.models import DataMode, Detection, FusedEvent, RouteState
from backend.models.schemas import ConfidenceState, DecisionOutput


def test_fused_event_uses_historical_replay_mode_by_default() -> None:
    detection = Detection(
        detection_id="det-001",
        sensor="REPLAY",
        timestamp=datetime(2026, 9, 4, tzinfo=UTC),
        latitude=19.0760,
        longitude=72.8777,
        frp_mw=10.0,
    )

    event = FusedEvent(
        event_id="evt-001",
        created_at=datetime(2026, 9, 4, tzinfo=UTC),
        latitude=19.0760,
        longitude=72.8777,
        detections=[detection],
        sensor_count=1,
    )

    assert event.mode is DataMode.HISTORICAL_REPLAY
    assert event.route_state is RouteState.UNCERTAIN


def test_decision_rejects_incomplete_probability_distribution() -> None:
    with pytest.raises(ValidationError, match="class_probabilities"):
        DecisionOutput(
            event_id="evt-001",
            class_id=1,
            class_name="Unusual Industrial Fire",
            class_probabilities={1: 0.8, 2: 0.2},
            anomaly_score=0.9,
            route_state=RouteState.CRITICAL,
            risk_score=90,
            confidence_state=ConfidenceState.HIGH,
            recommended_action="Assess the facility.",
        )
