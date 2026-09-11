from pathlib import Path
from backend.pipeline.polygons import (
    IndustrialSpatialIndex,
    distance_to_industrial_m,
    get_industrial_index,
    is_in_industrial_polygon,
)


def test_spatial_index_loads():
    index = get_industrial_index()
    assert len(index.features) == 278
    assert len(index._indexed_rings) >= 278
    assert len(index._centroids) >= 200


def test_spatial_index_zones_summary():
    index = get_industrial_index()
    summary = index.get_zones_summary()
    assert "Raniganj_Coalfield_WB" in summary
    assert "Korba_Industrial_CG" in summary
    assert "Jharia_Coalfield_JH" in summary
    assert summary["Raniganj_Coalfield_WB"] >= 100


def test_point_in_polygon_korba():
    # Centroid of Korba mine feature
    in_poly, props = is_in_industrial_polygon(22.322, 82.732)
    assert in_poly is True
    assert props is not None
    assert props.get("coal_industrial_zone") == "Korba_Industrial_CG"


def test_point_outside_polygons():
    # Point in the middle of the Arabian Sea
    in_poly, props = is_in_industrial_polygon(15.0, 70.0)
    assert in_poly is False
    assert props is None

    # Distance should be large (> 500 km)
    dist, nearest = distance_to_industrial_m(15.0, 70.0)
    assert dist > 500_000


def test_query_speed():
    import time

    index = get_industrial_index()
    t0 = time.perf_counter()
    for _ in range(100):
        index.query_point(22.322, 82.732)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    avg_ms = elapsed_ms / 100
    # Average query time must be under 1ms
    assert avg_ms < 1.0, f"Average query took {avg_ms:.3f}ms, expected < 1ms"
