# Jvalyx — Backend Build Plan (Phase 1, Pre-Training)

**Scope:** Full backend for the phase 1 demo slice — 2 replay scenarios (persistent flare, industrial escalation), feature engineering, rule-based arbitration, WebSocket live updates, counterfactual slider. Model training is explicitly excluded; inference is stubbed so the rest of the pipeline is fully wired and swappable later.

**Deferred (not in this plan):** wildfire scenario, sensor-disagreement scenario, segmentation/mask overlay, plume probability corridor, consequence/population layer, `/events/{id}/verify` operator workflow, live feed adapters, CatBoost/Isolation Forest training.

---

## 1. Repository Layout

```text
Jvalyx/
├── README.md
├── docker-compose.yml        # api + worker services; db optional (SQLite for now)
├── data/
│   ├── replay/
│   │   ├── persistent_flare.json
│   │   └── industrial_escalation.json
│   └── schemas/
├── backend/
│   ├── app.py                 # FastAPI entrypoint
│   ├── api/                   # route handlers
│   │   ├── scenarios.py
│   │   ├── events.py
│   │   ├── config.py
│   │   └── ws.py
│   ├── models/                 # Pydantic schema (Detection, FusedEvent, DecisionOutput)
│   ├── pipeline/
│   │   ├── replay.py           # replay clock
│   │   ├── features.py         # derive_features
│   │   ├── inference_stub.py   # placeholder for CatBoost + Isolation Forest
│   │   ├── arbitration.py      # arbitrate() + risk score
│   │   └── evidence.py         # evidence card assembly
│   ├── storage/                # in-memory or SQLite event store + audit log
│   ├── config/
│   │   └── thresholds.yaml     # arbitration thresholds, versioned
│   └── tests/
│       ├── test_arbitration.py
│       └── test_golden_scenarios.py
└── docs/
    └── architecture.md
```

Keep to at most two runnable processes for now: `api` (FastAPI + WebSocket) and `worker` (replay clock, feature/arbitration pipeline). No Kafka, no Kubernetes, no microservices.

---

## 2. Canonical Data Model

One stable schema across the whole pipeline. Store raw payloads separately so normalized events stay auditable.

### 2.1 Detection

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class Detection(BaseModel):
    detection_id: str
    sensor: Literal["VIIRS", "MODIS", "INSAT", "REPLAY"]
    timestamp: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    frp_mw: float | None = Field(default=None, ge=0)
    bright_ti4_k: float | None = None
    bright_ti5_k: float | None = None
    scan_km: float | None = None
    track_km: float | None = None
    confidence: str | None = None
    cloud_flag: bool = False
    raw_quality: dict = {}
```

### 2.2 Fused Event

```python
class FusedEvent(BaseModel):
    event_id: str
    created_at: datetime
    latitude: float
    longitude: float
    detections: list[Detection]
    sensor_count: int
    sensor_agreement_state: str
    data_quality_flag: str
    facility_id: str | None = None
    facility_type: str = "none"
    persistence_score: float = 0.0
    facility_frp_zscore: float = 0.0
    route_state: Literal["NORMAL", "UNCERTAIN", "CRITICAL"] = "UNCERTAIN"
```

### 2.3 Decision Output

```json
{
  "event_id": "evt-2026-0007",
  "class_id": 1,
  "class_name": "Accidental Industrial Fire / Explosion",
  "class_probabilities": {"1": 0.78, "2": 0.08, "3": 0.03, "4": 0.01, "5": 0.10},
  "anomaly_score": 0.92,
  "route_state": "CRITICAL",
  "risk_score": 91,
  "confidence_state": "high",
  "explanation": [
    "Facility FRP is 5.1 standard deviations above its baseline",
    "The event expanded across 6 neighboring thermal pixels",
    "The high-resolution sensor and geostationary trend agree"
  ],
  "recommended_action": "Pull tactical imagery and assess downwind exposure",
  "model_version": "stub-0.1.0",
  "policy_version": "arbitrator-0.1.0"
}
```

Note `model_version: "stub-0.1.0"` — flag stub-derived outputs explicitly so it's never confused with a trained model's output once training lands.

---

## 3. Replay Engine (2 Scenarios Only)

### 3.1 Scenarios

1. **Persistent flare** — repeated detections at nearly the same coordinate, low facility deviation. Stays `NORMAL` throughout.
2. **Industrial escalation** — routine facility heat followed by a sudden multi-pixel FRP surge. Transitions `NORMAL → CRITICAL`. This is the demo's signature story.

### 3.2 Replay clock

```python
async def replay(scenario, clock, publish):
    for frame in scenario.frames:
        await clock.sleep_until(frame.timestamp)
        event = process_frame(frame)   # features -> inference_stub -> arbitration
        await publish({
            "type": "event_update",
            "event": event.model_dump(mode="json")
        })
```

Controls: play/pause, 0.5×/1×/4× speed, jump to "before anomaly" / "critical state", reset.

### 3.3 Idempotent ingestion

```python
def detection_key(row: dict) -> str:
    return ":".join([row["sensor"], row["acq_datetime"],
                      f'{row["latitude"]:.4f}', f'{row["longitude"]:.4f}'])

def ingest(rows, store):
    inserted = 0
    for row in rows:
        key = detection_key(row)
        if not store.exists("detections", key):
            store.insert("detections", {"key": key, **row})
            inserted += 1
    return inserted
```

---

## 4. Feature Engineering

Only the fields the 2 scenarios actually populate:

```python
def safe_z(value: float, mean: float, std: float) -> float:
    return (value - mean) / max(std, 1e-6)

def derive_features(event: dict, baseline: dict) -> dict:
    ti4 = event.get("bright_ti4_k") or 0.0
    ti5 = event.get("bright_ti5_k") or 1.0
    return {
        "temp_ratio": ti4 / max(ti5, 1.0),
        "frp_z_score": safe_z(event["frp_mw"], baseline["mean"], baseline["std"]),
        "facility_frp_zscore": safe_z(
            event["facility_frp_mw"], baseline["facility_mean"], baseline["facility_std"]
        ),
        "cluster_pixel_count": event.get("cluster_pixel_count", 1),
        "centroid_drift_velocity": event.get("drift_mps", 0.0),
    }
```

**Leakage rule:** freeze the facility baseline before the simulated anomaly begins in each replay scenario — never compute it using "future" frames relative to the event being scored.

---

## 5. Stub Inference (Placeholder for CatBoost + Isolation Forest)

Training is out of scope for this pass. Stub inference returns a hand-authored probability distribution and anomaly score per scenario frame, matching the exact output shape the real models will produce later:

```python
def stub_infer(frame_id: str) -> dict:
    """
    Hand-authored per-frame outputs keyed by scenario + frame index.
    Shape matches what CatBoostClassifier.predict_proba + IsolationForest
    .decision_function will eventually return.
    """
    return STUB_TABLE[frame_id]
    # e.g. {"class_probabilities": {1: 0.78, 2: 0.08, ...}, "anomaly_score": 0.92}
```

Build `STUB_TABLE` by hand for every frame in both scenarios so the "before anomaly" and "critical state" transitions are deterministic and demo-safe. When real training lands, swap `stub_infer` for the trained CatBoost/Isolation Forest call — nothing downstream (arbitration, API, WebSocket) changes.

---

## 6. Rule-Based Arbitration

Deterministic and inspectable — the most important safety and demo component.

```python
def arbitrate(pred_class, probs, anomaly, event):
    p1 = probs.get(1, 0.0)
    p2 = probs.get(2, 0.0)
    industrial_anomaly = (
        event["is_in_industrial_polygon"] and event["facility_frp_zscore"] >= 4.0
    )
    strong_outlier = anomaly >= 0.75
    disagreement = event["sensor_agreement_state"] == "disagreement"

    if p1 >= 0.45 or p2 >= 0.55 or industrial_anomaly:
        return "CRITICAL"
    if strong_outlier or disagreement or max(probs.values()) < 0.55:
        return "UNCERTAIN"
    return "NORMAL"
```

Thresholds live in `backend/config/thresholds.yaml`, not hardcoded — tune without redeploying.

### Risk score

```
R = 100 × clip(0.35·severity + 0.25·anomaly + 0.20·spread + 0.20·exposure, 0, 1)
```

Exposure can default to a constant (0) for phase 1 since population/asset layers are deferred — just don't hide the term, zero it explicitly.

---

## 7. Evidence Cards

Every decision output includes four short evidence entries, generated alongside arbitration — not a hidden SHAP plot:

1. **Thermal:** FRP, brightness-temp contrast, cluster size, trend.
2. **Context:** facility boundary, distance to population/assets (0/placeholder for phase 1).
3. **Temporal:** baseline deviation and persistence.
4. **Decision:** stub class distribution, anomaly score, sensor agreement, routing rule fired.

---

## 8. API Contract

### 8.1 REST endpoints (phase 1 subset)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/scenarios` | GET | List the 2 available replay scenarios |
| `/scenarios/{id}/start` | POST | Start replay |
| `/scenarios/{id}/reset` | POST | Reset replay |
| `/events` | GET | List current events |
| `/events/{id}` | GET | Full event intelligence (decision output) |
| `/events/{id}/simulate` | POST | Apply demo counterfactual (intensity slider) |
| `/config` | GET | Thresholds + model/policy version |
| `/ws/events` | WebSocket | Live event updates |

Excluded for now: `/events/{id}/verify` (operator workflow deferred).

### 8.2 WebSocket message

```json
{
  "type": "event_update",
  "timestamp": "2026-09-04T17:59:12Z",
  "event_id": "evt-2026-0007",
  "changed": ["route_state", "risk_score"],
  "payload": {
    "route_state": "CRITICAL",
    "risk_score": 91,
    "recommended_action": "Pull tactical imagery and assess downwind exposure"
  }
}
```

### 8.3 Counterfactual slider

`/events/{id}/simulate` mutates **replay data**, never real model output. Intensity `0.0` = normal routine flare, `0.3` = elevated but explainable, `0.7` = facility-level anomaly, `1.0` = critical industrial event. Tag the response payload `"mode": "DEMO SIMULATION MODE"` explicitly.

---

## 9. Testing

### 9.1 Golden scenario test

```json
{
  "scenario": "industrial_escalation",
  "expected": {
    "before_anomaly": "NORMAL",
    "after_surge": "CRITICAL",
    "minimum_risk_score": 80,
    "required_evidence": [
      "facility_frp_zscore",
      "cluster_pixel_count",
      "sensor_agreement_state"
    ]
  }
}
```

Run against stub inference output — this validates arbitration logic independent of any trained model.

### 9.2 Reliability bar

Full replay must run 5 consecutive times with no manual restarts before this is considered done.

---

## 10. Build Order

1. Repo scaffold + canonical schema (§1–2)
2. Replay engine, 2 scenarios only (§3)
3. Feature engineering (§4)
4. Stub inference (§5)
5. Arbitration + evidence cards, wire `/events` (§6–7)
6. WebSocket + counterfactual slider (§8)
7. `/config`, golden tests, harden (§9)

**Explicitly not in this build:** CatBoost/Isolation Forest training. `stub_infer` stands in until that lands — swapping it in later touches only `backend/pipeline/inference_stub.py`, nothing else.

---

## 11. Honesty Labeling

Per the original build plan's demo safety rules — display one of `LIVE DATA`, `HISTORICAL REPLAY`, or `DEMO SIMULATION MODE` on every event payload, and never let the stub inference output be mistaken for a validated model result. Use `model_version: "stub-0.1.0"` until real training replaces it.
