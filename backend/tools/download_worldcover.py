"""Download ESA WorldCover 2021 v200 tiles for local land-cover lookups.

Remote COG reads take ~0.3-0.6 s per ~110 m cell, far too slow to classify a week of India
fires (6,000+) when the live map loads. With the tiles on disk (``data/live_cache/worldcover/``,
gitignored), ``backend/pipeline/landcover.py`` reads them locally — same raster, same values
as training — and only falls back to S3 for tiles that aren't downloaded.

Tiles: every 3x3-degree tile containing a detection in the training archive
(``data/training/stage1_unified.parquet``) or the FIRMS history store. Open-ocean tiles don't
exist on S3 and are skipped. Downloads resume from ``.part`` files and are size-verified.

    python -m backend.tools.download_worldcover --dry-run
    python -m backend.tools.download_worldcover --workers 4
"""

from __future__ import annotations

import argparse
import sqlite3
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd

from backend.pipeline import landcover, recurrence

REPO_ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = REPO_ROOT / "data" / "training" / "stage1_unified.parquet"
CHUNK = 1 << 20


def _tile_names(lat: np.ndarray, lon: np.ndarray) -> set[str]:
    pairs = np.unique(np.stack([np.floor(lat / 3.0) * 3, np.floor(lon / 3.0) * 3], axis=1), axis=0)
    return {landcover.tile_name_for(float(a) + 0.5, float(b) + 0.5) for a, b in pairs}


def tiles_with_fires() -> set[str]:
    tiles: set[str] = set()
    if ARCHIVE.exists():
        frame = pd.read_parquet(ARCHIVE, columns=["latitude", "longitude"])
        tiles |= _tile_names(frame["latitude"].to_numpy(), frame["longitude"].to_numpy())
    history = recurrence.history_path()
    if history.exists():
        cells = np.array([c for (c,) in sqlite3.connect(str(history)).execute("SELECT DISTINCT cell FROM fire_days")])
        if cells.size:
            lat = (cells // 100_000) * recurrence.GRID_DEG + recurrence.GRID_DEG / 2
            lon = (cells % 100_000) * recurrence.GRID_DEG + recurrence.GRID_DEG / 2
            tiles |= _tile_names(lat, lon)
    return tiles


def remote_size(tile: str) -> int | None:
    """Content length on S3, or None when the tile doesn't exist (open ocean)."""
    request = urllib.request.Request(landcover._tile_url(tile), method="HEAD")  # noqa: SLF001
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return int(response.headers["Content-Length"])
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 404):
                return None
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"could not reach S3 for {tile}")


def download(tile: str, size: int) -> str:
    path = landcover.local_tile_path(tile)
    if path.exists() and path.stat().st_size == size:
        return "present"
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + ".part")
    for attempt in range(5):
        start = part.stat().st_size if part.exists() else 0
        if start > size:
            part.unlink()
            start = 0
        if start == size:
            break
        request = urllib.request.Request(landcover._tile_url(tile))  # noqa: SLF001
        if start:
            request.add_header("Range", f"bytes={start}-")
        try:
            with urllib.request.urlopen(request, timeout=60) as response, open(part, "ab" if start else "wb") as out:
                if start and response.status != 206:  # server ignored the range: restart
                    out.truncate(0)
                while chunk := response.read(CHUNK):
                    out.write(chunk)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"  {tile}: retry {attempt + 1} after {exc}", flush=True)
            time.sleep(3 * (attempt + 1))
    if not part.exists() or part.stat().st_size != size:
        raise RuntimeError(f"{tile}: incomplete download")
    part.replace(path)
    return "downloaded"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tiles = sorted(tiles_with_fires())
    with ThreadPoolExecutor(16) as pool:
        sizes = dict(zip(tiles, pool.map(remote_size, tiles)))
    present = {t: s for t, s in sizes.items() if s}
    todo = {t: s for t, s in present.items()
            if not (landcover.local_tile_path(t).exists() and landcover.local_tile_path(t).stat().st_size == s)}
    print(f"{len(tiles)} tiles with fires; {len(present)} on S3 ({sum(present.values()) / 1e9:.2f} GB); "
          f"{len(todo)} to download ({sum(todo.values()) / 1e9:.2f} GB) into {landcover.worldcover_dir()}", flush=True)
    if args.dry_run or not todo:
        return

    started, done_bytes, failed = time.time(), 0, []
    with ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(download, t, s): t for t, s in sorted(todo.items(), key=lambda kv: kv[1])}
        for i, future in enumerate(as_completed(futures), 1):
            tile = futures[future]
            try:
                future.result()
                done_bytes += todo[tile]
                rate = done_bytes / max(time.time() - started, 1e-6) / 1e6
                print(f"  [{i}/{len(todo)}] {tile} {todo[tile] / 1e6:.0f} MB | {done_bytes / 1e9:.2f} GB at {rate:.1f} MB/s", flush=True)
            except Exception as exc:  # noqa: BLE001 - report and continue with the rest
                failed.append(tile)
                print(f"  [{i}/{len(todo)}] {tile} FAILED: {exc}", flush=True)
    print(f"done in {(time.time() - started) / 60:.1f} min; failed: {failed or 'none'}")


if __name__ == "__main__":
    main()
