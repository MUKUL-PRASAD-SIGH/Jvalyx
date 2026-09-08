# Cross-layer findings

Discrepancies the backend work surfaced that live in **other layers** (frontend / ML /
docs / infra). Logged here for the owners of those layers — the backend team does not fix
these.

_Last updated: 2026-09-08._

---

## Docs

| # | Finding | Suggested fix |
|---|---|---|
| D1 | `docs/Jvalyx_Comprehensive_Build_Plan.md` was reflowed by a markdown auto-formatter (tables re-padded, trailing double-spaces stripped). It joined several bold intro lines onto one line (`...intelligence product.**Recommended MVP:**`). Not a backend change. | `git checkout -- docs/Jvalyx_Comprehensive_Build_Plan.md`, then disable format-on-save for that file or commit a clean reformat deliberately. |

## Frontend ↔ backend contract mismatches

The backend is now the source of truth for arbitration/risk/classification. These field
vocabularies differ and must be reconciled when `App.tsx` is wired to `services/api.ts`:

| # | Frontend (`types/index.ts`) | Backend (`models/schemas.py`) |
|---|---|---|
| F1 | `SensorAgreementState` = `full_agreement \| temporally_confirmed_spatially_coarse \| single_sensor_high_res \| disagreement` | `agreement \| single_sensor \| disagreement \| unknown` |
| F2 | `DecisionOutput.confidence_state` = `'low' \| 'moderate' \| 'high'` | `'low' \| 'medium' \| 'high'` |
| F3 | `Detection.quality_score`, `Detection.sun_glint_flag` are top-level | backend `Detection` forbids extras; those go under `raw_quality` |
| F4 | `FusedEvent` carries `frp_z_score`, `cluster_pixel_count`, `centroid_drift_velocity_mph`, `lulc_class`, etc. directly | backend `FusedEvent` is minimal; those are in `EventIntelligence.features` |
| F5 | Frontend `RiskBreakdown`/`ScenarioFrame` shapes are camelCase and nested differently from `EventIntelligence` | add a mapping layer in `services/api.ts` or a backend response adapter |

## Frontend logic issues

| # | Finding | Location |
|---|---|---|
| L1 | `generatePlumeCorridor` runs a Monte Carlo sampling loop, then discards every sample (`void dLat; void dLon;`) and draws a fixed ±24°/±12° cone. The "Monte Carlo" is dead code. The backend `pipeline/plume.py` port actually uses the sampled bearing spread. | `frontend/src/utils/math.ts` |
| L2 | `fetchLiveFIRMS` calls `https://firms.modaps.eosdis.nasa.gov/...` directly from the browser with a user-pasted `MAP_KEY`. Key is exposed client-side and the call is CORS-fragile. Should proxy through the backend (endpoint not yet built — flag if you want it). | `frontend/src/services/firms.ts` |
| L3 | Operator audit log is React state only — lost on refresh. The backend now persists it (`/audit`); wire the modal to that endpoint. | `frontend/src/components/AuditLogModal.tsx`, `App.tsx` |
| L4 | The counterfactual recompute in `App.tsx` (`effectiveFrame`) duplicates logic now owned by `POST /events/{id}/simulate`. Prefer the endpoint; keep local recompute only as an offline fallback. | `frontend/src/App.tsx` |

## ML

| # | Finding |
|---|---|
| M1 | No `ml/` directory, no training code, no model artifacts anywhere in the repo. |
| M2 | Frontend emits `model_version: "triage-0.1.0"` / `"catboost-firms-0.1.0"`, implying a trained model that does not exist. Backend is honest: `stub-0.1.0`. Align the frontend strings, or have the frontend read `model_version` from `GET /config` / the event payload. |
| M3 | Class probabilities, anomaly scores, segmentation masks and 90-day baselines are all hand-authored in `data/replay/*.json`. When real models land, only `backend/pipeline/inference_stub.py` and the segmentation/baseline feeds change. |

## Infra

| # | Finding |
|---|---|
| I1 | `frontend/` has no Dockerfile and is not in `docker-compose.yml` (only the API service is). Add a frontend service if a one-command full-stack demo is wanted. |
