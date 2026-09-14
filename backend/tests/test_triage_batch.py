"""Batch live triage and the persistent land-cover cache."""

from datetime import datetime, timezone

import pytest

from backend.api.triage import LiveDetectionIn, classify_detections
from backend.pipeline import landcover


def _item(i: int, lat: float, lon: float, frp: float = 12.0) -> LiveDetectionIn:
    return LiveDetectionIn(
        id=f"det-{i}", latitude=lat, longitude=lon, brightness=330.0, brightness_secondary=295.0,
        frp=frp, confidence_level="nominal", daynight="D",
        acquired_at=datetime(2026, 10, 15, 8, 0, tzinfo=timezone.utc),
    )


POINTS = [(15.0, 68.0), (30.62, 75.41), (11.66, 76.63), (23.75, 86.42), (22.36, 69.85)]


@pytest.fixture(autouse=True)
def _no_remote_landcover(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.setenv("JVALYX_LIVE_LULC", "0")
    monkeypatch.setenv("JVALYX_FIRMS_HISTORY", str(tmp_path / "history.sqlite"))
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)


def test_missing_history_routes_uncertain_and_reports_it() -> None:
    [result] = classify_detections([_item(0, 30.62, 75.41)])
    assert result.history_complete is False
    assert result.route_state == "UNCERTAIN"


def test_batch_returns_one_result_per_detection_in_order() -> None:
    items = [_item(i, lat, lon) for i, (lat, lon) in enumerate(POINTS)]
    results = classify_detections(items)
    assert [r.id for r in results] == [item.id for item in items]
    for r in results:
        assert set(r.class_probabilities) == {1, 2, 3, 4, 5}
        assert abs(sum(r.class_probabilities.values()) - 1.0) < 1e-6


def test_batch_and_single_classification_agree() -> None:
    items = [_item(i, lat, lon, frp=5.0 + 7 * i) for i, (lat, lon) in enumerate(POINTS)]
    batch = classify_detections(items)
    for item, from_batch in zip(items, batch):
        single = classify_detections([item])[0]
        assert single.class_id == from_batch.class_id
        assert single.route_state == from_batch.route_state
        for k in range(1, 6):
            assert single.class_probabilities[k] == pytest.approx(from_batch.class_probabilities[k], abs=1e-9)


def test_empty_batch() -> None:
    assert classify_detections([]) == []


def test_landcover_cache_fetches_each_cell_once_and_persists(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.setenv("JVALYX_LIVE_LULC", "1")
    monkeypatch.setenv("JVALYX_LANDCOVER_CACHE", str(tmp_path / "lc.sqlite"))
    calls: list[tuple[int, int]] = []

    def fake_fetch(key):
        calls.append(key)
        return ("40", 0.5) if key[0] > 20_000 else None  # southern cells "unreachable"

    monkeypatch.setattr(landcover, "_fetch_cell", fake_fetch)
    pts = [(30.62, 75.41), (30.6201, 75.4101), (25.0, 80.0), (12.0, 77.0)]  # first two share a cell

    first = landcover.lookup_landcover_batch(pts)
    assert first == [("40", 0.5), ("40", 0.5), ("40", 0.5), (None, 0.0)]
    assert len(calls) == 3  # 3 distinct cells

    calls.clear()
    assert landcover.lookup_landcover_batch(pts) == first
    assert calls == [cell_key_south := landcover.cell_key(12.0, 77.0)]  # only the failed cell retried

    # A fresh cache object over the same file sees the persisted values.
    landcover._caches.clear()
    calls.clear()
    assert landcover.lookup_landcover(25.0, 80.0) == ("40", 0.5)
    assert calls == []
    assert cell_key_south == (12000, 77000)
