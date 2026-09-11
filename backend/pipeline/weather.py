"""Live weather & atmospheric data service via Open-Meteo.

Queries Open-Meteo's keyless API for real-time wind speed, wind direction,
gusts, and temperature to drive the plume probability corridor.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
_CACHE_TTL_SEC = 300.0  # 5 minutes
_WEATHER_CACHE: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}


def _deg_to_cardinal(deg: float) -> str:
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    index = round((deg % 360) / 22.5) % 16
    return directions[index]


async def get_live_weather(lat: float, lon: float, timeout: float = 5.0) -> dict[str, Any]:
    """Fetch current wind and atmospheric conditions from Open-Meteo."""
    grid_key = (round(lat, 2), round(lon, 2))
    now = time.time()

    if grid_key in _WEATHER_CACHE:
        cached_time, cached_data = _WEATHER_CACHE[grid_key]
        if now - cached_time < _CACHE_TTL_SEC:
            return cached_data

    url = (
        f"{OPEN_METEO_BASE}?latitude={lat:.4f}&longitude={lon:.4f}"
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
        "&wind_speed_unit=ms"
    )

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning("Open-Meteo returned status %d", resp.status_code)
                return _fallback_weather(lat, lon)
            data = resp.json().get("current", {})

            wind_met = float(data.get("wind_direction_10m", 0.0))
            # Meteorological direction is where wind comes FROM.
            # Advection direction is where wind moves TOWARDS (+180°).
            advection_deg = (wind_met + 180.0) % 360.0

            result = {
                "latitude": lat,
                "longitude": lon,
                "temperature_c": float(data.get("temperature_2m", 25.0)),
                "relative_humidity_pct": float(data.get("relative_humidity_2m", 50.0)),
                "wind_speed_mps": float(data.get("wind_speed_10m", 5.0)),
                "wind_direction_deg": round(advection_deg, 1),
                "wind_direction_met_deg": round(wind_met, 1),
                "wind_gusts_mps": float(data.get("wind_gusts_10m", data.get("wind_speed_10m", 6.0))),
                "cardinal": _deg_to_cardinal(advection_deg),
                "source": "Open-Meteo (Live ECMWF/GFS)",
            }
            _WEATHER_CACHE[grid_key] = (now, result)
            return result
    except Exception as exc:
        logger.warning("Failed to fetch live weather from Open-Meteo: %s", exc)
        return _fallback_weather(lat, lon)


def _fallback_weather(lat: float, lon: float) -> dict[str, Any]:
    return {
        "latitude": lat,
        "longitude": lon,
        "temperature_c": 28.0,
        "relative_humidity_pct": 65.0,
        "wind_speed_mps": 6.0,
        "wind_direction_deg": 135.0,
        "wind_direction_met_deg": 315.0,
        "wind_gusts_mps": 9.0,
        "cardinal": "SE",
        "source": "Default Historical Baseline",
    }
