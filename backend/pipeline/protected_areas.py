"""Major fire-relevant protected areas in India (approx. centroid + radius).

Ported from ``frontend/src/firms/config/protectedAreas.ts`` so the live triage endpoint
can give the model a real, trained-vocabulary land-cover signal (ESA WorldCover
``lulc_class="10"``, tree cover) for points inside a known forest/reserve boundary,
instead of always falling into the unknown-category bucket — demo fidelity, not a WDPA
boundary dataset; swap for the real thing when available.
"""

from __future__ import annotations

from .polygons import haversine_m


class ProtectedArea:
    __slots__ = ("id", "name", "category", "lat", "lon", "radius_km")

    def __init__(self, id: str, name: str, category: str, lat: float, lon: float, radius_km: float) -> None:
        self.id = id
        self.name = name
        self.category = category
        self.lat = lat
        self.lon = lon
        self.radius_km = radius_km


PROTECTED_AREAS: list[ProtectedArea] = [
    ProtectedArea("similipal", "Similipal", "Biosphere Reserve", 21.62, 86.40, 45),
    ProtectedArea("kanha", "Kanha", "Tiger Reserve", 22.33, 80.61, 40),
    ProtectedArea("bandhavgarh", "Bandhavgarh", "Tiger Reserve", 23.70, 81.03, 28),
    ProtectedArea("pench", "Pench", "Tiger Reserve", 21.67, 79.29, 25),
    ProtectedArea("nagarhole", "Nagarhole", "National Park", 12.00, 76.13, 26),
    ProtectedArea("bandipur", "Bandipur", "Tiger Reserve", 11.71, 76.53, 24),
    ProtectedArea("periyar", "Periyar", "Tiger Reserve", 9.47, 77.24, 24),
    ProtectedArea("satpura", "Satpura", "Tiger Reserve", 22.50, 78.43, 35),
    ProtectedArea("kaziranga", "Kaziranga", "National Park", 26.58, 93.17, 22),
    ProtectedArea("namdapha", "Namdapha", "National Park", 27.50, 96.40, 32),
    ProtectedArea("ranthambore", "Ranthambore", "Tiger Reserve", 26.02, 76.50, 22),
    ProtectedArea("gir", "Gir", "National Park", 21.13, 70.80, 26),
    ProtectedArea("sunabeda", "Sunabeda", "Wildlife Sanctuary", 20.10, 82.30, 20),
    ProtectedArea("palamau", "Palamau", "Tiger Reserve", 23.62, 84.05, 24),
    ProtectedArea("melghat", "Melghat", "Tiger Reserve", 21.45, 77.20, 30),
]


def find_protected_area(lat: float, lon: float) -> ProtectedArea | None:
    """Return the first protected area whose radius contains (lat, lon), if any."""
    for area in PROTECTED_AREAS:
        if haversine_m(lat, lon, area.lat, area.lon) <= area.radius_km * 1000:
            return area
    return None
