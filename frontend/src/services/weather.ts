/**
 * Live Meteorological Weather & Wind Service via Open-Meteo.
 *
 * Open-Meteo provides keyless, CORS-enabled forecast models (ECMWF / GFS).
 * Used to feed live wind speed and advection bearings into plume dispersion modeling.
 */

export interface LiveWeatherData {
  latitude: number;
  longitude: number;
  temperatureC: number;
  relativeHumidityPct: number;
  windSpeedMps: number;
  /** Bearing in degrees (0-360) TOWARDS which the wind travels (advection direction). */
  windDirectionDeg: number;
  /** Bearing in degrees (0-360) from which wind originates (standard meteorological convention). */
  windDirectionMetDeg: number;
  windGustsMps: number;
  cardinal: string;
  source: string;
  fetchedAt: Date;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const weatherCache = new Map<string, { data: LiveWeatherData; expiresAt: number }>();

function degToCardinal(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) / 22.5)) % 16;
  return directions[index];
}

export async function fetchLiveWeather(lat: number, lon: number): Promise<LiveWeatherData> {
  // Approximate grid key (~5km resolution) to avoid redundant HTTP requests
  const gridKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = weatherCache.get(gridKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo API returned HTTP ${res.status}`);
    }
    const json = await res.json();
    const cur = json.current;

    const windMet = typeof cur.wind_direction_10m === 'number' ? cur.wind_direction_10m : 0;
    // In meteorology, windDirection is direction FROM which wind blows.
    // For plume advection, we want the direction TOWARD which wind blows.
    const advectionDir = (windMet + 180) % 360;

    const result: LiveWeatherData = {
      latitude: lat,
      longitude: lon,
      temperatureC: Number(cur.temperature_2m ?? 25),
      relativeHumidityPct: Number(cur.relative_humidity_2m ?? 50),
      windSpeedMps: Number(cur.wind_speed_10m ?? 5.0),
      windDirectionDeg: Number(advectionDir.toFixed(1)),
      windDirectionMetDeg: Number(windMet.toFixed(1)),
      windGustsMps: Number(cur.wind_gusts_10m ?? cur.wind_speed_10m ?? 6.0),
      cardinal: degToCardinal(advectionDir),
      source: 'Open-Meteo (Live ECMWF/GFS)',
      fetchedAt: new Date(),
    };

    weatherCache.set(gridKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('[weather] Open-Meteo fetch failed, using fallback:', err);
    // Return standard fallback if network or rate-limit
    return {
      latitude: lat,
      longitude: lon,
      temperatureC: 28,
      relativeHumidityPct: 65,
      windSpeedMps: 6.0,
      windDirectionDeg: 135,
      windDirectionMetDeg: 315,
      windGustsMps: 9.0,
      cardinal: 'SE',
      source: 'Standard Default Fallback',
      fetchedAt: new Date(),
    };
  }
}
