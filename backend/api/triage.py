"""Live single-detection triage.

Routes one raw NASA FIRMS detection through the same deterministic pipeline the replay
engine uses — real industrial-polygon lookup, the trained CatBoost classifier, the
Isolation Forest anomaly score, and the arbitration/risk formulas — instead of the
frontend's hardcoded heuristic bucket table (``frontend/src/firms/analysis/triage.ts``).

Known gap: ``lulc_class`` has no live source in this repo (see
``backend/models/artifacts/README.md`` §"Measured vocabulary"). Every live point outside
a mapped industrial polygon lands in the model's unknown-land-cover bucket, so
``lulc_in_vocabulary`` is returned on every response and the frontend should surface it.
``is_in_industrial_polygon`` and ``distance_to_industrial_m`` ARE real for any coordinate
(``backend/pipeline/polygons.py``) — this endpoint costs nothing on that axis.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.config import load_config
from backend.models import Detection
from backend.models.intelligence import RiskBreakdown
from backend.models.schemas import DataMode
from backend.pipeline.arbitration import arbitrate, confidence_state, risk_score
from backend.pipeline.features import derive_features
from backend.pipeline.fusion import build_fused_event
from backend.pipeline.inference import get_inference_engine
from backend.pipeline.polygons import distance_to_industrial_m, is_in_industrial_polygon
from backend.pipeline.protected_areas import find_protected_area

router = APIRouter(prefix="/api/triage", tags=["triage"])


class LiveDetectionIn(BaseModel):
    id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    brightness: float = Field(ge=0)
    brightness_secondary: float | None = Field(default=None, ge=0)
    frp: float = Field(ge=0)
    scan: float | None = Field(default=None, gt=0)
    track: float | None = Field(default=None, gt=0)
    confidence_level: Literal["low", "nominal", "high"] = "nominal"
    daynight: Literal["D", "N"] = "D"
    acquired_at: datetime
    instrument: str = "VIIRS"


class LiveTriageOut(BaseModel):
    id: str
    class_id: int
    class_name: str
    class_probabilities: dict[int, float]
    anomaly_score: float
    route_state: str
    confidence_state: str
    risk: RiskBreakdown
    facility_frp_zscore: float
    is_in_industrial_polygon: bool
    distance_to_industrial_m: float
    matched_facility: str | None
    lulc_in_vocabulary: bool
    protected_area: str | None
    model_version: str
    anomaly_model_version: str


def _to_detection(item: LiveDetectionIn) -> Detection:
    sensor: Literal["VIIRS", "MODIS", "REPLAY"] = (
        "MODIS" if item.instrument.upper().startswith("MODIS") else "VIIRS"
    )
    ts = item.acquired_at if item.acquired_at.tzinfo else item.acquired_at.replace(tzinfo=timezone.utc)
    return Detection(
        detection_id=item.id,
        sensor=sensor,
        timestamp=ts,
        latitude=item.latitude,
        longitude=item.longitude,
        frp_mw=item.frp,
        bright_ti4_k=item.brightness,
        bright_ti5_k=item.brightness_secondary,
        scan_km=item.scan,
        track_km=item.track,
        confidence=item.confidence_level,
        daynight=1 if item.daynight == "D" else 0,
    )


@router.post("/classify", response_model=LiveTriageOut)
async def classify_live_detection(item: LiveDetectionIn) -> LiveTriageOut:
    """Classify one live FIRMS pixel: real industrial-polygon context + trained model.

    Treated as a single-detection "event" — the live map hands us one pixel with no
    cross-sensor fusion window, unlike the curated replay scenarios.
    """
    config = load_config()
    engine = get_inference_engine()
    detection = _to_detection(item)

    in_poly, poly_match = is_in_industrial_polygon(item.latitude, item.longitude)
    dist_m, nearest = distance_to_industrial_m(item.latitude, item.longitude)
    match = poly_match or nearest
    matched_name = (match.get("name") or match.get("coal_industrial_zone")) if match else None

    # No live LULC raster/service exists in this repo. Two real, already-mapped boundary
    # sets give a genuine (not guessed) trained-vocabulary signal for the rest: an
    # industrial-polygon match is built-up (ESA WorldCover "50"), a protected-area match
    # is tree cover ("10"). Everything else is left unset -> the model's unknown bucket,
    # same as before — this narrows the gap, it does not close it (e.g. cropland/40 isn't
    # even in the artifact's trained vocabulary; see backend/models/artifacts/README.md).
    protected_area = None if in_poly else find_protected_area(item.latitude, item.longitude)
    lulc_class: str | None = "50" if in_poly else "10" if protected_area else None

    # derive_features() defaults data_quality_score to 0.0 when absent from context, which
    # always fails arbitrate()'s `quality < min_quality` check and forces every live call to
    # RouteState.UNCERTAIN regardless of model confidence. Ground it in FIRMS's own per-pixel
    # confidence_level (the one real quality signal this endpoint has) instead of leaving it
    # unset — "low" still lands below min_quality (0.45) and stays uncertain, as it should.
    context: dict = {
        "is_in_industrial_polygon": in_poly,
        "distance_to_industrial_m": dist_m if dist_m != float("inf") else 999_999.0,
        "lulc_class": lulc_class,
        "lulc_entropy_500m": 0.0,
        "stub_anomaly_score": 0.1,
        "data_quality_score": {"low": 0.4, "nominal": 0.7, "high": 0.9}[item.confidence_level],
    }

    prediction = engine.infer([detection], context, live=True)
    probs = prediction["class_probabilities"]
    features = derive_features([detection], context, baseline={})
    fused = build_fused_event(
        event_id=f"live-{item.id}",
        created_at=detection.timestamp,
        latitude=item.latitude,
        longitude=item.longitude,
        detections=[detection],
        context=context,
        mode=DataMode.LIVE_DATA,
    )
    route = arbitrate(
        probs,
        prediction["anomaly_score"],
        features,
        fused.sensor_agreement_state,
        config,
        lulc_in_vocabulary=prediction["lulc_in_vocabulary"],
    )
    exposure = config.risk.exposure_default if in_poly else 0.35
    risk = risk_score(probs, features, exposure, config)

    return LiveTriageOut(
        id=item.id,
        class_id=prediction["class_id"],
        class_name=prediction["class_name"],
        class_probabilities=probs,
        anomaly_score=prediction["anomaly_score"],
        route_state=route.value,
        confidence_state=confidence_state(probs),
        risk=risk,
        facility_frp_zscore=features["facility_frp_zscore"],
        is_in_industrial_polygon=in_poly,
        distance_to_industrial_m=round(dist_m, 1) if dist_m != float("inf") else -1.0,
        matched_facility=matched_name,
        lulc_in_vocabulary=prediction["lulc_in_vocabulary"],
        protected_area=protected_area.name if protected_area else None,
        model_version=prediction["model_version"],
        anomaly_model_version=prediction["anomaly_model_version"],
    )
