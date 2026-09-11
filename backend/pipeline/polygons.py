"""Spatial indexing and point-in-polygon queries for Indian industrial and mining polygons.

Provides sub-millisecond point-in-polygon matching against curated industrial, coalfield,
steel plant, and power station boundaries in India without requiring C-library GIS dependencies.
"""

from __future__ import annotations

import json
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).parents[2] / "data" / "polygons" / "india_industrial_polygons_tagged.geojson"
EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * atan2(sqrt(a), sqrt(1 - a))


def _point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    """Standard ray-casting algorithm for a point in a polygon ring."""
    n = len(ring)
    inside = False
    if n < 3:
        return False
    p1x, p1y = ring[0][0], ring[0][1]
    for i in range(1, n + 1):
        p2x, p2y = ring[i % n][0], ring[i % n][1]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


class IndustrialSpatialIndex:
    """In-memory spatial index with bounding-box prefiltering."""

    def __init__(self, geojson_path: Path | str | None = None) -> None:
        self.path = Path(geojson_path) if geojson_path else DATA_PATH
        self.features: list[dict[str, Any]] = []
        self._indexed_rings: list[tuple[float, float, float, float, list[list[float]], dict[str, Any]]] = []
        self._centroids: list[tuple[float, float, dict[str, Any]]] = []
        self._raw_geojson: dict[str, Any] | None = None
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return

        with open(self.path, encoding="utf-8") as f:
            data = json.load(f)

        self._raw_geojson = data
        self.features = data.get("features", [])

        for feat in self.features:
            geom = feat.get("geometry")
            if not geom:
                continue

            props = feat.get("properties", {})
            gtype = geom.get("type")
            coords = geom.get("coordinates", [])

            # Extract centroid if available
            c_lat = props.get("centroid_lat")
            c_lon = props.get("centroid_lon")
            if c_lat is not None and c_lon is not None:
                self._centroids.append((float(c_lat), float(c_lon), props))

            rings: list[list[list[float]]] = []
            if gtype == "Polygon" and coords:
                rings.append(coords[0])  # outer boundary
            elif gtype == "MultiPolygon" and coords:
                for poly in coords:
                    if poly:
                        rings.append(poly[0])  # outer boundary of each polygon

            for ring in rings:
                if len(ring) < 3:
                    continue
                xs = [pt[0] for pt in ring]
                ys = [pt[1] for pt in ring]
                min_x, max_x = min(xs), max(xs)
                min_y, max_y = min(ys), max(ys)
                self._indexed_rings.append((min_x, min_y, max_x, max_y, ring, props))

    @property
    def raw_geojson(self) -> dict[str, Any] | None:
        return self._raw_geojson

    def query_point(self, lat: float, lon: float) -> dict[str, Any] | None:
        """Return the properties dict of the first polygon containing (lat, lon), or None."""
        for min_x, min_y, max_x, max_y, ring, props in self._indexed_rings:
            if min_x <= lon <= max_x and min_y <= lat <= max_y:
                if _point_in_ring(lon, lat, ring):
                    return props
        return None

    def distance_to_nearest_m(self, lat: float, lon: float) -> tuple[float, dict[str, Any] | None]:
        """Compute approximate distance in meters to nearest centroid/boundary."""
        if not self._centroids:
            return float("inf"), None

        # If inside, distance is 0.0
        inside_match = self.query_point(lat, lon)
        if inside_match:
            return 0.0, inside_match

        min_dist = float("inf")
        best_match: dict[str, Any] | None = None

        for c_lat, c_lon, props in self._centroids:
            d = haversine_m(lat, lon, c_lat, c_lon)
            if d < min_dist:
                min_dist = d
                best_match = props

        return min_dist, best_match

    def get_zones_summary(self) -> dict[str, int]:
        summary: dict[str, int] = {}
        for feat in self.features:
            props = feat.get("properties", {})
            zone = props.get("coal_industrial_zone") or "Other"
            summary[zone] = summary.get(zone, 0) + 1
        return summary


# Process-wide singleton
_INDEX: IndustrialSpatialIndex | None = None


def get_industrial_index() -> IndustrialSpatialIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = IndustrialSpatialIndex()
    return _INDEX


def is_in_industrial_polygon(lat: float, lon: float) -> tuple[bool, dict[str, Any] | None]:
    index = get_industrial_index()
    match = index.query_point(lat, lon)
    return match is not None, match


def distance_to_industrial_m(lat: float, lon: float) -> tuple[float, dict[str, Any] | None]:
    index = get_industrial_index()
    return index.distance_to_nearest_m(lat, lon)
