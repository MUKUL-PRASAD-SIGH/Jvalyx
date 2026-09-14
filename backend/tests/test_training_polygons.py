"""Model polygon features must be computed the same way as the training join."""

import sys
from pathlib import Path

import pytest

from backend.pipeline.training_polygons import classify_facility, get_training_polygon_index

TRAINING_DIR = Path(__file__).parents[2] / "data" / "training"


def test_index_loads_the_full_osm_export() -> None:
    assert len(get_training_polygon_index()) > 25_000


def test_point_inside_a_polygon_has_zero_distance_and_a_facility() -> None:
    index = get_training_polygon_index()
    probe = index._geoms[0].representative_point()  # noqa: SLF001
    feats = index.features(probe.y, probe.x)
    assert feats.is_in_industrial_polygon
    assert feats.distance_to_industrial_m == 0.0
    assert feats.facility_type != "none"


def test_point_outside_gets_finite_edge_distance_and_no_facility() -> None:
    feats = get_training_polygon_index().features(15.0, 68.0)  # Arabian Sea
    assert not feats.is_in_industrial_polygon
    assert feats.facility_type == "none"
    assert 0.0 < feats.distance_to_industrial_m < 2_000_000.0


@pytest.mark.parametrize(
    "props",
    [
        {"industrial": "mine"}, {"landuse": "quarry"}, {"power": "plant"}, {"power": "generator"},
        {"industrial": "brickworks"}, {"industrial": "factory"}, {"industrial": "port"},
        {"landuse": "industrial"}, {},
    ],
)
def test_facility_mapping_matches_training_labeler(props: dict) -> None:
    script = TRAINING_DIR / "_stage2_polygon_join.py"
    if not script.exists():
        pytest.skip("training scripts not present")
    sys.path.insert(0, str(TRAINING_DIR))
    try:
        from _stage2_polygon_join import classify_facility as training_classify
    finally:
        sys.path.remove(str(TRAINING_DIR))
    assert classify_facility(props) == training_classify(props)
