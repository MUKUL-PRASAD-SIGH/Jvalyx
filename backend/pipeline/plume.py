"""Monte Carlo downwind probability corridor (math doc §11).

This is advection visualisation, not a validated Gaussian plume or dose model. The
output is labelled a *probability corridor* everywhere it is shown.
"""

import math
import random

from backend.config import AppConfig
from backend.models.intelligence import PlumeCorridor

_KM_PER_DEG = 111.0


def _project(lat0: float, lon0: float, dist_km: float, bearing_deg: float) -> tuple[float, float]:
    rad = math.radians(bearing_deg)
    d_lat = (dist_km * math.cos(rad)) / _KM_PER_DEG
    d_lon = (dist_km * math.sin(rad)) / (_KM_PER_DEG * math.cos(math.radians(lat0)))
    return (round(lat0 + d_lat, 6), round(lon0 + d_lon, 6))


def generate_plume_corridor(
    origin: tuple[float, float],
    wind_speed_mps: float,
    wind_direction_deg: float,
    config: AppConfig,
    *,
    seed: int | None = 42,
) -> PlumeCorridor:
    """``wind_direction_deg`` is the direction the wind travels *toward*."""
    lat0, lon0 = origin
    rng = random.Random(seed)
    cfg = config.plume

    base_dist_km = max(1.5, wind_speed_mps * 0.4)
    endpoints: list[tuple[float, float]] = []
    for _ in range(cfg.monte_carlo_samples):
        speed = max(0.5, rng.gauss(wind_speed_mps, cfg.speed_sigma_mps))
        direction = rng.gauss(wind_direction_deg, cfg.direction_sigma_deg) % 360
        endpoints.append(_project(lat0, lon0, max(1.0, speed * 0.4), direction))

    def _pct(values: list[float], q: float) -> float:
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, int(q * len(ordered)))]

    # Angular half-width of the corridor derived from the sampled bearing spread.
    bearings = [
        (math.degrees(math.atan2(lon - lon0, lat - lat0)) - wind_direction_deg + 180) % 360 - 180
        for lat, lon in endpoints
    ]
    half90 = max(12.0, (_pct(bearings, 0.95) - _pct(bearings, 0.05)) / 2)
    half50 = max(6.0, half90 * 0.5)

    center = _project(lat0, lon0, base_dist_km, wind_direction_deg)
    left90 = _project(lat0, lon0, base_dist_km * 1.15, wind_direction_deg - half90)
    right90 = _project(lat0, lon0, base_dist_km * 1.15, wind_direction_deg + half90)
    left50 = _project(lat0, lon0, base_dist_km * 1.05, wind_direction_deg - half50)
    right50 = _project(lat0, lon0, base_dist_km * 1.05, wind_direction_deg + half50)

    return PlumeCorridor(
        centerline=[(lat0, lon0), center],
        cone90=[(lat0, lon0), left90, center, right90, (lat0, lon0)],
        cone50=[(lat0, lon0), left50, center, right50, (lat0, lon0)],
        wind_speed_mps=wind_speed_mps,
        wind_direction_deg=wind_direction_deg,
    )
