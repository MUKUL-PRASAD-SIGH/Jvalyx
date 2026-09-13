"""Seed the persistent land-cover cache from the labeled training detections.

Every training detection already carries its exact WorldCover class and 500 m entropy
(stage 3 of the training pipeline). Fires recur at the same spots — 59.5% of detections in
the last 60 days of the archive fell on a ~110 m cell that had burned before — so seeding
the cache with those cells makes most live land-cover lookups instant instead of a remote
COG read each.

Per cell (0.001 degrees) it stores the most frequent class among that cell's detections and
the mean entropy of those detections. Existing live-fetched rows are never overwritten.

    python -m backend.tools.build_landcover_cache
    python -m backend.tools.build_landcover_cache --csv data/training/jvalyx_labeled_firms_india_v3.csv --min-detections 2
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import pandas as pd

from backend.pipeline.landcover import CELL_SCALE, cache_path, open_cache_db

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = REPO_ROOT / "data" / "training" / "jvalyx_labeled_firms_india_v3.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument(
        "--min-detections", type=int, default=2,
        help="Only seed cells with at least this many historical detections (default 2).",
    )
    args = parser.parse_args()

    started = time.time()
    parts = []
    for chunk in pd.read_csv(
        args.csv, usecols=["latitude", "longitude", "lulc_class", "lulc_entropy_500m"], chunksize=2_000_000
    ):
        chunk = chunk.dropna(subset=["lulc_class", "lulc_entropy_500m"])
        frame = pd.DataFrame({
            "lat_key": np.rint(chunk["latitude"].to_numpy() * CELL_SCALE).astype(np.int64),
            "lon_key": np.rint(chunk["longitude"].to_numpy() * CELL_SCALE).astype(np.int64),
            "code": chunk["lulc_class"].to_numpy().astype(np.int16),
            "entropy": chunk["lulc_entropy_500m"].to_numpy(),
        })
        parts.append(
            frame.groupby(["lat_key", "lon_key", "code"], sort=False)
            .agg(n=("entropy", "size"), entropy_sum=("entropy", "sum"))
            .reset_index()
        )
        print(f"  aggregated {sum(len(p) for p in parts):,} cell/class rows", flush=True)

    counts = pd.concat(parts).groupby(["lat_key", "lon_key", "code"], sort=False, as_index=False).sum()
    del parts
    cell_total = counts.groupby(["lat_key", "lon_key"], sort=False)["n"].transform("sum")
    counts = counts[cell_total >= args.min_detections]
    best = counts.sort_values("n", ascending=False).drop_duplicates(["lat_key", "lon_key"])
    best = best.assign(entropy=(best["entropy_sum"] / best["n"]).round(6))
    print(f"{len(best):,} cells with >= {args.min_detections} detections", flush=True)

    conn = open_cache_db()
    before = conn.execute("SELECT COUNT(*) FROM landcover").fetchone()[0]
    rows = zip(
        best["lat_key"].tolist(), best["lon_key"].tolist(),
        best["code"].astype(str).tolist(), best["entropy"].tolist(),
    )
    batch: list[tuple] = []
    for lat_key, lon_key, code, entropy in rows:
        batch.append((lat_key, lon_key, code, entropy, "training"))
        if len(batch) >= 200_000:
            conn.executemany("INSERT OR IGNORE INTO landcover VALUES (?, ?, ?, ?, ?)", batch)
            batch.clear()
    if batch:
        conn.executemany("INSERT OR IGNORE INTO landcover VALUES (?, ?, ?, ?, ?)", batch)
    conn.commit()
    after = conn.execute("SELECT COUNT(*) FROM landcover").fetchone()[0]
    conn.close()
    size_mb = cache_path().stat().st_size / 1e6
    print(f"cache {cache_path()}: {before:,} -> {after:,} cells ({size_mb:.0f} MB) in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
