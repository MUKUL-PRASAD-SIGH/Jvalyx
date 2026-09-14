"""Live FIRMS detection triage, one detection or thousands at once.

Routes raw NASA FIRMS detections through the same deterministic pipeline the replay engine
uses — training-matched industrial polygons, live ESA WorldCover land cover, the trained
CatBoost classifier, the Isolation Forest anomaly score, and the arbitration/risk formulas.

``POST /classify`` returns the full triage for one detection (the hotspot panel).
``POST /classify-batch`` classifies every detection the live map has loaded in one call, so
the map shows model classes as soon as data loads instead of only for clicked fires. Both
share ``classify_detections``, so a clicked fire always matches its batch result.

``lulc_class`` comes from ESA WorldCover (``backend/pipeline/landcover.py``, cached);
``is_in_industrial_polygon`` and ``distance_to_industrial_m`` from the same OSM polygons as
training (``backend/pipeline/training_polygons.py``).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from backend.config import load_config
from backend.models import Detection
from backend.models.intelligence import RiskBreakdown
from backend.models.schemas import DataMode
from backend.pipeline import recurrence as fire_history
from backend.pipeline.arbitration import arbitrate, confidence_state, risk_score
from backend.pipeline.features import derive_features
from backend.pipeline.fusion import build_fused_event
from backend.pipeline.inference import active_model_version, get_inference_engine
from backend.pipeline.landcover import describe_rule, lookup_landcover_batch
from backend.pipeline.polygons import is_in_industrial_polygon
from backend.pipeline.protected_areas import find_protected_area
from backend.pipeline.training_polygons import training_polygon_features

router = APIRouter(prefix="/api/triage", tags=["triage"])

MAX_BATCH = 5000


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
    lulc_class: str | None = None
    landcover_rule: str | None = None
    protected_area: str | None
    recurrence_days_90d: int = 0
    #: False when the local FIRMS history doesn't cover the full 90 days before this detection,
    #: so the recurrence count may be too low; the route is then UNCERTAIN.
    history_complete: bool = True
    model_version: str
    anomaly_model_version: str


class LiveTriageBatchIn(BaseModel):
    detections: list[LiveDetectionIn] = Field(max_length=MAX_BATCH)


class LiveTriageBatchItem(BaseModel):
    id: str
    class_id: int
    class_name: str
    class_probabilities: dict[int, float]
    anomaly_score: float
    route_state: str
    confidence_state: str


class LiveTriageBatchOut(BaseModel):
    results: list[LiveTriageBatchItem]
    model_version: str


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


def classify_detections(items: list[LiveDetectionIn]) -> list[LiveTriageOut]:
    """Full live triage for many detections, each treated as a single-detection event.

    Blocking (land-cover fetches for uncached cells); call from a thread pool.
    """
    if not items:
        return []
    config = load_config()
    engine = get_inference_engine()
    detections = [_to_detection(item) for item in items]
    landcover = lookup_landcover_batch([(item.latitude, item.longitude) for item in items])

    # Every classified detection extends the local history (its own day never counts toward
    # its own recurrence), then each gets the count of earlier burning days at its spot.
    day_points = [(d.latitude, d.longitude, d.timestamp.date()) for d in detections]
    fire_history.record_detections(day_points)
    recurrences = fire_history.recurrence_days_batch(day_points)
    fire_history.maybe_sync_async()

    contexts: list[dict] = []
    extras: list[tuple] = []
    for item, (worldcover_code, lulc_entropy), (recurrence_days, history_complete) in zip(
        items, landcover, recurrences
    ):
        # Model inputs come from the same OSM polygons and edge distance used in training
        # (training_polygons.py). The curated set only supplies a readable name/zone.
        osm = training_polygon_features(item.latitude, item.longitude)
        in_poly = osm.is_in_industrial_polygon
        dist_m = osm.distance_to_industrial_m
        _, curated_match = is_in_industrial_polygon(item.latitude, item.longitude)
        # Same 3.5 km "near a facility" radius the frontend uses; farther names would mislead.
        matched_name = (
            (curated_match.get("name") or curated_match.get("coal_industrial_zone"))
            if curated_match
            else osm.name if dist_m <= 3_500.0 else None
        )
        # If WorldCover is unreachable, fall back to the mapped boundary sets: an industrial
        # polygon is built-up ("50"), a protected area is tree cover ("10").
        protected_area = None if in_poly else find_protected_area(item.latitude, item.longitude)
        lulc_class = worldcover_code or ("50" if in_poly else "10" if protected_area else None)

        # derive_features() defaults data_quality_score to 0.0 when absent from context, which
        # always fails arbitrate()'s `quality < min_quality` check and forces every live call to
        # RouteState.UNCERTAIN regardless of model confidence. Ground it in FIRMS's own per-pixel
        # confidence_level (the one real quality signal here) instead of leaving it unset.
        contexts.append({
            "is_in_industrial_polygon": in_poly,
            "distance_to_industrial_m": dist_m,
            "lulc_class": lulc_class,
            "lulc_entropy_500m": lulc_entropy,
            "facility_type": osm.facility_type,
            "recurrence_days_90d": recurrence_days,
            "stub_anomaly_score": 0.1,
            "data_quality_score": {"low": 0.4, "nominal": 0.7, "high": 0.9}[item.confidence_level],
        })
        extras.append((in_poly, dist_m, matched_name, protected_area, lulc_class, recurrence_days, history_complete))

    predictions = engine.infer_batch([([det], ctx) for det, ctx in zip(detections, contexts)])

    results: list[LiveTriageOut] = []
    for item, detection, context, prediction, extra in zip(items, detections, contexts, predictions, extras):
        in_poly, dist_m, matched_name, protected_area, lulc_class, recurrence_days, history_complete = extra
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
            history_complete=history_complete,
            on_water=(lulc_class or "").split(".")[0] == "80",
        )
        exposure = config.risk.exposure_default if in_poly else 0.35
        results.append(LiveTriageOut(
            id=item.id,
            class_id=prediction["class_id"],
            class_name=prediction["class_name"],
            class_probabilities=probs,
            anomaly_score=prediction["anomaly_score"],
            route_state=route.value,
            confidence_state=confidence_state(probs),
            risk=risk_score(probs, features, exposure, config),
            facility_frp_zscore=features["facility_frp_zscore"],
            is_in_industrial_polygon=in_poly,
            distance_to_industrial_m=round(dist_m, 1),
            matched_facility=matched_name,
            lulc_in_vocabulary=prediction["lulc_in_vocabulary"],
            lulc_class=lulc_class,
            landcover_rule=describe_rule(prediction.get("landcover_rule")),
            protected_area=protected_area.name if protected_area else None,
            recurrence_days_90d=recurrence_days,
            history_complete=history_complete,
            model_version=prediction["model_version"],
            anomaly_model_version=prediction["anomaly_model_version"],
        ))
    return results


@router.post("/classify", response_model=LiveTriageOut)
async def classify_live_detection(item: LiveDetectionIn) -> LiveTriageOut:
    """Full triage for one live FIRMS pixel (no cross-sensor fusion window)."""
    return (await run_in_threadpool(classify_detections, [item]))[0]


@router.post("/classify-batch", response_model=LiveTriageBatchOut)
async def classify_live_batch(payload: LiveTriageBatchIn) -> LiveTriageBatchOut:
    """Classify up to ``MAX_BATCH`` live detections at once (class + route per detection)."""
    results = await run_in_threadpool(classify_detections, payload.detections)
    return LiveTriageBatchOut(
        results=[
            LiveTriageBatchItem(
                id=r.id,
                class_id=r.class_id,
                class_name=r.class_name,
                class_probabilities=r.class_probabilities,
                anomaly_score=r.anomaly_score,
                route_state=r.route_state,
                confidence_state=r.confidence_state,
            )
            for r in results
        ],
        model_version=results[0].model_version if results else active_model_version(),
    )
