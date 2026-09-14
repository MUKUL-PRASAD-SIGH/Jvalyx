"""Seed the FIRMS history store that ``recurrence_days_90d`` is computed from.

1. Loads the last ``--days`` of the training archive (``data/training/stage1_unified.parquet``,
   the same detections stage 5 counted) as distinct (cell, day) pairs.
2. With ``--sync``, fills the gap from the archive's last day to today from the FIRMS area API
   (key from ``--map-key`` or the ``FIRMS_MAP_KEY`` environment variable).

    python -m backend.tools.build_firms_history --sync
"""

from __future__ import annotations

import argparse
import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from backend.pipeline import recurrence

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ARCHIVE = REPO_ROOT / "data" / "training" / "stage1_unified.parquet"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--days", type=int, default=120, help="Archive days to load (>= 90 + a margin).")
    parser.add_argument("--sync", action="store_true", help="Top up from the FIRMS API to today.")
    parser.add_argument("--map-key", default=os.getenv("FIRMS_MAP_KEY", ""))
    args = parser.parse_args()

    frame = pd.read_parquet(args.archive, columns=["latitude", "longitude", "acq_date"])
    dates = pd.to_datetime(frame["acq_date"])
    last = dates.max().date()
    first = last - timedelta(days=args.days - 1)
    recent = frame[dates >= pd.Timestamp(first)]
    cells = (
        np.floor(recent["latitude"].to_numpy() / recurrence.GRID_DEG).astype(np.int64) * 100_000
        + np.floor(recent["longitude"].to_numpy() / recurrence.GRID_DEG).astype(np.int64)
    )
    days = (pd.to_datetime(recent["acq_date"]).dt.date.map(recurrence.day_of)).to_numpy()
    pairs = list({(int(c), int(d)) for c, d in zip(cells, days)})
    recurrence.record_cell_days(pairs)
    recurrence.set_coverage(history_start=recurrence.day_of(first), synced_through=recurrence.day_of(last))
    print(f"archive {first}..{last}: {len(recent):,} detections -> {len(pairs):,} cell-days")

    if args.sync:
        if not args.map_key:
            raise SystemExit("--sync needs --map-key or FIRMS_MAP_KEY")
        start, end = last + timedelta(days=1), date.today()
        if start <= end:
            n = recurrence.sync_from_firms(args.map_key, start, end)
            print(f"FIRMS API {start}..{end}: {n:,} cell-days")

    start_day, synced = recurrence.coverage()
    print(
        f"history {recurrence.history_path()}: covers {recurrence.date_of(start_day)}..{recurrence.date_of(synced)}"
        f" -> recurrence complete for detections dated {recurrence.date_of(start_day + recurrence.WINDOW_DAYS)}"
        f"..{recurrence.date_of(synced + 1)}"
    )


if __name__ == "__main__":
    main()
