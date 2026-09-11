"""Weather endpoint for Open-Meteo live atmospheric data."""

from fastapi import APIRouter, Query
from backend.pipeline.weather import get_live_weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("")
async def get_weather(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> dict:
    """Fetch live meteorological and plume wind vectors from Open-Meteo."""
    return await get_live_weather(lat, lon)
