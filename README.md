# Jvalyx

**Space-based industrial fire classification and consequence intelligence.**

Satellite fire feeds answer *"where is heat?"* Jvalyx answers *"what is happening, how
dangerous is it, what evidence supports that conclusion, and who may be affected next?"*

A fused thermal event is triaged into five classes (industrial fire / wildfire /
mining fire / agricultural burning / persistent flare), then a deterministic,
confidence-aware arbitration layer routes it to `NORMAL`, `UNCERTAIN`, or `CRITICAL`.
Sensor disagreement is never silently suppressed.

> Research prototype. Outputs support analyst review and are not a substitute for
> official emergency response systems. Model outputs are **stub-derived** until trained
> CatBoost / Isolation Forest models replace them (`model_version: stub-0.1.0`).

---

## Repository layout

| Path | What it is | Status |
|---|---|---|
| `backend/` | FastAPI service: canonical data model, replay engine, deterministic pipeline, REST + WebSocket API | Working |
| `backend/pipeline/` | quality → fusion → features → stub inference → arbitration → evidence → tactical | Working (deterministic; ML is stubbed) |
| `data/replay/*.json` | Four committed replay scenarios (ported from the frontend pack) | Working |
| `frontend/` | React + Vite dashboard (map, charts, counterfactual slider, operator workflow) | Working as a **standalone SPA**; `services/api.ts` is the backend client, wiring into `App.tsx` is pending |
| `ml/` | CatBoost / Isolation Forest / SegFormer training | **Not built** |
| `docs/` | Build plans + model math + cross-layer findings | — |

---

## Run the backend

### Local (Python 3.11+)

```bash
pip install -e ".[dev]"      # one-time

python app.py                # serve on http://127.0.0.1:8000
python app.py --reload       # dev auto-reload
python app.py --port 9000    # custom port
```

Equivalent invocations: `python -m backend` or `uvicorn backend.app:app`.
Interactive API docs: http://127.0.0.1:8000/docs

### Docker

```bash
docker compose up --build
# http://localhost:8000/health
```

### Tests

```bash
python -m pytest -q
```

---

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Service + version check |
| `/config` | GET | Arbitration thresholds, risk weights, model/policy versions, honesty notice |
| `/scenarios` | GET | List the four replay scenarios |
| `/scenarios/{id}/start` | POST | Load (if needed) and start playback |
| `/scenarios/{id}/reset` | POST | Reset playback to frame 0 |
| `/replay/pause` · `/replay/resume` | POST | Pause / resume the replay clock |
| `/replay/speed` | POST | `{ "speed": 0.5 \| 1.0 \| 4.0 }` |
| `/replay/jump` | POST | `{ "checkpoint": "before_anomaly" }` |
| `/replay/status` | GET | Current scenario, frame index, replay state |
| `/events` | GET | Current event intelligence snapshots |
| `/events/{id}` | GET | Full event intelligence (decision, risk breakdown, 4 evidence cards, tactical overlay) |
| `/events/{id}/simulate` | POST | `{ "deviation": 0.0-1.0 }` — counterfactual "Operational Deviation" slider; tags `DEMO SIMULATION MODE` |
| `/events/{id}/verify` | POST | `{ "decision": "confirm" \| "reject" }` — operator override + audit entry |
| `/audit` | GET | Append-only operator/compliance log |
| `/ws/events` | WS | Live `snapshot` then `event_update` / `replay_status` messages |

### Demo playback timing

Scenario frames carry real observation timestamps (tens of minutes apart). The replay
clock collapses that into demo time via `JVALYX_REPLAY_COMPRESSION` (default 120 ≈ two
scenario-minutes per real second) with a per-frame cap of `JVALYX_REPLAY_MAX_GAP_SECONDS`
(default 6). The full `industrial_escalation` replay runs in ~15 s at 1×.

---

## What is real vs. stubbed

**Real:** the canonical Pydantic data model, the async replay engine, the arbitration +
risk formulas (ports of `docs/Jvalyx_AI_Model_Math_and_Calculations.md` §12–13), quality
scoring, fusion state, the Monte Carlo plume corridor, consequence scoring, the full
REST + WebSocket surface, in-memory event store + audit log.

**Stubbed / hand-authored:** class probabilities and anomaly scores (read from the
scenario pack via `pipeline/inference_stub.py`), segmentation masks (curated polygons),
the 90-day baselines, and the four scenarios themselves. No model is trained anywhere in
this repo.

See `docs/cross-layer-findings.md` for known frontend / docs discrepancies.
