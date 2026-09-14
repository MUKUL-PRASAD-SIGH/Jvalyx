"""recurrence_days_90d: same definition as the training stage, and honest about coverage."""

import math
from datetime import date, timedelta

import numpy as np
import pytest

from backend.pipeline import recurrence


@pytest.fixture(autouse=True)
def _tmp_history(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.setenv("JVALYX_FIRMS_HISTORY", str(tmp_path / "history.sqlite"))
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)


D = date(2026, 9, 1)
LAT, LON = 22.3612, 69.8533


def test_cell_matches_training_stage_formula() -> None:
    for lat, lon in [(LAT, LON), (30.0, 75.0), (11.999999, 76.0001), (23.75, 86.42)]:
        stage5 = int(np.floor(lat / 0.01).astype(np.int64) * 100_000 + np.floor(lon / 0.01).astype(np.int64))
        assert recurrence.cell_of(lat, lon) == stage5


def test_counts_distinct_earlier_days_in_window_only() -> None:
    recurrence.set_coverage(history_start=recurrence.day_of(D - timedelta(days=200)),
                            synced_through=recurrence.day_of(D))
    same_cell = (LAT + 0.001, LON + 0.001)
    recurrence.record_detections([
        (LAT, LON, D - timedelta(days=1)),
        (*same_cell, D - timedelta(days=1)),       # same day, same cell: counted once
        (LAT, LON, D - timedelta(days=90)),        # window edge: counted
        (LAT, LON, D - timedelta(days=91)),        # outside window
        (LAT, LON, D),                             # its own day: never counted
        (LAT, LON, D + timedelta(days=3)),         # future
        (LAT + 0.02, LON, D - timedelta(days=5)),  # neighbouring cell
    ])
    [(count, complete)] = recurrence.recurrence_days_batch([(LAT, LON, D)])
    assert count == 2 and complete


def test_incomplete_history_is_flagged() -> None:
    recurrence.record_detections([(LAT, LON, D - timedelta(days=3))])
    assert recurrence.recurrence_days_batch([(LAT, LON, D)]) == [(1, False)]  # no coverage recorded

    recurrence.set_coverage(history_start=recurrence.day_of(D - timedelta(days=30)),
                            synced_through=recurrence.day_of(D))
    assert recurrence.recurrence_days_batch([(LAT, LON, D)])[0][1] is False  # < 90 days back

    recurrence.set_coverage(history_start=recurrence.day_of(D - timedelta(days=120)))
    assert recurrence.recurrence_days_batch([(LAT, LON, D)])[0][1] is True
    assert recurrence.recurrence_days_batch([(LAT, LON, D + timedelta(days=5))])[0][1] is False  # not synced


def test_coverage_only_widens() -> None:
    recurrence.set_coverage(history_start=100, synced_through=200)
    recurrence.set_coverage(history_start=150, synced_through=180)
    assert recurrence.coverage() == (100, 200)


def test_batch_preserves_order_and_empty() -> None:
    assert recurrence.recurrence_days_batch([]) == []
    recurrence.record_detections([(LAT, LON, D - timedelta(days=d)) for d in range(1, 11)])
    out = recurrence.recurrence_days_batch([(10.0, 77.0, D), (LAT, LON, D), (LAT, LON, D - timedelta(days=5))])
    assert [c for c, _ in out] == [0, 10, 5]
    assert not math.isnan(out[0][0])
