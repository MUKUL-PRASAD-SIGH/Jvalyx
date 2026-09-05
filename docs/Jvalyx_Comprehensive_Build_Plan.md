# Jvalyx
## Comprehensive Technical Build Plan, Demonstration Playbook, and Differentiation Strategy

**Project:** Space-based industrial fire classification and consequence intelligence  
**Primary objective:** Convert raw satellite thermal anomalies into an explainable, confidence-aware, interactive hazard intelligence product.  
**Recommended MVP:** A replayable multi-sensor event simulator backed by real historical/open data, with a live-style dashboard and an operator-in-the-loop escalation workflow.

> **Important scope decision:** Build a credible, deterministic MVP first. Do not make the live system depend on every satellite/API/model being available during judging. The demo must work offline from a curated event pack, while live feeds remain a production extension.

---

## 1. Executive Concept

Satellite fire feeds answer **“where is heat?”** Jvalyx answers **“what is happening, how dangerous is it, what evidence supports that conclusion, and who may be affected next?”**

The system classifies a fused event into five categories:

| Class | Meaning | Suggested route |
|---|---|---|
| 1 | Accidental industrial fire or explosion | Critical; immediate tactical analysis |
| 2 | Wildfire or uncontrolled forest fire | High; immediate spread/consequence analysis |
| 3 | Uncontrolled mining or coal-seam fire | Moderate; monitor and investigate |
| 4 | Agricultural or stubble burning | Low/compliance; track pattern |
| 5 | Persistent flare or routine industrial source | Routine; baseline/exception monitoring |

The architectural distinction is a **confidence-aware arbitration layer**. CatBoost, an anomaly detector, sensor agreement, facility baseline behavior, and data-quality metadata jointly determine whether an event is `NORMAL`, `UNCERTAIN`, or `CRITICAL`. A model prediction alone never silently suppresses a potentially dangerous event.

### 1.1 Success criteria

The judging team should be able to see, in under five minutes:

1. A thermal event arriving on a map.
2. The event being enriched with facility, land-cover, historical, weather, and sensor evidence.
3. A class, confidence, risk score, and plain-language explanation being generated.
4. A “routine flare → industrial emergency” transition being detected using the facility baseline.
5. A segmented fire/plume region and downwind consequence corridor appearing for a critical event.
6. The operator changing the system state through verification, with the final decision and audit trail updating visibly.

---

## 2. Out-of-the-Box Differentiator

## The Thermal Digital Twin and Counterfactual Incident Replay

Most teams will show a hotspot, a classifier label, and perhaps a map. Jvalyx should show **how the system recognizes a change from normal operations and how that change affects people and assets**.

Create a small “thermal digital twin” for each monitored facility:

- Normal thermal sources and their expected persistence.
- Typical FRP distribution by facility and hotspot cluster.
- Usual time-of-day behavior.
- Historical sensor agreement pattern.
- Nearby critical assets, roads, settlements, and population exposure.
- Typical wind-direction envelope.

Then introduce a counterfactual replay:

> **“What if this routine flare becomes an abnormal facility-wide surge while the wind shifts toward a settlement?”**

The dashboard animates the event timeline, updates the facility anomaly score, changes the routing state, draws a probabilistic plume corridor, and explains the exact evidence that caused escalation.

### Why this differentiates the project

- It demonstrates **change detection**, not merely image classification.
- It makes an otherwise invisible baseline feature visually understandable.
- It provides an interactive “what-if” control that judges can operate.
- It connects detection to consequence without claiming perfect physical simulation.
- It is implementable with a small curated dataset and deterministic replay engine.

### Signature demo control

Add a slider named **Incident Intensity / Operational Deviation**:

- `0.0`: normal routine flare.
- `0.3`: elevated but explainable operation.
- `0.7`: facility-level anomaly.
- `1.0`: critical industrial event.

The slider modifies a replay event—not the real model output—and is clearly labeled **Demo Simulation Mode**. This lets judges see the complete state transition reliably while preserving scientific honesty.

### Secondary differentiator: Evidence Cards

Every alert gets four evidence cards:

1. **Thermal evidence:** FRP, brightness-temperature contrast, cluster size, trend.
2. **Context evidence:** facility boundary, land cover, distance to population/assets.
3. **Temporal evidence:** baseline deviation and persistence.
4. **Decision evidence:** CatBoost distribution, anomaly score, sensor agreement, routing rule.

Each card includes a small “why it matters” sentence. This turns explainability into a visible product feature rather than a hidden SHAP plot.

---

## 3. Functional MVP Architecture

```text
                 ┌───────────────────────────────────────┐
                 │       Event sources / replay pack     │
                 │ FIRMS | MODIS | VIIRS | INSAT mock    │
                 └───────────────────┬───────────────────┘
                                     │
                           1. Ingestion adapter
                                     │
                           2. Schema normalization
                                     │
                           3. Quality checks
                                     │
                           4. Spatial-temporal fusion
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
             Context enrichment                  Event store
       facility/LULC/weather/baseline       SQLite/PostgreSQL
                    │                                 │
                    └────────────────┬────────────────┘
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
           CatBoost classifier                    Isolation Forest
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     │
                          Rule-based arbitration
                                     │
       ┌─────────────────────┬───────┴────────┬────────────────────┐
       │                     │                │                    │
    NORMAL               UNCERTAIN        CRITICAL          REPLAY/WHAT-IF
       │                     │                │                    │
       │              re-pass/review     Sentinel-2 mock/real    simulation
       │                     │                │                    │
       └─────────────────────┴────────────────┴────────────────────┘
                                     │
                   segmentation + plume + consequence
                                     │
                           WebSocket event stream
                                     │
                         interactive operator dashboard
```

### 3.1 Recommended implementation stack

| Layer | MVP choice | Reason |
|---|---|---|
| Data ingestion | Python, Pandas, Pydantic | Fast development and schema validation |
| Geospatial processing | GeoPandas, Shapely, Rasterio | Familiar, demonstrable spatial operations |
| Storage | SQLite for demo; PostgreSQL/PostGIS for deployment | Avoid infrastructure overhead during judging |
| ML | CatBoost + scikit-learn Isolation Forest | Strong tabular baseline and independent anomaly path |
| Segmentation | Lightweight U-Net or precomputed mask; SegFormer for extended version | Reliable demo with manageable compute |
| API | FastAPI | Typed endpoints and easy WebSocket support |
| Realtime | WebSocket | Pushes event-state changes to the dashboard |
| Frontend | React + MapLibre GL JS or Leaflet | Interactive map and animated event layers |
| Charts | Recharts/ECharts | Timeline, class distribution, confidence, FRP trend |
| Deployment | Docker Compose; optional Vercel frontend | Reproducible local demo |
| Model artifacts | `joblib`/CatBoost native format | Simple loading and versioning |

### 3.2 Keep the architecture simple

Do not begin with microservices, Kafka, Kubernetes, or a fully distributed feature store. Use four runnable processes at most:

1. `api`: FastAPI endpoints and WebSocket.
2. `worker`: ingestion, enrichment, inference, and replay clock.
3. `frontend`: dashboard.
4. Optional `db`: PostgreSQL/PostGIS; replace with SQLite for the first demo.

Use interfaces so production feeds can later replace replay data:

```python
from typing import Protocol

class EventSource(Protocol):
    def fetch(self, since_iso: str) -> list[dict]: ...

class ReplaySource:
    def __init__(self, path: str):
        self.path = path

    def fetch(self, since_iso: str) -> list[dict]:
        return load_events_after(self.path, since_iso)

class FirmsSource:
    def fetch(self, since_iso: str) -> list[dict]:
        return fetch_firms_api(since_iso)
```

The dashboard should not know whether an event came from a live API or a replay file.

---

## 4. Canonical Data Model

Use one stable schema across all sensors and stages. Store raw source payloads separately so the normalized event remains auditable.

### 4.1 Normalized detection

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

### 4.2 Fused event

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
    lulc_class: str = "unknown"
    persistence_score: float = 0.0
    facility_frp_zscore: float = 0.0
    route_state: Literal["NORMAL", "UNCERTAIN", "CRITICAL"] = "UNCERTAIN"
```

### 4.3 Decision output

```json
{
  "event_id": "evt-2026-0007",
  "class_id": 1,
  "class_name": "Accidental Industrial Fire / Explosion",
  "class_probabilities": {
    "1": 0.78,
    "2": 0.08,
    "3": 0.03,
    "4": 0.01,
    "5": 0.10
  },
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
  "model_version": "triage-0.1.0",
  "policy_version": "arbitrator-0.1.0"
}
```

---

## 5. Ingestion and Replay Layer

### 5.1 Data modes

Implement three modes:

| Mode | Purpose | Required for judging |
|---|---|---|
| `replay` | Deterministic event timeline from local JSON/CSV | Yes |
| `synthetic` | Generate controlled what-if transitions | Yes |
| `live` | Poll available external feeds | Optional extension |

The replay pack should contain at least four scenarios:

1. Persistent flare: repeated detections at nearly the same coordinate and low facility deviation.
2. Wildfire: spatially expanding cluster over vegetation with nonzero drift velocity.
3. Industrial escalation: routine facility heat followed by sudden multi-pixel FRP surge.
4. Sensor disagreement: one high-resolution detection with cloud/quality uncertainty.

### 5.2 Idempotent ingestion

Never create duplicates when polling an overlapping time window.

```python
def detection_key(row: dict) -> str:
    return ":".join([
        row["sensor"],
        row["acq_datetime"],
        f'{row["latitude"]:.4f}',
        f'{row["longitude"]:.4f}'
    ])

def ingest(rows, store):
    inserted = 0
    for row in rows:
        key = detection_key(row)
        if not store.exists("detections", key):
            store.insert("detections", {"key": key, **row})
            inserted += 1
    return inserted
```

### 5.3 Demo replay clock

The replay clock is central to an interactive demo:

```python
async def replay(scenario, clock, publish):
    for frame in scenario.frames:
        await clock.sleep_until(frame.timestamp)
        event = process_frame(frame)
        await publish({
            "type": "event_update",
            "event": event.model_dump(mode="json")
        })
```

Controls:

- Play/pause.
- 0.5×, 1×, 4× speed.
- Jump to “before anomaly”, “first escalation”, or “critical state”.
- Reset scenario.

---

## 6. Quality Checks and Sensor Fusion

### 6.1 Quality checks

Do not discard weak detections automatically. Preserve them with a lower evidence weight.

```python
def quality_score(d: dict) -> float:
    score = 1.0
    if d.get("cloud_flag"):
        score -= 0.35
    if d.get("sun_glint_flag"):
        score -= 0.25
    if d.get("scan_km", 0) > 35 or d.get("track_km", 0) > 35:
        score -= 0.15
    if d.get("confidence") == "low":
        score -= 0.20
    return max(0.0, score)
```

### 6.2 Resolution-scaled matching

A fixed radius is misleading. Match a detection to the footprint of the coarser sensor. For a simple MVP, represent each detection with a resolution-dependent bounding box.

```python
def spatial_match(a, b) -> bool:
    # MVP approximation: use the larger declared footprint.
    tolerance_m = max(a.footprint_m, b.footprint_m) / 2
    return haversine_m(a.latitude, a.longitude, b.latitude, b.longitude) <= tolerance_m

def temporal_match(a, b, window_minutes=30) -> bool:
    return abs((a.timestamp - b.timestamp).total_seconds()) <= window_minutes * 60
```

### 6.3 Explicit fusion state

```python
def fusion_state(detections: list[dict]) -> str:
    high_quality = [d for d in detections if quality_score(d) >= 0.5]
    sensors = {d["sensor"] for d in high_quality}
    if len(sensors) >= 2:
        return "full_agreement"
    if "INSAT" in sensors:
        return "temporally_confirmed_spatially_coarse"
    if sensors & {"VIIRS", "MODIS"}:
        return "single_sensor_high_res"
    return "disagreement"
```

### 6.4 Safety rule

`disagreement` must not become `no fire`. It routes to `UNCERTAIN`, or to `CRITICAL` when the industrial anomaly signal is strong.

---

## 7. Feature Engineering

### 7.1 Feature groups

| Group | Features | Computation |
|---|---|---|
| Radiometric | `bright_ti4`, `bright_ti5`, `temp_ratio`, `frp`, `scan`, `track`, `daynight` | Sensor record |
| Spatial | industrial membership, distance, facility type, LULC, entropy | GeoPandas/PostGIS |
| Temporal | persistence, baseline mean/std, z-score, drift, cluster count | Event store |
| Facility | facility FRP mean/std/z-score, active hotspot count | Facility aggregation |
| Fusion | sensor count, agreement state, quality flag | Fusion layer |
| Tactical | SWIR/NIR, delta NBR, delta NDVI, plume spread | On-demand imagery or precomputed demo mask |

### 7.2 Derived feature snippets

```python
import numpy as np

def safe_z(value: float, mean: float, std: float) -> float:
    return (value - mean) / max(std, 1e-6)

def derive_features(event: dict, baseline: dict) -> dict:
    ti4 = event.get("bright_ti4_k") or 0.0
    ti5 = event.get("bright_ti5_k") or 1.0
    return {
        "temp_ratio": ti4 / max(ti5, 1.0),
        "frp_z_score": safe_z(event["frp_mw"], baseline["mean"], baseline["std"]),
        "facility_frp_zscore": safe_z(
            event["facility_frp_mw"],
            baseline["facility_mean"],
            baseline["facility_std"]
        ),
        "cluster_pixel_count": event.get("cluster_pixel_count", 1),
        "centroid_drift_velocity": event.get("drift_mps", 0.0)
    }
```

### 7.3 Avoiding leakage

The training split must be spatially and temporally separated. Never calculate a baseline using future observations relative to the event being classified. For replay scenarios, the baseline must be frozen before the simulated anomaly begins.

Recommended splits:

- Spatial holdout: entire 50 km × 50 km grid cells.
- Temporal holdout: earlier years for training, later period for testing.
- Human-verified set: never generated solely by the same rules used as features.

---

## 8. Model Layer

## 8.1 CatBoost triage classifier

Use CatBoost for mixed numerical/categorical tabular features. The output should be a probability distribution, not only a class label.

```python
from catboost import CatBoostClassifier

CAT_COLS = ["facility_type", "lulc_class", "sensor_agreement_state"]

model = CatBoostClassifier(
    loss_function="MultiClass",
    iterations=400,
    depth=7,
    learning_rate=0.05,
    auto_class_weights="Balanced",
    eval_metric="TotalF1:average=Macro",
    verbose=False
)
model.fit(X_train, y_train, cat_features=CAT_COLS)
probabilities = model.predict_proba(X_event)[0]
class_id = int(model.classes_[probabilities.argmax()])
```

MVP training target:

- Use distant supervision for Classes 3–5.
- Curate a small human-verified Class 1/2 set.
- Clearly label auto-generated rows as `weak_label=True`.
- Report performance separately on weak-label and human-verified sets.

### 8.2 Independent anomaly detector

The anomaly detector protects against thin Class 1 data.

```python
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ANOMALY_COLS = [
    "frp_z_score",
    "facility_frp_zscore",
    "persistence_score",
    "cluster_pixel_count",
    "centroid_drift_velocity"
]

scaler = StandardScaler().fit(X_normal[ANOMALY_COLS])
iso = IsolationForest(
    n_estimators=250,
    contamination=0.02,
    random_state=42
).fit(scaler.transform(X_normal[ANOMALY_COLS]))

def anomaly_signal(row):
    value = iso.decision_function(
        scaler.transform(row[ANOMALY_COLS].to_frame().T)
    )[0]
    return float(-value)
```

### 8.3 Explainability

For each alert, expose:

- Top three positive CatBoost/SHAP features.
- Anomaly score.
- Baseline chart.
- Sensor agreement.
- Rule that selected the route.

Do not show only “AI confidence: 94%”. That is not an explanation.

---

## 9. Rule-Based Arbitration

Keep this layer deterministic and inspectable. It is the most important safety and demo component.

### 9.1 Inputs

- CatBoost class probabilities.
- Predicted class.
- Anomaly score.
- Sensor agreement state.
- Facility FRP z-score.
- Cluster size and drift velocity.
- Data quality flag.
- Consequence score.

### 9.2 MVP routing policy

```python
def arbitrate(pred_class, probs, anomaly, event):
    p1 = probs.get(1, 0.0)
    p2 = probs.get(2, 0.0)
    industrial_anomaly = (
        event["is_in_industrial_polygon"]
        and event["facility_frp_zscore"] >= 4.0
    )
    strong_outlier = anomaly >= 0.75
    disagreement = event["sensor_agreement_state"] == "disagreement"

    if p1 >= 0.45 or p2 >= 0.55 or industrial_anomaly:
        return "CRITICAL"
    if strong_outlier or disagreement or max(probs.values()) < 0.55:
        return "UNCERTAIN"
    return "NORMAL"
```

The numeric thresholds are demo starting points, not validated operational thresholds. Put them in a configuration file so they can be tuned without code changes.

### 9.3 Risk score

Use a transparent weighted score for visualization:


a simple MVP formulation is

\[
R = 100 \times \operatorname{clip}(0.35P_{\text{severity}} + 0.25P_{\text{anomaly}} + 0.20P_{\text{spread}} + 0.20P_{\text{exposure}}, 0, 1)
\]

Where:

- `severity`: class-weighted probability.
- `anomaly`: normalized facility/coordinate deviation.
- `spread`: normalized cluster size and drift.
- `exposure`: nearby population/critical asset consequence.

Show the component bars beside the total score.

---

## 10. Tactical Vision and Consequence Layer

### 10.1 Segmentation strategy

For a functional demo, use one of these approaches:

| Approach | Use when |
|---|---|
| Precomputed masks | You need maximum demo reliability |
| Lightweight U-Net | You have a small labeled set and local GPU/CPU inference |
| SegFormer MiT-B0 | You want a stronger technical model and have time to tune |

The mask should distinguish at least:

- Burn/thermal anomaly region.
- Smoke/plume region.
- Background/uncertain.

### 10.2 Simple mask overlay

```python
def mask_to_geojson(mask, transform, threshold=0.5):
    binary = mask > threshold
    shapes = rasterio.features.shapes(binary.astype("uint8"), mask=binary)
    features = []
    for geometry, value in shapes:
        if value:
            features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": {"class": "thermal_or_smoke"}
            })
    return {"type": "FeatureCollection", "features": features}
```

### 10.3 Plume probability corridor

Do not display one exact toxic plume line as if it were physically certain. Sample wind direction and speed around the forecast estimate.

```python
import numpy as np

def plume_samples(origin, wind_speed, wind_dir_deg, n=200):
    speeds = np.random.normal(wind_speed, max(1.0, wind_speed * 0.15), n)
    dirs = np.random.normal(wind_dir_deg, 12.0, n)
    endpoints = []
    for speed, direction in zip(speeds, dirs):
        distance_km = max(1.0, speed * 0.18)
        endpoints.append(project_point(origin, distance_km, direction))
    return endpoints
```

For the demo, render 50–100 translucent sample corridors and their 50%/90% envelope. Label it **probability corridor**, not “exact dispersion”.

### 10.4 Consequence overlay

The consequence model can remain deterministic:

```python
def consequence_score(event, population, assets):
    pop_factor = min(population / 100_000, 1.0)
    asset_factor = min(assets / 10, 1.0)
    proximity = 1.0 if event["distance_to_asset_m"] < 2000 else 0.4
    return min(1.0, 0.5 * pop_factor + 0.3 * asset_factor + 0.2 * proximity)
```

Use synthetic or openly licensed population/asset data in the demo and disclose it.

---

## 11. Interactive Dashboard Design

The dashboard should look like an operational decision surface, not a generic map with a few cards.

### 11.1 Main screen layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Jvalyx | LIVE REPLAY | NORMAL / UNCERTAIN / CRITICAL  │
├─────────────────────────────┬────────────────────────────────┤
│                             │ Event intelligence              │
│        Interactive map       │ Class + confidence              │
│  heat points / mask / plume  │ Risk score + route              │
│  timeline playback           │ Evidence cards                  │
│                             │ Recommended action              │
├─────────────────────────────┴────────────────────────────────┤
│ FRP baseline chart | sensor agreement | consequence bars     │
├──────────────────────────────────────────────────────────────┤
│ EVENT TIMELINE: detected → fused → classified → escalated    │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Visual language

- Blue: normal/background context.
- Amber: uncertain/verification required.
- Red: critical hazard.
- Purple: plume probability corridor.
- White line: facility boundary.
- Animated pulse: new detection.
- Solid polygon: segmented burn region.
- Dotted polygon: predicted corridor.

Do not rely on color alone. Add labels, icons, and route-state text for accessibility.

### 11.3 Essential widgets

1. **Event status pill:** `NORMAL`, `UNCERTAIN`, or `CRITICAL`.
2. **Five-class probability bars:** shows competing hypotheses.
3. **Facility baseline chart:** current FRP versus historical mean and standard deviation.
4. **Evidence cards:** thermal, spatial, temporal, sensor, consequence.
5. **Timeline:** every state transition with timestamp.
6. **Map layers:** raw points, fused event, facility, mask, corridor, exposure.
7. **Operator actions:** confirm, reject, request next pass, simulate escalation.
8. **Model/policy version:** makes the output auditable.

### 11.4 Interactive judge actions

The judge should be able to:

- Click a hotspot and inspect all evidence.
- Toggle “show raw sensors” versus “show fused event”.
- Move the incident-intensity slider.
- Change the wind direction by ±20° in simulation mode.
- Click “verify event” and watch the event rejoin the critical path.
- Toggle population/critical-asset layers.
- Replay the event timeline at 4× speed.

---

## 12. End-to-End API Contract

### 12.1 REST endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/scenarios` | GET | Available replay scenarios |
| `/scenarios/{id}/start` | POST | Start replay |
| `/scenarios/{id}/reset` | POST | Reset replay |
| `/events` | GET | List current events |
| `/events/{id}` | GET | Full event intelligence |
| `/events/{id}/verify` | POST | Confirm/reject uncertain event |
| `/events/{id}/simulate` | POST | Apply demo counterfactual |
| `/config` | GET | Thresholds and version metadata |
| `/ws/events` | WebSocket | Live event updates |

### 12.2 WebSocket message

```json
{
  "type": "event_update",
  "timestamp": "2026-09-04T17:59:12Z",
  "event_id": "evt-2026-0007",
  "changed": ["route_state", "risk_score", "plume_corridor"],
  "payload": {
    "route_state": "CRITICAL",
    "risk_score": 91,
    "recommended_action": "Pull tactical imagery and assess downwind exposure"
  }
}
```

### 12.3 Verification transition

```python
@app.post("/events/{event_id}/verify")
def verify(event_id: str, decision: str):
    event = store.get(event_id)
    if decision == "confirm":
        event.route_state = "CRITICAL"
        event.verification_status = "human_confirmed"
        event.next_action = "run_tactical_pipeline"
    elif decision == "reject":
        event.route_state = "NORMAL"
        event.verification_status = "human_rejected"
    store.append_audit(event_id, decision)
    return event
```

---

## 13. Repository and Code Organization

```text
Jvalyx/
├── README.md
├── docker-compose.yml
├── data/
│   ├── replay/
│   │   ├── persistent_flare.json
│   │   ├── wildfire.json
│   │   ├── industrial_escalation.json
│   │   └── sensor_disagreement.json
│   ├── geography/
│   ├── masks/
│   └── schemas/
├── backend/
│   ├── app.py
│   ├── api/
│   ├── models/
│   ├── pipeline/
│   │   ├── ingest.py
│   │   ├── quality.py
│   │   ├── fusion.py
│   │   ├── features.py
│   │   ├── inference.py
│   │   ├── arbitration.py
│   │   ├── segmentation.py
│   │   └── consequence.py
│   ├── storage/
│   └── tests/
├── ml/
│   ├── notebooks/
│   ├── train_catboost.py
│   ├── train_anomaly.py
│   ├── evaluate.py
│   └── artifacts/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── map/
│   │   ├── charts/
│   │   └── api/
│   └── package.json
└── docs/
    ├── architecture.md
    ├── data_dictionary.md
    └── demo_script.md
```

### Branch strategy

- `main`: demo-stable.
- `develop`: integrated development.
- `feature/backend-ingestion`, `feature/ml-triage`, `feature/dashboard`, `feature/replay-demo`.

Tag a known-good demo commit before presentation.

---

## 14. Build Phases and Deliverables

## Phase 0 — Freeze the demonstration contract

**Deliverables:**

- One-page problem statement.
- Five-class taxonomy.
- JSON schema.
- Four replay scenarios.
- Dashboard wireframe.
- Definition of `NORMAL`, `UNCERTAIN`, and `CRITICAL`.

**Exit test:** A teammate can explain the complete demo without opening the code.

## Phase 1 — Data and replay engine

**Build:**

- Canonical schema.
- JSON/CSV replay pack.
- Idempotent ingestion.
- Replay clock.
- Event store.

**Exit test:** Raw detections appear in the API and can be replayed at different speeds.

## Phase 2 — Spatial and temporal enrichment

**Build:**

- Facility point-in-polygon lookup.
- LULC lookup or demo labels.
- 90-day/rolling baseline.
- Cluster and drift features.
- Facility-level baseline.

**Exit test:** Selecting an event shows “current versus normal” evidence.

## Phase 3 — ML and arbitration

**Build:**

- CatBoost baseline classifier.
- Isolation Forest.
- Feature validation.
- Arbitration rules.
- SHAP/evidence extraction.

**Exit test:** The same scenario produces a stable route state and readable explanation.

## Phase 4 — Tactical layer

**Build:**

- Segmentation mask or reliable precomputed mask.
- Plume probability corridor.
- Population/asset consequence score.
- GeoJSON map overlays.

**Exit test:** Critical event produces mask, corridor, and consequence bars within a few seconds.

## Phase 5 — Dashboard integration

**Build:**

- WebSocket state updates.
- Map animations.
- Timeline.
- Evidence cards.
- Verification workflow.
- Counterfactual slider.

**Exit test:** A judge can use the product without explanation.

## Phase 6 — Hardening and presentation

**Build:**

- Offline mode.
- Demo reset button.
- Error states.
- Model/policy version display.
- Logging and audit trail.
- 90-second backup recording.

**Exit test:** Five consecutive full runs without manual database edits.

---

## 15. Team Work Allocation

| Role | Ownership | Definition of done |
|---|---|---|
| Data/EO engineer | Replay data, enrichment, baselines | Four scenarios and feature tables are reproducible |
| ML engineer | CatBoost, anomaly model, explainability | Inference endpoint returns stable probabilities and reasons |
| Backend engineer | APIs, storage, WebSocket, arbitration | State transitions are testable through API |
| Frontend/geospatial engineer | Map, charts, layers, interaction | Judge can inspect and manipulate event state |
| Integration/demo lead | Scenario script, testing, visual polish | Demo runs offline from a clean checkout |

If the team is small, combine data/ML and backend/frontend, but preserve an explicit demo owner.

---

## 16. Testing Strategy

### 16.1 Unit tests

- Schema validation.
- Z-score edge cases with zero standard deviation.
- Spatial matching.
- Time-window matching.
- Class 3 versus Class 5 precedence.
- Arbitration rules.
- Risk score bounds.
- GeoJSON validity.

### 16.2 Integration tests

- Replay frame → ingestion → fusion → inference → WebSocket.
- Critical route → tactical layer.
- Uncertain confirmation → critical route.
- Rejected event → audit log and normal state.
- Duplicate polling → no duplicate detection.

### 16.3 Golden scenario tests

Store expected outputs for every replay scenario:

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

### 16.4 Performance targets for MVP

- Initial dashboard load: under 3 seconds locally.
- Event classification after replay frame: under 500 ms.
- Critical tactical overlay: under 5 seconds with precomputed mask; under 15 seconds with local lightweight inference.
- WebSocket state update: under 250 ms after inference.
- Full demo replay: 3–5 minutes.

These are engineering targets for the demonstration, not claims about operational satellite latency.

---

## 17. Demo Script

## Demo title: “From Routine Heat to Critical Consequence”

### 0:00–0:20 — Problem hook

Show a map containing many unclassified hotspots.

Say:

> “A satellite can tell us that heat exists. It cannot reliably tell an operator whether this is a routine flare, a crop burn, a wildfire, or the early stage of an industrial disaster.”

### 0:20–0:55 — Establish the baseline

Open a facility digital twin. Show its historical FRP band and persistent flare behavior.

Point out:

- The hotspot is not automatically dangerous.
- Persistence alone is not enough.
- The system learns what normal looks like at the facility level.

### 0:55–1:30 — Inject the change

Press Play or move the incident slider.

Show:

- FRP rising above baseline.
- Neighboring pixels appearing.
- Sensor detections becoming corroborated.
- Facility z-score increasing.
- CatBoost probabilities changing.
- Anomaly detector becoming positive.

### 1:30–2:00 — Explain the decision

The route changes to `CRITICAL`.

Open evidence cards:

- “FRP is 5.1σ above facility normal.”
- “Six adjacent pixels indicate spatial expansion.”
- “Independent sensors agree.”
- “The event is inside an industrial polygon.”

### 2:00–2:35 — Show tactical consequence

Render the segmentation mask and plume probability corridor. Toggle population and critical asset layers.

Say:

> “We do not draw one supposedly exact plume line. We show a probability corridor because wind uncertainty is real. The consequence layer tells the operator what may be affected next.”

### 2:35–3:05 — Operator-in-the-loop

Run the sensor-disagreement scenario. The event becomes `UNCERTAIN`, not suppressed.

Click **Confirm event**. Show:

- Audit entry.
- Rejoin to critical path.
- Tactical processing triggered.
- Verified label added to feedback queue.

### 3:05–3:30 — Differentiator close

Use the counterfactual control:

> “The differentiator is not only classification. We replay the transition from normal facility behavior to abnormal consequence and let an operator interrogate the evidence and change the scenario.”

End with the five-class taxonomy and the confidence-aware routing state.

---

## 18. Demo Safety and Honesty Rules

Never claim:

- Exact real-time satellite coverage if using replay data.
- Exact fire temperature from a simplified proxy.
- Exact chemical plume dispersion.
- Production-grade emergency prediction.
- Validated accuracy from auto-labeled data alone.

Clearly display one of:

- `LIVE DATA` when a live feed is actually connected.
- `HISTORICAL REPLAY` for curated event data.
- `DEMO SIMULATION MODE` when the slider changes the event.

Include a small footer:

> “Research prototype. Outputs support analyst review and are not a substitute for official emergency response systems.”

This increases credibility rather than weakening the pitch.

---

## 19. Common Failure Modes and Mitigations

| Failure | Likely cause | Mitigation |
|---|---|---|
| Dashboard is empty | API/live feed unavailable | Always ship offline replay mode |
| Every event becomes Class 5 | Class imbalance or weak labels | Balanced training, anomaly path, curated scenarios |
| Critical alert never triggers | Threshold too strict | Golden scenario tests and explicit industrial override |
| Sensor disagreement suppresses event | Boolean fusion design | Route disagreement to `UNCERTAIN` |
| Demo looks like a generic map | No event narrative | Add baseline chart, timeline, evidence cards, counterfactual control |
| Model cannot explain output | Only class label stored | Store probabilities, features, SHAP reasons, policy version |
| Plume looks scientifically overconfident | One deterministic line | Render uncertainty corridor and label assumptions |
| Model metrics look unrealistically high | Spatial leakage/circular labels | Spatial/temporal splits and human-verified holdout |
| API latency breaks presentation | On-demand external imagery | Pre-cache demo imagery and masks |
| Team cannot reset the system | Manual state changes | One-click scenario reset and database seed script |

---

## 20. Final Definition of Done

The project is ready to demonstrate when all of the following are true:

- [ ] The complete system runs from one documented command.
- [ ] Offline replay works without internet access.
- [ ] At least four scenarios are available.
- [ ] Raw detections are fused into event objects.
- [ ] Facility baseline deviation is visible.
- [ ] CatBoost probabilities and anomaly score are visible.
- [ ] Arbitration returns `NORMAL`, `UNCERTAIN`, or `CRITICAL`.
- [ ] Sensor disagreement is never silently suppressed.
- [ ] Critical events render a mask and probability corridor.
- [ ] Population/assets affect the consequence score.
- [ ] Operator verification updates state and audit log.
- [ ] Counterfactual intensity slider produces an understandable transition.
- [ ] Model, data, and policy versions are displayed.
- [ ] Five consecutive demo runs complete without manual repair.
- [ ] A backup screen recording exists.

---

## 21. Recommended Build Order

If time becomes limited, implement in this order:

1. Replay engine and four scenarios.
2. Interactive map and event selection.
3. Facility baseline chart and anomaly transition.
4. Rule-based arbitration with visible evidence.
5. CatBoost probability output.
6. WebSocket timeline updates.
7. Precomputed segmentation and plume corridor.
8. Human verification workflow.
9. Real feed adapters.
10. SegFormer fine-tuning and richer geospatial layers.

The demo’s strongest story is not “we trained the largest model.” It is:

> **“We turn ambiguous thermal detections into explainable, confidence-aware, consequence-oriented decisions—and let an operator interrogate and replay the transition from normal to dangerous.”**

That story is technically defensible, visually distinct, and achievable with a simple architecture.
