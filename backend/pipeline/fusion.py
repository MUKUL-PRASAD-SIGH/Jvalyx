"""Sensor fusion: agreement state and the transport-safe FusedEvent (math doc §7)."""

from datetime import datetime
from typing import Any

from backend.models import Detection, FusedEvent, RouteState, SensorAgreementState
from backend.models.schemas import DataMode

from .quality import quality_score

HIGH_QUALITY_THRESHOLD = 0.5


def fusion_state(detections: list[Detection]) -> SensorAgreementState:
    """Categorical fusion state. ``disagreement`` must never collapse to 'no fire'."""
    high_quality = [d for d in detections if quality_score(d) >= HIGH_QUALITY_THRESHOLD]
    sensors = {d.sensor for d in high_quality}
    if len(sensors) >= 2:
        return SensorAgreementState.AGREEMENT
    if len(detections) >= 1 and not high_quality:
        return SensorAgreementState.DISAGREEMENT
    if sensors & {"VIIRS", "MODIS", "INSAT"}:
        return SensorAgreementState.SINGLE_SENSOR
    return SensorAgreementState.UNKNOWN


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
    try:
        state = SensorAgreementState(pinned) if pinned else fusion_state(detections)
    except ValueError:
        state = fusion_state(detections)

    return FusedEvent(
        event_id=event_id,
        created_at=created_at,
        latitude=latitude,
        longitude=longitude,
        detections=detections,
        sensor_count=int(context.get("sensor_count", len({d.sensor for d in detections}))),
        sensor_agreement_state=state,
        data_quality_flag=str(context.get("data_quality_flag", "UNKNOWN")),
        facility_id=context.get("facility_id"),
        facility_type=str(context.get("facility_type", "none")),
        persistence_score=float(context.get("persistence_score", 0.0)),
        facility_frp_zscore=float(context.get("facility_frp_zscore", 0.0)),
        route_state=route_state,
        mode=mode,
    )
