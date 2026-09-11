# Jvalyx

**Space-based industrial fire classification and consequence intelligence.**

Satellite fire feeds answer *"where is heat?"* Jvalyx answers *"what is happening, how
dangerous is it, what evidence supports that conclusion, and who may be affected next?"*

A fused thermal event is triaged into five classes (industrial fire / wildfire /
mining fire / agricultural burning / persistent flare), then a deterministic,
confidence-aware arbitration layer routes it to `NORMAL`, `UNCERTAIN`, or `CRITICAL`.
Sensor disagreement is never silently suppressed.

> Research prototype. Outputs support analyst review and are not a substitute for
> official emergency response systems. Class probabilities come from the trained CatBoost
> classifier (`model_version: catboost-multiclass-12f-0.1.0`); the **anomaly score is
> still stub-derived** — no Isolation Forest artifact exists in this repository.

---

## Repository layout

| Path | What it is | Status |
|---|---|---|
| `backend/` | FastAPI service: canonical data model, replay engine, deterministic pipeline, REST + WebSocket API | Working |
| `backend/pipeline/` | quality → fusion → features → stub inference → arbitration → evidence → tactical | Working (deterministic; ML is stubbed) |
| `data/replay/*.json` | Four committed replay scenarios (ported from the frontend pack) | Working |
| `frontend/` | React + Vite app: FIRMS live monitor + incident digital twin, switched from one top-level nav | Working; the digital twin is **driven by this backend** over REST + `/ws/events`, with the bundled pack as an offline fallback |
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

### Docker (full stack)

```bash
docker compose up --build
# dashboard  http://localhost:8080
# API        http://localhost:8000/health
```

`web` builds the frontend and serves the static bundle with nginx; it waits for the API
healthcheck before starting. Vite inlines `VITE_*` at build time, so those are compose
**build args** — override them in a `.env` beside `docker-compose.yml` (or in the
environment) and rebuild for the change to take effect:

```bash
VITE_FIRMS_MAP_KEY=... docker compose up --build web
```

`VITE_API_BASE_URL` defaults to `http://localhost:8000` because the browser — not the
`web` container — makes those calls, so a compose service name would not resolve.

### Tests

```bash
python -m pytest -q
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

`VITE_API_BASE_URL` (default `http://localhost:8000`) points the dashboard at the backend.
With the backend running, the digital-twin view shows **LIVE BACKEND** and every control —
play/pause, step, speed, checkpoint jump, the deviation slider and operator verification —
is a round trip to the API. With no backend reachable it shows **OFFLINE PACK** and replays
`src/data/scenarios.ts` using the client-side math in `src/utils/math.ts`.

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
| `/replay/step` | POST | `{ "delta": 1 \| -1 }` — single-frame operator scrub; pauses playback |
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
REST + WebSocket surface, in-memory event store + audit log, and **CatBoost class
probabilities** from `backend/models/artifacts/catboost_model.cbm`.

**Stubbed / hand-authored:** the anomaly score (still read from the scenario pack),
segmentation masks (curated polygons), the 90-day baselines, and the four scenarios
themselves. No training code lives in this repo — only the artifact.

### Inference

`backend/pipeline/inference.py` builds the documented 12-feature row and calls the
trained classifier over classes 1–5. `inference_stub.py` remains the fallback when
`catboost` or the artifact is missing, and can be pinned explicitly:

```bash
JVALYX_INFERENCE=stub python app.py     # hand-authored probabilities (deterministic demo)
JVALYX_INFERENCE=catboost python app.py # trained model (default)
```

> **Known artifact limitations**, measured directly from `catboost_model.cbm` — see
> `backend/models/artifacts/README.md` §"Measured vocabulary": the model keys almost
> entirely on `lulc_class`, `is_in_industrial_polygon` and `distance_to_industrial_m`,
> saturates at ~1.0 confidence, has no trained cropland category, and currently
> mislabels the curated wildfire and routine-flare scenarios. Pin `JVALYX_INFERENCE=stub`
> for a scripted demo until the model is retrained.

See `docs/cross-layer-findings.md` for known frontend / docs discrepancies.
