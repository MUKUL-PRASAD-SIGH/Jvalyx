"""Industrial-polygon model features, computed exactly the way the training data was built.

The classifier learned ``is_in_industrial_polygon``, ``distance_to_industrial_m`` and
``facility_type`` from ``data/training/_stage2_polygon_join.py``, which used the full OSM
industrial export (~27k polygons, now ``data/polygons/india_osm_industrial_training.geojson``)
and measured distance to the polygon *edge*. The curated set in ``polygons.py`` (~278
polygons, distance to *centroid*) is a different map: feeding it to the model put e.g.
Jamnagar refinery 1,073 km from any industry. Use this module for model inputs; keep
``polygons.py`` for human-readable facility and coal-zone names.
"""

from __future__ import annotations

import json
import math
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).parents[2] / "data" / "polygons" / "india_osm_industrial_training.geojson"
M_PER_DEG = 111320.0


def classify_facility(props: dict[str, Any]) -> str:
    """OSM tags -> facility_type. Must stay identical to ``_stage2_polygon_join.classify_facility``."""
    industrial = str(props.get("industrial") or "").lower()
    landuse = str(props.get("landuse") or "").lower()
    power = str(props.get("power") or "").lower()
    if industrial == "mine" or landuse == "quarry":
        return "mine_quarry"
    if power in ("plant", "generator"):
        return "power_plant"
    if industrial in ("brickyard", "brickworks"):
        return "brickworks"
    if industrial == "factory":
        return "factory"
    if industrial in ("depot", "warehouse", "port", "scrap_yard", "slaughterhouse"):
        return "other_infrastructure"
    return "general_industrial"


@dataclass(frozen=True)
class PolygonFeatures:
    is_in_industrial_polygon: bool
    distance_to_industrial_m: float
    facility_type: str
    #: Name of the containing polygon, or of the nearest one when outside (OSM, often unnamed).
    name: str | None


class TrainingPolygonIndex:
    def __init__(self, path: Path = DATA_PATH) -> None:
        from shapely.geometry import shape
        from shapely.strtree import STRtree

        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self._geoms: list[Any] = []
        self._props: list[dict[str, Any]] = []
        for feat in data["features"]:
            geom = feat.get("geometry")
            if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
                continue
            try:
                g = shape(geom)
                if g.is_empty or not g.is_valid:
                    g = g.buffer(0)
            except Exception:  # noqa: BLE001 - same skip rule as the training join
                continue
            if g.is_empty:
                continue
            self._geoms.append(g)
            self._props.append(feat.get("properties") or {})
        self._facility = [classify_facility(p) for p in self._props]
        self._tree = STRtree(self._geoms)

    def __len__(self) -> int:
        return len(self._geoms)

    def features(self, lat: float, lon: float) -> PolygonFeatures:
        from shapely.geometry import Point

        pt = Point(lon, lat)
        inside = self._tree.query(pt, predicate="within")
        if len(inside):
            i = int(min(inside))  # training kept the lowest-index match
            return PolygonFeatures(True, 0.0, self._facility[i], self._props[i].get("name"))
        i = int(self._tree.nearest(pt))
        # Same degrees -> metres approximation as the training join.
        meters = pt.distance(self._geoms[i]) * M_PER_DEG * math.cos(math.radians(lat))
        return PolygonFeatures(False, meters, "none", self._props[i].get("name"))


_INDEX: TrainingPolygonIndex | None = None
_LOCK = threading.Lock()


def get_training_polygon_index() -> TrainingPolygonIndex:
    global _INDEX
    if _INDEX is None:
        with _LOCK:
            if _INDEX is None:
                _INDEX = TrainingPolygonIndex()
    return _INDEX


def training_polygon_features(lat: float, lon: float) -> PolygonFeatures:
    return get_training_polygon_index().features(lat, lon)
