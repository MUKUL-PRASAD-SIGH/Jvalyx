"""Sensor fusion: agreement state and the transport-safe FusedEvent (math doc §7)."""

from datetime import datetime
from typing import Any

from backend.models import Detection, FusedEvent, RouteState, SensorAgreementState
from backend.models.schemas import DataMode

from .quality import quality_score

HIGH_QUALITY_THRESHOLD = 0.5


def fusion_state(detections: list[Detection]) -> SensorAgreementState:
    """Categorical 3(+1) fusion state:
    - single_sensor: 1 quality-passed detection
    - multi_sensor_same_instrument: >=2 quality-passed detections from the same instrument
    - multi_sensor_cross_confirmed: quality-passed detections cross-confirmed across >=2 instruments (VIIRS + MODIS)
    - disagreement: conflicting detections or detections failing quality checks
    """
    if not detections:
        return SensorAgreementState.UNKNOWN

    high_quality = [d for d in detections if quality_score(d) >= HIGH_QUALITY_THRESHOLD]
    if not high_quality:
        return SensorAgreementState.DISAGREEMENT

    sensors = {d.sensor for d in high_quality}
    if len(sensors) >= 2:
        return SensorAgreementState.MULTI_SENSOR_CROSS_CONFIRMED

    if len(high_quality) >= 2:
        return SensorAgreementState.MULTI_SENSOR_SAME_INSTRUMENT

    if len(detections) > 1 and len(high_quality) == 1:
        return SensorAgreementState.DISAGREEMENT

    return SensorAgreementState.SINGLE_SENSOR


def agreement_score(detections: list[Detection]) -> float:
    """Quality-weighted pairwise agreement in roughly [0, 1] (math doc §7.4)."""
    if len(detections) < 2:
        return 1.0 if detections else 0.0
    numerator = denominator = 0.0
    for i in range(len(detections)):
        for j in range(i + 1, len(detections)):
            weight = quality_score(detections[i]) * quality_score(detections[j])
            same_time = abs((detections[i].timestamp - detections[j].timestamp).total_seconds()) <= 45 * 60
            numerator += weight * (1.0 if same_time else 0.0)
            denominator += weight
    return numerator / max(denominator, 1e-6)


def build_fused_event(
    *,
    event_id: str,
    created_at: datetime,
    latitude: float,
    longitude: float,
    detections: list[Detection],
    context: dict[str, Any],
    mode: DataMode,
    route_state: RouteState = RouteState.UNCERTAIN,
) -> FusedEvent:
    """Assemble the stable FusedEvent consumed by feature and decision layers.

    The curated scenario ``context`` may pin an explicit ``sensor_agreement_state``;
    otherwise it is derived from the detection quality mix.
    """
    pinned = context.get("sensor_agreement_state")
    if pinned in ("agreement", "full_agreement"):
        pinned = SensorAgreementState.MULTI_SENSOR_CROSS_CONFIRMED
    elif pinned in ("single_sensor_high_res",):
        pinned = SensorAgreementState.SINGLE_SENSOR
    elif pinned in ("temporally_confirmed_spatially_coarse",):
        pinned = SensorAgreementState.MULTI_SENSOR_CROSS_CONFIRMED

    try:
        state = SensorAgreementState(pinned) if pinned else fusion_state(detections)
    except ValueError:
        state = fusion_state(detections)

    high_quality = [d for d in detections if quality_score(d) >= HIGH_QUALITY_THRESHOLD]
    corroboration_count = len(high_quality)
    data_quality_pass = len(high_quality) > 0 and all(quality_score(d) >= HIGH_QUALITY_THRESHOLD for d in detections)

    return FusedEvent(
        event_id=event_id,
        created_at=created_at,
        latitude=latitude,
        longitude=longitude,
        detections=detections,
        sensor_count=int(context.get("sensor_count", len({d.sensor for d in detections}))),
        corroboration_count=corroboration_count,
        data_quality_pass=data_quality_pass,
        sensor_agreement_state=state,
        data_quality_flag=str(context.get("data_quality_flag", "UNKNOWN")),
        facility_id=context.get("facility_id"),
        facility_type=str(context.get("facility_type", "none")),
        persistence_score=float(context.get("persistence_score", 0.0)),
        facility_frp_zscore=float(context.get("facility_frp_zscore", 0.0)),
        route_state=route_state,
        mode=mode,
    )
