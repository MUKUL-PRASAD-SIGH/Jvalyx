#!/usr/bin/env bash
# Run the Jvalyx backend (FastAPI :8000) and frontend (Vite :5173) together.
# Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

( cd "$ROOT" && exec python app.py ) &
( cd "$ROOT/frontend" && exec npm run dev ) &
wait
