"""Live ESA WorldCover land-cover lookup + the one hard land-cover rule over class probabilities.

Two jobs:

1. ``lookup_landcover`` / ``lookup_landcover_batch`` return the WorldCover 2021 v200 code and
   the Shannon entropy of the 500 m neighbourhood — the same features the training pipeline
   computed (``data/training/_stage3_worldcover.py``) — for ~110 m cells (0.001 degrees).
   Tiles downloaded by ``backend/tools/download_worldcover.py`` are read from disk; otherwise
   fetching one cell from the remote COGs takes ~0.3-0.6 s, so results live in a persistent
   SQLite cache (``data/live_cache/landcover_cache.sqlite``, seeded from the training
   detections by ``backend/tools/build_landcover_cache.py``): a cell is fetched from S3 at
   most once, and batch misses are fetched in parallel. Open ocean has no WorldCover tile
   (S3 answers 404) and is reported as water (80); a network failure is ``None`` (unknown),
   never silently water, and is not cached.

2. ``apply_landcover_rules(probs, lulc_code)`` applies the one hard physical constraint on
   top of the model: on water (80) or snow/ice (70), wildfire (C2), mining fire (C3) and
   stubble burning (C4) are set to zero and the rest renormalized. Nothing is boosted and
   no other land cover changes the model's output.
"""

from __future__ import annotations

import logging
import math
import os
import sqlite3
import threading
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

logger = logging.getLogger(__name__)

WORLDCOVER_BASE_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
DEFAULT_CACHE_PATH = Path(__file__).parents[2] / "data" / "live_cache" / "landcover_cache.sqlite"
#: Downloaded tiles (backend/tools/download_worldcover.py); read instead of S3 when present.
DEFAULT_WORLDCOVER_DIR = Path(__file__).parents[2] / "data" / "live_cache" / "worldcover"

WATER = "80"
SNOW_ICE = "70"
NO_LAND_FIRE = frozenset({WATER, SNOW_ICE})

NEIGHBOURHOOD_RADIUS_M = 500.0
PIXEL_M = 10.0
#: A water centre pixel only counts as water when the 500 m neighbourhood is mostly water;
#: otherwise the 375 m FIRMS pixel is on a coastline/riverbank and the dominant land class wins.
MIN_WATER_FRACTION = 0.5
#: Cells are keyed by round(degrees * CELL_SCALE): 0.001 degrees, ~110 m.
CELL_SCALE = 1000

# GDAL reads the COGs anonymously over HTTP range requests.
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("VSI_CACHE", "TRUE")

_tile_exists_cache: dict[str, bool] = {}

CellKey = tuple[int, int]
LandcoverValue = tuple[str, float]


def _enabled() -> bool:
    return os.getenv("JVALYX_LIVE_LULC", "1").strip().lower() not in ("0", "false", "off")


def _max_workers() -> int:
    return max(1, int(os.getenv("JVALYX_LULC_WORKERS", "16")))


def cache_path() -> Path:
    return Path(os.getenv("JVALYX_LANDCOVER_CACHE", str(DEFAULT_CACHE_PATH)))


def cell_key(lat: float, lon: float) -> CellKey:
    return round(lat * CELL_SCALE), round(lon * CELL_SCALE)


def open_cache_db(path: Path | None = None) -> sqlite3.Connection:
    """Open (creating if needed) the land-cover cache database."""
    path = path or cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS landcover ("
        " lat_key INTEGER NOT NULL, lon_key INTEGER NOT NULL,"
        " code TEXT NOT NULL, entropy REAL NOT NULL, source TEXT NOT NULL,"
        " PRIMARY KEY (lat_key, lon_key)) WITHOUT ROWID"
    )
    return conn


class LandcoverCache:
    """In-memory map over a persistent SQLite table. Degrades to memory-only if SQLite fails."""

    _QUERY_CHUNK = 400  # 2 bound parameters per key, under SQLite's 999 limit

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._memory: dict[CellKey, LandcoverValue] = {}
        self._conn: sqlite3.Connection | None = None
        self._db_failed = False

    def _db(self) -> sqlite3.Connection | None:
        if self._conn is None and not self._db_failed:
            try:
                self._conn = open_cache_db(self._path)
            except sqlite3.Error as exc:
                logger.warning("Land-cover cache DB unavailable (%s); using memory only", exc)
                self._db_failed = True
        return self._conn

    def get_many(self, keys: list[CellKey]) -> dict[CellKey, LandcoverValue]:
        found = {k: self._memory[k] for k in keys if k in self._memory}
        missing = [k for k in keys if k not in found]
        if not missing:
            return found
        with self._lock:
            conn = self._db()
            if conn is None:
                return found
            try:
                for i in range(0, len(missing), self._QUERY_CHUNK):
                    chunk = missing[i : i + self._QUERY_CHUNK]
                    placeholders = ",".join("(?,?)" for _ in chunk)
                    params = [v for key in chunk for v in key]
                    rows = conn.execute(
                        "SELECT lat_key, lon_key, code, entropy FROM landcover"
                        f" WHERE (lat_key, lon_key) IN (VALUES {placeholders})",
                        params,
                    ).fetchall()
                    for lat_key, lon_key, code, entropy in rows:
                        value = (str(code), float(entropy))
                        self._memory[(lat_key, lon_key)] = value
                        found[(lat_key, lon_key)] = value
            except sqlite3.Error as exc:
                logger.warning("Land-cover cache read failed: %s", exc)
        return found

    def put_many(self, values: dict[CellKey, LandcoverValue], source: str = "live") -> None:
        if not values:
            return
        self._memory.update(values)
        with self._lock:
            conn = self._db()
            if conn is None:
                return
            try:
                conn.executemany(
                    "INSERT OR REPLACE INTO landcover (lat_key, lon_key, code, entropy, source)"
                    " VALUES (?, ?, ?, ?, ?)",
                    [(k[0], k[1], v[0], v[1], source) for k, v in values.items()],
                )
                conn.commit()
            except sqlite3.Error as exc:
                logger.warning("Land-cover cache write failed: %s", exc)


_caches: dict[str, LandcoverCache] = {}
_caches_lock = threading.Lock()


def get_cache() -> LandcoverCache:
    path = cache_path()
    with _caches_lock:
        if str(path) not in _caches:
            _caches[str(path)] = LandcoverCache(path)
        return _caches[str(path)]


def tile_name_for(lat: float, lon: float) -> str:
    tlat = int(math.floor(lat / 3.0) * 3)
    tlon = int(math.floor(lon / 3.0) * 3)
    ns = "N" if tlat >= 0 else "S"
    ew = "E" if tlon >= 0 else "W"
    return f"{ns}{abs(tlat):02d}{ew}{abs(tlon):03d}"


def _tile_url(tile: str) -> str:
    return f"{WORLDCOVER_BASE_URL}ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"


def _tile_exists(tile: str) -> bool | None:
    """True/False from S3, None when the answer couldn't be determined (network error)."""
    if tile in _tile_exists_cache:
        return _tile_exists_cache[tile]
    request = urllib.request.Request(_tile_url(tile), method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=5):
            exists = True
    except urllib.error.HTTPError as exc:
        if exc.code not in (403, 404):
            return None
        exists = False
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    _tile_exists_cache[tile] = exists
    return exists


def _shannon_entropy(values: list[int]) -> float:
    counts = Counter(values)
    total = sum(counts.values())
    return float(-sum((c / total) * math.log2(c / total) for c in counts.values()))


def worldcover_dir() -> Path:
    return Path(os.getenv("JVALYX_WORLDCOVER_DIR", str(DEFAULT_WORLDCOVER_DIR)))


def local_tile_path(tile: str) -> Path:
    return worldcover_dir() / f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"


def _fetch_cell(key: CellKey) -> LandcoverValue | None:
    """Read one cell from WorldCover: the downloaded tile if present, else the remote COG.
    None on any failure (not cached)."""
    lat, lon = key[0] / CELL_SCALE, key[1] / CELL_SCALE
    tile = tile_name_for(lat, lon)
    local = local_tile_path(tile)
    if local.exists():
        source = str(local)
    else:
        exists = _tile_exists(tile)
        if exists is None:
            return None
        if not exists:
            return WATER, 0.0  # ESA ships no tile for open ocean
        source = f"/vsicurl/{_tile_url(tile)}"

    import numpy as np
    import rasterio
    from rasterio.windows import Window

    radius_px = int(round(NEIGHBOURHOOD_RADIUS_M / PIXEL_M))
    try:
        with rasterio.open(source) as src:
            row, col = src.index(lon, lat)
            window = Window(col - radius_px, row - radius_px, 2 * radius_px + 1, 2 * radius_px + 1)
            arr = src.read(1, window=window, boundless=True, fill_value=0)
    except Exception as exc:  # noqa: BLE001 - land cover is context, never fatal
        logger.debug("WorldCover read failed for %s: %s", key, exc)
        return None

    yy, xx = np.mgrid[-radius_px : radius_px + 1, -radius_px : radius_px + 1]
    values = arr[(yy**2 + xx**2) <= radius_px**2]
    values = values[values != 0]  # 0 = WorldCover no-data
    centre = int(arr[radius_px, radius_px])
    if values.size == 0:
        return (WATER, 0.0) if centre in (0, 80) else (str(centre), 0.0)

    entropy = _shannon_entropy(values.tolist())
    if centre == 0 or (centre == 80 and float((values == 80).mean()) < MIN_WATER_FRACTION):
        land = values[values != 80]
        pool = land if land.size else values
        centre = Counter(pool.tolist()).most_common(1)[0][0]
    return str(centre), round(entropy, 6)


def lookup_landcover_batch(points: list[tuple[float, float]]) -> list[tuple[str | None, float]]:
    """Land cover for many (lat, lon) points, in input order.

    Cached cells return immediately; uncached cells are fetched from S3 in parallel and
    written back to the cache. Unreachable cells come back as ``(None, 0.0)``.
    """
    if not _enabled() or not points:
        return [(None, 0.0)] * len(points)
    keys = [cell_key(lat, lon) for lat, lon in points]
    unique = list(dict.fromkeys(keys))
    cache = get_cache()
    found: dict[CellKey, LandcoverValue] = cache.get_many(unique)

    misses = [k for k in unique if k not in found]
    if misses:
        fetched: dict[CellKey, LandcoverValue] = {}
        with ThreadPoolExecutor(max_workers=min(_max_workers(), len(misses))) as pool:
            for key, value in zip(misses, pool.map(_fetch_cell, misses)):
                if value is not None:
                    fetched[key] = value
        cache.put_many(fetched)
        found.update(fetched)
        if len(fetched) < len(misses):
            logger.warning("WorldCover: %d of %d uncached cells unreachable", len(misses) - len(fetched), len(misses))

    return [found.get(k, (None, 0.0)) for k in keys]


def lookup_landcover(lat: float, lon: float) -> tuple[str | None, float]:
    """WorldCover code (as a string, e.g. ``"40"``) and 500 m entropy at one point."""
    return lookup_landcover_batch([(lat, lon)])[0]


#: Classes that cannot physically occur on water or snow/ice: wildfire, mining fire, stubble burning.
IMPOSSIBLE_ON_NO_LAND = (2, 3, 4)


def landcover_rule_for(lulc_code: str | None) -> str | None:
    """The only land-cover rule: water or snow/ice rules out land-only fire classes."""
    code = (lulc_code or "").split(".")[0]
    return "no_land_fire" if code in NO_LAND_FIRE else None


def apply_landcover_rules(
    probabilities: dict[int, float], lulc_code: str | None
) -> tuple[dict[int, float], str | None]:
    """Zero out wildfire/mine/stubble on water or snow and renormalize; otherwise untouched.

    No class is boosted. If the model put all its mass on impossible classes, the remaining
    classes (1 and 5) share it equally.
    """
    rule = landcover_rule_for(lulc_code)
    if rule is None:
        return dict(probabilities), None

    adjusted = {
        k: 0.0 if k in IMPOSSIBLE_ON_NO_LAND else max(0.0, float(probabilities.get(k, 0.0)))
        for k in range(1, 6)
    }
    total = sum(adjusted.values())
    if total < 1e-6:
        allowed = [k for k in range(1, 6) if k not in IMPOSSIBLE_ON_NO_LAND]
        adjusted = {k: (1.0 / len(allowed) if k in allowed else 0.0) for k in range(1, 6)}
        total = 1.0
    result = {k: v / total for k, v in adjusted.items()}
    top = max(result, key=result.get)
    result[top] += 1.0 - sum(result.values())
    return result, rule


def describe_rule(rule: str | None) -> str | None:
    return {
        "no_land_fire": "Water or snow/ice land cover: wildfire, mining fire and stubble burning ruled out",
    }.get(rule or "")
