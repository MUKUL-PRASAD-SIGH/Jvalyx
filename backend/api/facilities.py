"""Endpoints for industrial and mining spatial polygons."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.pipeline.polygons import (
    distance_to_industrial_m,
    get_industrial_index,
    is_in_industrial_polygon,
)

router = APIRouter(prefix="/api/facilities", tags=["facilities"])


@router.get("/industrial-polygons")
async def get_industrial_polygons() -> Any:
    """Return the full GeoJSON FeatureCollection of curated industrial and mining polygons."""
    index = get_industrial_index()
    raw = index.raw_geojson
    if not raw:
        return JSONResponse(content={"type": "FeatureCollection", "features": []})
    return JSONResponse(content=raw)


@router.get("/zones")
async def get_zones_summary() -> dict[str, Any]:
    """Return summary of all industrial & coal zones with polygon counts."""
    index = get_industrial_index()
    return {
        "zones": index.get_zones_summary(),
        "total_polygons": len(index.features),
    }


@router.get("/lookup")
async def lookup_coordinate(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lon: float = Query(..., description="Longitude in decimal degrees"),
) -> dict[str, Any]:
    """Check if (lat, lon) falls inside an industrial/mining polygon and return proximity."""
    in_poly, match = is_in_industrial_polygon(lat, lon)
    dist_m, nearest = distance_to_industrial_m(lat, lon)

    return {
        "latitude": lat,
        "longitude": lon,
        "is_in_industrial_polygon": in_poly,
        "matched_facility": match,
        "distance_to_nearest_industrial_m": round(dist_m, 1),
        "nearest_facility": nearest,
    }
