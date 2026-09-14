"""Site persistence for live detections: ``recurrence_days_90d``, the v3 model's 13th feature.

Definition (identical to ``data/training/_stage5_recurrence.py``): the number of distinct
EARLIER days, 1-90 days before the detection's date, on which the same 0.01-degree grid cell
(~1.1 km) had at least one FIRMS detection from any of VIIRS SNPP / NOAA-20 / NOAA-21 or MODIS.

History lives in a local SQLite store (``data/live_cache/firms_history.sqlite``) of distinct
(cell, day) pairs:

* seeded from the training archive by ``backend/tools/build_firms_history.py``,
* topped up from the NASA FIRMS area API (``sync_from_firms``; needs ``FIRMS_MAP_KEY``), and
* extended with every detection the live endpoints classify.

A count is only trustworthy when the store covers the whole 90-day window: ``synced_through``
(last fully-synced day) must reach the day before the detection and ``history_start`` must be
at or before the window start. Otherwise the count may be too low — a routine site would look
like a quiet site suddenly burning (C1) — so callers get ``complete=False`` and must not treat
the classification as settled.
"""

from __future__ import annotations

import bisect
import csv
import io
import logging
import math
import os
import sqlite3
import threading
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

WINDOW_DAYS = 90
GRID_DEG = 0.01
EPOCH = date(1970, 1, 1)
DEFAULT_HISTORY_PATH = Path(__file__).parents[2] / "data" / "live_cache" / "firms_history.sqlite"

FIRMS_AREA_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}/{start}"
#: Same sensors the training archive was built from.
FIRMS_SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT")
#: Same India box the live map loads (frontend/src/firms/config/india.ts).
INDIA_BBOX = "67.0,6.5,97.5,37.6"
FIRMS_MAX_DAYS_PER_QUERY = 5
AUTO_SYNC_INTERVAL_S = 3600

_lock = threading.Lock()
_sync_lock = threading.Lock()
_last_sync_attempt = 0.0


def history_path() -> Path:
    return Path(os.getenv("JVALYX_FIRMS_HISTORY", str(DEFAULT_HISTORY_PATH)))


def cell_of(lat: float, lon: float) -> int:
    return math.floor(lat / GRID_DEG) * 100_000 + math.floor(lon / GRID_DEG)


def day_of(d: date) -> int:
    return (d - EPOCH).days


def date_of(day: int) -> date:
    return EPOCH + timedelta(days=day)


def _connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or history_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS fire_days (cell INTEGER NOT NULL, day INTEGER NOT NULL,"
        " PRIMARY KEY (cell, day)) WITHOUT ROWID"
    )
    conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)")
    return conn


def _get_meta(conn: sqlite3.Connection, key: str) -> int | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return int(row[0]) if row else None


def set_coverage(history_start: int | None = None, synced_through: int | None = None,
                 path: Path | None = None) -> None:
    """Record the fully-covered day range. Only ever widens it."""
    with _lock:
        conn = _connect(path)
        try:
            if history_start is not None:
                current = _get_meta(conn, "history_start")
                if current is None or history_start < current:
                    conn.execute("INSERT OR REPLACE INTO meta VALUES ('history_start', ?)", (history_start,))
            if synced_through is not None:
                current = _get_meta(conn, "synced_through")
                if current is None or synced_through > current:
                    conn.execute("INSERT OR REPLACE INTO meta VALUES ('synced_through', ?)", (synced_through,))
            conn.commit()
        finally:
            conn.close()


def coverage(path: Path | None = None) -> tuple[int | None, int | None]:
    """(history_start, synced_through) as epoch days; None when never set."""
    with _lock:
        conn = _connect(path)
        try:
            return _get_meta(conn, "history_start"), _get_meta(conn, "synced_through")
        finally:
            conn.close()


def record_cell_days(cell_days: list[tuple[int, int]], path: Path | None = None) -> None:
    if not cell_days:
        return
    with _lock:
        conn = _connect(path)
        try:
            conn.executemany("INSERT OR IGNORE INTO fire_days (cell, day) VALUES (?, ?)", cell_days)
            conn.commit()
        finally:
            conn.close()


def record_detections(points: list[tuple[float, float, date]]) -> None:
    """Add detections (lat, lon, acquisition date) to the history. Does not change coverage."""
    record_cell_days(list({(cell_of(lat, lon), day_of(d)) for lat, lon, d in points}))


def recurrence_days_batch(points: list[tuple[float, float, date]]) -> list[tuple[int, bool]]:
    """(recurrence_days_90d, history_complete) per (lat, lon, date), in input order."""
    if not points:
        return []
    queries = [(cell_of(lat, lon), day_of(d)) for lat, lon, d in points]
    cells = sorted({c for c, _ in queries})
    lo = min(day for _, day in queries) - WINDOW_DAYS
    hi = max(day for _, day in queries) - 1

    days_by_cell: dict[int, list[int]] = {c: [] for c in cells}
    with _lock:
        conn = _connect()
        try:
            start, synced = _get_meta(conn, "history_start"), _get_meta(conn, "synced_through")
            for i in range(0, len(cells), 900):
                chunk = cells[i : i + 900]
                rows = conn.execute(
                    f"SELECT cell, day FROM fire_days WHERE cell IN ({','.join('?' * len(chunk))})"
                    " AND day BETWEEN ? AND ?",
                    [*chunk, lo, hi],
                ).fetchall()
                for cell, day in rows:
                    days_by_cell[cell].append(day)
        finally:
            conn.close()
    for days in days_by_cell.values():
        days.sort()

    results: list[tuple[int, bool]] = []
    for cell, day in queries:
        days = days_by_cell[cell]
        count = bisect.bisect_right(days, day - 1) - bisect.bisect_left(days, day - WINDOW_DAYS)
        complete = start is not None and synced is not None and start <= day - WINDOW_DAYS and synced >= day - 1
        results.append((count, complete))
    return results


def _map_key() -> str | None:
    key = os.getenv("FIRMS_MAP_KEY", "").strip()
    return key or None


def sync_from_firms(map_key: str, start: date, end: date, *, timeout: float = 90.0) -> int:
    """Fetch detections for [start, end] from the FIRMS area API into the history.

    Advances ``synced_through`` to ``end`` only if every sensor and slice succeeded.
    Returns the number of (cell, day) pairs fetched.
    """
    cell_days: set[tuple[int, int]] = set()
    ok = True
    for source in FIRMS_SOURCES:
        cursor = start
        while cursor <= end:
            days = min(FIRMS_MAX_DAYS_PER_QUERY, (end - cursor).days + 1)
            url = FIRMS_AREA_URL.format(key=map_key, source=source, bbox=INDIA_BBOX, days=days, start=cursor.isoformat())
            try:
                text = urllib.request.urlopen(url, timeout=timeout).read().decode("utf-8", "replace")
            except Exception as exc:  # noqa: BLE001 - network problems just leave coverage unchanged
                logger.warning("FIRMS sync %s %s failed: %s", source, cursor, exc)
                ok = False
                cursor += timedelta(days=days)
                continue
            if not text.startswith("latitude"):
                logger.warning("FIRMS sync %s %s returned: %s", source, cursor, text[:120])
                ok = False
            else:
                for row in csv.DictReader(io.StringIO(text)):
                    try:
                        d = date.fromisoformat(row["acq_date"])
                        cell_days.add((cell_of(float(row["latitude"]), float(row["longitude"])), day_of(d)))
                    except (KeyError, ValueError):
                        continue
            cursor += timedelta(days=days)
    record_cell_days(list(cell_days))
    if ok:
        set_coverage(synced_through=day_of(end))
    return len(cell_days)


def maybe_sync_async() -> None:
    """If history is behind yesterday and a FIRMS key is configured, top it up in the
    background (at most once per ``AUTO_SYNC_INTERVAL_S``). Never blocks the caller."""
    global _last_sync_attempt
    key = _map_key()
    if key is None:
        return
    now = time.monotonic()
    if now - _last_sync_attempt < AUTO_SYNC_INTERVAL_S or not _sync_lock.acquire(blocking=False):
        return
    _last_sync_attempt = now
    history_start, synced = coverage()
    yesterday = date.today() - timedelta(days=1)
    if synced is not None and synced >= day_of(yesterday):
        _sync_lock.release()
        return
    first = date_of(synced + 1) if synced is not None else yesterday - timedelta(days=WINDOW_DAYS)

    def run() -> None:
        try:
            n = sync_from_firms(key, first, date.today())
            if history_start is None:
                set_coverage(history_start=day_of(first))
            logger.info("FIRMS history synced %s..%s (%d cell-days)", first, date.today(), n)
        finally:
            _sync_lock.release()

    threading.Thread(target=run, name="firms-history-sync", daemon=True).start()
