"""Serve precomputed burn/smoke masks as GeoJSON (math doc §10).

For the demo this reads curated polygons from the replay frame. A lightweight U-Net or
SegFormer can replace ``mask_from_context`` later without changing the API.
"""

from typing import Any


def mask_from_context(context: dict[str, Any]) -> tuple[dict[str, Any] | None, float | None, float | None]:
    """Return (GeoJSON FeatureCollection, burn area m2, smoke area m2)."""
    seg = context.get("segmentation")
    if not seg:
        return None, None, None

    # Curated coordinates are [lat, lon]; GeoJSON expects [lon, lat].
    rings = [
        [[lon, lat] for lat, lon in ring]
        for ring in seg.get("coordinates", [])
    ]
    feature_collection = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": seg.get("type", "Polygon"), "coordinates": rings},
                "properties": {"class": "thermal_or_smoke"},
            }
        ],
    }
    return feature_collection, seg.get("burnAreaM2"), seg.get("smokeAreaM2")
