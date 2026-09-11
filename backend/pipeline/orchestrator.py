"""Frame -> event intelligence. The single seam the replay worker and the
counterfactual endpoint both call (Backend Build Plan §5, §10)."""

from datetime import datetime, timezone
from typing import Any

from backend.config import AppConfig, load_config
from backend.models import Detection, ReplayScenario, RouteState
from backend.models.intelligence import EventIntelligence, TacticalOverlay
from backend.models.schemas import ConfidenceState, DataMode, DecisionOutput

from .arbitration import arbitrate, confidence_state, risk_score, which_rule_fired
from .consequence import assess_consequence
from .evidence import build_evidence_cards
from .features import derive_features, total_frp
from .fusion import build_fused_event
from .inference import get_inference_engine
from .inference_stub import CLASS_NAMES
from .plume import generate_plume_corridor
from .segmentation import mask_from_context

_CONFIDENCE = {"high": ConfidenceState.HIGH, "medium": ConfidenceState.MEDIUM, "low": ConfidenceState.LOW}


def _apply_deviation(
    base_frp: float, context: dict[str, Any], baseline: dict[str, float], deviation: float
) -> dict[str, Any]:
    """Port of the SPA counterfactual recompute (App.tsx ``effectiveFrame``).

    Mutates a *copy* of the frame context — never the real model output.
    """
    ctx = dict(context)
    mean = baseline.get("facility_mean", context.get("baseline_frp_mean", base_frp))
    std = baseline.get("facility_std", context.get("baseline_frp_std", 1.0))

    sim_frp = base_frp + deviation * 250.0
    sim_z = round((sim_frp - mean) / max(std, 0.1), 2)
    sim_cluster = min(8, max(1, round(1 + deviation * 6)))
    p1 = min(0.96, max(0.05, 0.10 + deviation * 0.85))
    p5 = max(0.01, 1 - p1 - 0.05)

    ctx["stub_class_probabilities"] = {
        "1": round(p1, 2),
        "2": round(0.03 + deviation * 0.02, 2),
        "3": 0.01,
        "4": 0.01,
        "5": round(p5, 2),
    }
    ctx["stub_anomaly_score"] = min(0.98, max(0.10, 0.15 + deviation * 0.82))
    ctx["frp_z_score"] = sim_z
    ctx["facility_frp_zscore"] = sim_z
    ctx["cluster_pixel_count"] = sim_cluster
    ctx["_sim_frp_mw"] = sim_frp
    return ctx


def process_frame(
    scenario: ReplayScenario,
    frame_index: int,
    *,
    deviation: float = 0.0,
    config: AppConfig | None = None,
    verification_status: str = "unverified",
    route_override: RouteState | None = None,
    inference: Any | None = None,
) -> EventIntelligence:
    """``inference`` overrides the active classifier (used to pin the stub in tests)."""
    config = config or load_config()
    engine = inference or get_inference_engine()
    frame = scenario.frames[frame_index]
    context: dict[str, Any] = dict(frame.context)
    baseline = scenario.baseline
    simulated = deviation > 0.0

    detections: list[Detection] = list(frame.detections)
    base_frp = total_frp(detections)

    if simulated:
        context = _apply_deviation(base_frp, context, baseline, deviation)
        scaled = context.pop("_sim_frp_mw", base_frp)
        lead = detections[0]
        detections = [lead.model_copy(update={"frp_mw": round(scaled, 2)})]

    mode = DataMode.DEMO_SIMULATION if simulated else scenario.mode

    centroid_lat = sum(d.latitude for d in frame.detections) / len(frame.detections)
    centroid_lon = sum(d.longitude for d in frame.detections) / len(frame.detections)

    fused = build_fused_event(
        event_id=f"evt-{scenario.scenario_id}",
        created_at=detections[0].timestamp,
        latitude=round(centroid_lat, 6),
        longitude=round(centroid_lon, 6),
        detections=detections,
        context=context,
        mode=mode,
    )

    features = derive_features(detections, context, baseline)
    prediction = engine.infer(detections, context)
    probs: dict[int, float] = prediction["class_probabilities"]

    assets, consequence, population = assess_consequence(context)
    route = route_override or arbitrate(
        probs,
        prediction["anomaly_score"],
        features,
        fused.sensor_agreement_state,
        config,
        lulc_in_vocabulary=prediction["lulc_in_vocabulary"],
    )
    fused = fused.model_copy(update={"route_state": route})

    exposure = consequence if consequence > 0 else config.risk.exposure_default
    risk = risk_score(probs, features, exposure, config)
    rule_fired = which_rule_fired(
        probs,
        prediction["anomaly_score"],
        features,
        fused.sensor_agreement_state,
        config,
        lulc_in_vocabulary=prediction["lulc_in_vocabulary"],
    )

    explanation = _explanation(context, features, probs, fused.sensor_agreement_state.value)
    decision = DecisionOutput(
        event_id=fused.event_id,
        class_id=prediction["class_id"],
        class_name=CLASS_NAMES[prediction["class_id"]],
        class_probabilities=probs,
        anomaly_score=prediction["anomaly_score"],
        route_state=route,
        risk_score=risk.total,
        confidence_state=_CONFIDENCE[confidence_state(probs)],
        explanation=explanation,
        recommended_action=str(context.get("recommended_action", "Monitor routine thermal telemetry.")),
        model_version=prediction["model_version"],
        policy_version=config.versions.policy_version,
        mode=mode,
    )

    tactical = _tactical(context, fused, config, assets, consequence, population)
    evidence = build_evidence_cards(
        features=features,
        class_probabilities=probs,
        anomaly_score=prediction["anomaly_score"],
        fusion_state=fused.sensor_agreement_state,
        rule_fired=rule_fired,
        context=context,
    )

    return EventIntelligence(
        event_id=fused.event_id,
        scenario_id=scenario.scenario_id,
        frame_index=frame_index,
        checkpoint=frame.checkpoint,
        label=str(context.get("label", f"Frame {frame_index}")),
        description=str(context.get("description", "")),
        timestamp=detections[0].timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        mode=mode,
        route_state=route,
        fused_event=fused,
        features=features,
        decision=decision,
        risk=risk,
        evidence=evidence,
        tactical=tactical,
        historical_baseline_timeline=_timeline(context, simulated, features["total_frp_mw"]),
        verification_status=verification_status,  # type: ignore[arg-type]
        simulated=simulated,
        deviation=deviation,
    )


def _explanation(
    context: dict[str, Any], features: dict[str, float], probs: dict[int, float], fusion: str
) -> list[str]:
    seeded = context.get("explanation")
    if isinstance(seeded, list) and seeded:
        return [str(line) for line in seeded]
    lines = [
        f"Facility FRP is {features['facility_frp_zscore']:+.1f} sigma from its 90-day baseline.",
        f"{int(features['cluster_pixel_count'])} linked thermal pixel(s); "
        f"trend {features['frp_trend_mw_per_hour']:+.0f} MW/h.",
        f"Sensor consensus: {fusion.replace('_', ' ')}.",
    ]
    if probs.get(1, 0.0) >= 0.45:
        lines.append(f"Model places {probs[1] * 100:.0f}% probability on an industrial fire / explosion.")
    return lines


def _tactical(
    context: dict[str, Any],
    fused: Any,
    config: AppConfig,
    assets: list,
    consequence: float,
    population: int,
) -> TacticalOverlay | None:
    has_plume = "plume_wind_speed_mps" in context
    has_mask = "segmentation" in context
    if not (has_plume or has_mask or assets):
        return None

    geojson, burn, smoke = mask_from_context(context)
    plume = None
    if has_plume:
        plume = generate_plume_corridor(
            (fused.latitude, fused.longitude),
            float(context["plume_wind_speed_mps"]),
            float(context["plume_wind_direction_deg"]),
            config,
        )
    return TacticalOverlay(
        segmentation_geojson=geojson,
        burn_area_m2=burn,
        smoke_area_m2=smoke,
        plume_corridor=plume,
        affected_assets=assets,
        consequence_score=consequence,
        population_at_risk=population,
        swir_nir_ratio=context.get("swir_nir_ratio"),
        delta_nbr=context.get("delta_nbr"),
        delta_ndvi=context.get("delta_ndvi"),
    )


def _timeline(context: dict[str, Any], simulated: bool, sim_frp: float) -> list[dict[str, float | str]]:
    rows = [dict(r) for r in context.get("historical_baseline_timeline", [])]
    if simulated and rows:
        rows[-1]["observedFRP"] = round(sim_frp, 2)
    return rows
