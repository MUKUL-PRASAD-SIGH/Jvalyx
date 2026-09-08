"""Generate ``data/replay/*.json`` from structured scenario definitions.

The frontend SPA (``frontend/src/data/scenarios.ts``) is the reference. This script
ports those scenarios into backend replay packs that validate against
``backend.models.replay.ReplayScenario`` so the backend pipeline becomes the single
source of truth for arbitration, risk, classification and tactical overlays.

Run:  ``python -m backend.tools.build_replay_pack``
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPLAY_DIR = Path(__file__).parents[2] / "data" / "replay"

SCHEMA_VERSION = "replay-1.0.0"


def _detection(
    detection_id: str,
    sensor: str,
    timestamp: str,
    lat: float,
    lon: float,
    frp: float,
    ti4: float,
    ti5: float,
    *,
    scan: float = 0.38,
    track: float = 0.38,
    confidence: str = "high",
    cloud_flag: bool = False,
    quality_score: float = 0.95,
    sun_glint: bool = False,
) -> dict[str, Any]:
    return {
        "detection_id": detection_id,
        "sensor": sensor,
        "timestamp": timestamp,
        "latitude": lat,
        "longitude": lon,
        "frp_mw": frp,
        "bright_ti4_k": ti4,
        "bright_ti5_k": ti5,
        "scan_km": scan,
        "track_km": track,
        "confidence": confidence,
        "cloud_flag": cloud_flag,
        "raw_quality": {"quality_score": quality_score, "sun_glint_flag": sun_glint},
    }


def _frame(
    scenario_id: str,
    index: int,
    elapsed_seconds: float,
    checkpoint: str | None,
    label: str,
    description: str,
    detections: list[dict[str, Any]],
    context: dict[str, Any],
) -> dict[str, Any]:
    return {
        "frame_id": f"{scenario_id}:{index}",
        "elapsed_seconds": elapsed_seconds,
        "checkpoint": checkpoint,
        "detections": detections,
        "context": {"label": label, "description": description, **context},
    }


# --------------------------------------------------------------------------------------
# Shared tactical / consequence fixtures (ported from scenarios.ts)
# --------------------------------------------------------------------------------------

MRPL_ASSETS = [
    {
        "id": "ast-01",
        "name": "Crude Oil Storage Tank Farm 4",
        "type": "tank_farm",
        "latitude": 12.979,
        "longitude": 74.842,
        "distance_m": 420,
        "criticality_weight": 0.95,
    },
    {
        "id": "ast-02",
        "name": "National Highway 66 Corridor",
        "type": "pipeline",
        "latitude": 12.974,
        "longitude": 74.831,
        "distance_m": 850,
        "criticality_weight": 0.70,
    },
    {
        "id": "ast-03",
        "name": "Baikampady Residential Sector",
        "type": "settlement",
        "latitude": 12.969,
        "longitude": 74.845,
        "distance_m": 1250,
        "population_at_risk": 14500,
        "criticality_weight": 0.90,
    },
]


def _baseline_timeline(mean: float, std: float, observed_current: float) -> list[dict[str, float]]:
    pts = [
        ("Day -80", observed_current * 0 + mean - 0.6, mean - 2.2),
        ("Day -60", mean - 0.3, mean + 1.7),
        ("Day -40", mean - 0.1, mean + 1.1),
        ("Day -20", mean, mean - 0.6),
    ]
    rows = [
        {
            "day": day,
            "mean": round(m, 2),
            "upper1Sigma": round(m + std, 2),
            "upper3Sigma": round(m + 3 * std, 2),
            "observedFRP": round(obs, 2),
        }
        for day, m, obs in pts
    ]
    rows.append(
        {
            "day": "Current",
            "mean": round(mean, 2),
            "upper1Sigma": round(mean + std, 2),
            "upper3Sigma": round(mean + 3 * std, 2),
            "observedFRP": round(observed_current, 2),
        }
    )
    return rows


# --------------------------------------------------------------------------------------
# Scenario 1: Industrial escalation (4 frames, signature demo)
# --------------------------------------------------------------------------------------

def industrial_escalation() -> dict[str, Any]:
    sid = "industrial_escalation"
    mean, std = 38.4, 7.2
    facility_ctx = {
        "facility_id": "fac-mrpl-01",
        "facility_name": "MRPL Petrochemical Complex",
        "facility_type": "Petrochemical Refining",
        "lulc_class": "industrial_developed",
        "lulc_entropy_500m": 1.84,
        "is_in_industrial_polygon": True,
        "is_mine_polygon": False,
        "distance_to_industrial_m": 0,
        "persistence_score": 0.91,
        "baseline_frp_mean": mean,
        "baseline_frp_std": std,
    }

    frames = [
        _frame(
            sid, 0, 0.0, "baseline",
            "T+00m: Baseline Operational Flaring",
            "Single thermal source at the primary flare stack. Radiation within normal historical distribution.",
            [_detection("det-viirs-01", "VIIRS", "2026-09-05T10:14:22Z", 12.9782, 74.8379, 41.2, 342.5, 295.1)],
            {
                **facility_ctx,
                "sensor_agreement_state": "single_sensor",
                "sensor_count": 1,
                "data_quality_flag": "NOMINAL",
                "data_quality_score": 0.95,
                "frp_z_score": 0.39,
                "facility_frp_zscore": 0.39,
                "cluster_pixel_count": 1,
                "centroid_drift_velocity_mph": 0.0,
                "frp_trend_mw_per_hour": 1.2,
                "stub_class_probabilities": {"1": 0.05, "2": 0.02, "3": 0.01, "4": 0.02, "5": 0.90},
                "stub_anomaly_score": 0.12,
                "recommended_action": "Routine tracking against 90-day baseline. No operator escalation.",
                "historical_baseline_timeline": _baseline_timeline(mean, std, 41.2),
            },
        ),
        _frame(
            sid, 1, 600.0, "before_anomaly",
            "T+10m: Routine Overpass — Pre-Anomaly",
            "Flare output nudges up but stays inside the +/-1 sigma operational envelope. Still a single persistent hotspot.",
            [_detection("det-viirs-01b", "VIIRS", "2026-09-05T10:24:30Z", 12.9782, 74.8380, 44.6, 345.0, 296.0)],
            {
                **facility_ctx,
                "sensor_agreement_state": "single_sensor",
                "sensor_count": 1,
                "data_quality_flag": "NOMINAL",
                "data_quality_score": 0.95,
                "frp_z_score": 0.86,
                "facility_frp_zscore": 0.86,
                "cluster_pixel_count": 1,
                "centroid_drift_velocity_mph": 0.0,
                "frp_trend_mw_per_hour": 20.4,
                "stub_class_probabilities": {"1": 0.08, "2": 0.02, "3": 0.01, "4": 0.02, "5": 0.87},
                "stub_anomaly_score": 0.21,
                "recommended_action": "Continue routine tracking. Trend positive but within tolerance.",
                "historical_baseline_timeline": _baseline_timeline(mean, std, 44.6),
            },
        ),
        _frame(
            sid, 2, 1200.0, "first_escalation",
            "T+20m: Multi-Pixel Surge Detected",
            "Facility FRP spikes to 112 MW (Z = 10.2). Three adjacent thermal pixels ignite near crude storage sector.",
            [
                _detection("det-viirs-02a", "VIIRS", "2026-09-05T10:34:10Z", 12.9782, 74.8380, 62.4, 368.1, 298.4),
                _detection("det-viirs-02b", "VIIRS", "2026-09-05T10:34:10Z", 12.9788, 74.8410, 49.8, 361.0, 297.8),
                _detection("det-modis-01", "MODIS", "2026-09-05T10:33:45Z", 12.9790, 74.8398, 98.0, 350.2, 299.1,
                           scan=1.0, track=1.0, quality_score=0.90),
            ],
            {
                **facility_ctx,
                "sensor_agreement_state": "agreement",
                "sensor_count": 2,
                "data_quality_flag": "NOMINAL",
                "data_quality_score": 0.95,
                "frp_z_score": 10.22,
                "facility_frp_zscore": 10.22,
                "cluster_pixel_count": 3,
                "centroid_drift_velocity_mph": 240.0,
                "frp_trend_mw_per_hour": 212.4,
                "stub_class_probabilities": {"1": 0.82, "2": 0.08, "3": 0.01, "4": 0.01, "5": 0.08},
                "stub_anomaly_score": 0.89,
                "recommended_action": "Trigger high-priority industrial response. Mobilize on-site containment and generate plume dispersion corridor.",
                "swir_nir_ratio": 1.48,
                "delta_nbr": 0.42,
                "delta_ndvi": -0.31,
                "plume_wind_speed_mps": 6.5,
                "plume_wind_direction_deg": 135,
                "segmentation": {
                    "type": "Polygon",
                    "coordinates": [[
                        [12.9775, 74.8375], [12.9805, 74.8385], [12.9798, 74.8430],
                        [12.9765, 74.8420], [12.9775, 74.8375],
                    ]],
                    "burnAreaM2": 28400,
                    "smokeAreaM2": 84000,
                },
                "affected_assets": MRPL_ASSETS,
                "historical_baseline_timeline": _baseline_timeline(mean, std, 112.2),
            },
        ),
        _frame(
            sid, 3, 2400.0, "critical_state",
            "T+40m: Full Petrochemical Emergency",
            "Severe escalation: 290 MW thermal release. Heavy smoke plume pushing south-southeast toward residential zones.",
            [
                _detection("det-viirs-03a", "VIIRS", "2026-09-05T10:54:10Z", 12.9785, 74.8385, 95.0, 375.0, 308.2),
                _detection("det-viirs-03b", "VIIRS", "2026-09-05T10:54:10Z", 12.9795, 74.8425, 115.0, 380.5, 312.0),
                _detection("det-viirs-03c", "VIIRS", "2026-09-05T10:54:10Z", 12.9802, 74.8440, 80.0, 369.0, 304.5),
                _detection("det-modis-02", "MODIS", "2026-09-05T10:53:15Z", 12.9790, 74.8410, 285.0, 362.4, 305.2,
                           scan=1.0, track=1.0, quality_score=0.90),
            ],
            {
                **facility_ctx,
                "sensor_agreement_state": "agreement",
                "sensor_count": 2,
                "data_quality_flag": "NOMINAL",
                "data_quality_score": 0.95,
                "frp_z_score": 34.94,
                "facility_frp_zscore": 34.94,
                "cluster_pixel_count": 6,
                "centroid_drift_velocity_mph": 310.0,
                "frp_trend_mw_per_hour": 440.0,
                "stub_class_probabilities": {"1": 0.95, "2": 0.03, "3": 0.01, "4": 0.00, "5": 0.01},
                "stub_anomaly_score": 0.98,
                "recommended_action": "CRITICAL EMERGENCY: Issue regional downwind shelter/evacuation advisory. Dispatch industrial firefighting units.",
                "swir_nir_ratio": 2.15,
                "delta_nbr": 0.68,
                "delta_ndvi": -0.52,
                "plume_wind_speed_mps": 8.2,
                "plume_wind_direction_deg": 142,
                "segmentation": {
                    "type": "Polygon",
                    "coordinates": [[
                        [12.9760, 74.8360], [12.9825, 74.8380], [12.9820, 74.8465],
                        [12.9750, 74.8445], [12.9760, 74.8360],
                    ]],
                    "burnAreaM2": 78200,
                    "smokeAreaM2": 245000,
                },
                "affected_assets": [
                    {**MRPL_ASSETS[0], "distance_m": 50, "criticality_weight": 1.0},
                    {**MRPL_ASSETS[2], "distance_m": 950, "criticality_weight": 0.95},
                    {**MRPL_ASSETS[1], "distance_m": 620, "criticality_weight": 0.75},
                ],
                "historical_baseline_timeline": _baseline_timeline(mean, std, 290.0),
            },
        ),
    ]

    return {
        "schema_version": SCHEMA_VERSION,
        "scenario_id": sid,
        "title": "Mangalore Refinery — Thermal Escalation",
        "description": "Routine gas flare transitioning into a crude tank-farm surge (Class 1 escalation).",
        "mode": "HISTORICAL REPLAY",
        "source_provenance": "Curated from historical NASA FIRMS VIIRS/MODIS detections over MRPL, Mangalore.",
        "classification_note": "Escalation frames are illustrative. Stub inference stands in for the trained CatBoost/Isolation Forest models.",
        "baseline": {"facility_mean": mean, "facility_std": std, "coordinate_mean": mean, "coordinate_std": std},
        "frames": frames,
        "facility": {
            "id": "fac-mrpl-01",
            "name": "MRPL Petrochemical Complex",
            "type": "Petrochemical Refining & Storage",
            "coordinates": [12.978, 74.838],
            "polygon": [
                [12.986, 74.830], [12.986, 74.848], [12.970, 74.848],
                [12.970, 74.830], [12.986, 74.830],
            ],
            "baselineFRPMean": mean,
            "baselineFRPStd": std,
            "expectedPersistence": 0.92,
            "typicalHotspots": 1,
            "nearbySettlements": ["Kulai Settlement", "Baikampady Township", "Hosabettu"],
            "nearbyAssets": MRPL_ASSETS,
        },
    }


# --------------------------------------------------------------------------------------
# Scenario 2: Persistent flare (1 frame, routine Class 5)
# --------------------------------------------------------------------------------------

def persistent_flare() -> dict[str, Any]:
    sid = "persistent_flare"
    mean, std = 48.0, 9.5
    return {
        "schema_version": SCHEMA_VERSION,
        "scenario_id": sid,
        "title": "Jamnagar Refinery — Routine Gas Flaring",
        "description": "High-persistence thermal baseline with zero abnormal growth (Class 5 routine).",
        "mode": "HISTORICAL REPLAY",
        "source_provenance": "Curated from historical NASA FIRMS detections over the Jamnagar refining hub.",
        "classification_note": "Routine flare reference scenario. Stub inference stands in for trained models.",
        "baseline": {"facility_mean": mean, "facility_std": std, "coordinate_mean": mean, "coordinate_std": std},
        "frames": [
            _frame(
                sid, 0, 0.0, "baseline",
                "T+00m: Routine Overpass Observation",
                "Consistent thermal hotspot at elevated flare stack. Low variance, zero perimeter expansion.",
                [_detection("det-viirs-flr", "VIIRS", "2026-09-05T07:58:30Z", 22.3781, 69.8652, 46.5, 348.0, 298.0,
                            quality_score=0.98)],
                {
                    "facility_id": "fac-ril-01",
                    "facility_name": "Jamnagar Refining Hub",
                    "facility_type": "Petrochemical Complex",
                    "lulc_class": "industrial_developed",
                    "lulc_entropy_500m": 1.45,
                    "is_in_industrial_polygon": True,
                    "is_mine_polygon": False,
                    "distance_to_industrial_m": 0,
                    "persistence_score": 0.95,
                    "baseline_frp_mean": mean,
                    "baseline_frp_std": std,
                    "sensor_agreement_state": "single_sensor",
                    "sensor_count": 1,
                    "data_quality_flag": "NOMINAL",
                    "data_quality_score": 0.98,
                    "frp_z_score": -0.16,
                    "facility_frp_zscore": -0.16,
                    "cluster_pixel_count": 1,
                    "centroid_drift_velocity_mph": 0.0,
                    "frp_trend_mw_per_hour": 0.2,
                    "stub_class_probabilities": {"1": 0.02, "2": 0.01, "3": 0.01, "4": 0.01, "5": 0.95},
                    "stub_anomaly_score": 0.08,
                    "recommended_action": "Routine tracking. No tactical dispatch required.",
                    "historical_baseline_timeline": _baseline_timeline(mean, std, 46.5),
                },
            )
        ],
        "facility": {
            "id": "fac-ril-01",
            "name": "Jamnagar Refining Hub",
            "type": "Mega Petrochemical Complex",
            "coordinates": [22.378, 69.865],
            "polygon": [
                [22.392, 69.850], [22.392, 69.880], [22.365, 69.880],
                [22.365, 69.850], [22.392, 69.850],
            ],
            "baselineFRPMean": mean,
            "baselineFRPStd": std,
            "expectedPersistence": 0.96,
            "typicalHotspots": 2,
            "nearbySettlements": ["Moti Khavdi", "Sikka Port Township"],
            "nearbyAssets": [
                {
                    "id": "ast-ril-01",
                    "name": "Cracker Unit Flare Stack A",
                    "type": "substation",
                    "latitude": 22.378,
                    "longitude": 69.865,
                    "distance_m": 50,
                    "criticality_weight": 0.50,
                }
            ],
        },
    }


# --------------------------------------------------------------------------------------
# Scenario 3: Wildfire perimeter spread (1 frame, Class 2)
# --------------------------------------------------------------------------------------

def wildfire() -> dict[str, Any]:
    sid = "wildfire"
    mean, std = 4.2, 2.1
    return {
        "schema_version": SCHEMA_VERSION,
        "scenario_id": sid,
        "title": "Similipal Biosphere — Forest Fire Perimeter",
        "description": "High drift velocity across dense tree-cover canopy (Class 2 wildfire).",
        "mode": "HISTORICAL REPLAY",
        "source_provenance": "Curated from historical NASA FIRMS detections over the Similipal biosphere reserve.",
        "classification_note": "Wildfire reference scenario. Stub inference stands in for trained models.",
        "baseline": {"facility_mean": mean, "facility_std": std, "coordinate_mean": mean, "coordinate_std": std},
        "frames": [
            _frame(
                sid, 0, 0.0, "critical_state",
                "T+00m: Forest Fire Rapid Spread",
                "Multi-pixel cluster spreading eastward with 1,250 m/h drift velocity over dense canopy.",
                [
                    _detection("det-v-wld1", "VIIRS", "2026-09-05T13:38:10Z", 21.8520, 86.3420, 110.0, 362.0, 299.5,
                               quality_score=0.94),
                    _detection("det-v-wld2", "VIIRS", "2026-09-05T13:38:10Z", 21.8545, 86.3480, 95.0, 358.0, 298.0,
                               quality_score=0.94),
                ],
                {
                    "facility_id": None,
                    "facility_name": "Similipal Biosphere Reserve",
                    "facility_type": "Deciduous Forest Canopy",
                    "lulc_class": "tree_cover",
                    "lulc_entropy_500m": 0.32,
                    "is_in_industrial_polygon": False,
                    "is_mine_polygon": False,
                    "distance_to_industrial_m": 35000,
                    "persistence_score": 0.03,
                    "baseline_frp_mean": mean,
                    "baseline_frp_std": std,
                    "sensor_agreement_state": "agreement",
                    "sensor_count": 2,
                    "data_quality_flag": "NOMINAL",
                    "data_quality_score": 0.94,
                    "frp_z_score": 22.4,
                    "facility_frp_zscore": 0.0,
                    "cluster_pixel_count": 12,
                    "centroid_drift_velocity_mph": 1250.0,
                    "frp_trend_mw_per_hour": 180.0,
                    "stub_class_probabilities": {"1": 0.04, "2": 0.89, "3": 0.02, "4": 0.04, "5": 0.01},
                    "stub_anomaly_score": 0.91,
                    "recommended_action": "Dispatch state forestry wildfire rapid-response teams. Issue perimeter containment orders.",
                    "swir_nir_ratio": 1.85,
                    "delta_nbr": 0.74,
                    "delta_ndvi": -0.62,
                    "plume_wind_speed_mps": 9.4,
                    "plume_wind_direction_deg": 75,
                    "segmentation": {
                        "type": "Polygon",
                        "coordinates": [[
                            [21.848, 86.335], [21.858, 86.339], [21.856, 86.355],
                            [21.846, 86.350], [21.848, 86.335],
                        ]],
                        "burnAreaM2": 320000,
                        "smokeAreaM2": 890000,
                    },
                    "affected_assets": [
                        {
                            "id": "ast-for-01", "name": "Similipal Core Reserve Boundary", "type": "substation",
                            "latitude": 21.845, "longitude": 86.352, "distance_m": 600, "criticality_weight": 0.85,
                        },
                        {
                            "id": "ast-for-02", "name": "Udala Tribal Settlement", "type": "settlement",
                            "latitude": 21.838, "longitude": 86.368, "distance_m": 2400,
                            "population_at_risk": 3200, "criticality_weight": 0.70,
                        },
                    ],
                    "historical_baseline_timeline": _baseline_timeline(mean, std, 205.0),
                },
            )
        ],
        "facility": {
            "id": "fac-sim-01",
            "name": "Similipal Biosphere Forest Sector",
            "type": "National Protected Biosphere",
            "coordinates": [21.850, 86.340],
            "polygon": [
                [21.870, 86.320], [21.870, 86.365], [21.830, 86.365],
                [21.830, 86.320], [21.870, 86.320],
            ],
            "baselineFRPMean": mean,
            "baselineFRPStd": std,
            "expectedPersistence": 0.04,
            "typicalHotspots": 0,
            "nearbySettlements": ["Baripada Outskirts", "Udala Tribal Hamlet"],
            "nearbyAssets": [
                {
                    "id": "ast-for-01", "name": "Similipal Core Reserve Boundary", "type": "substation",
                    "latitude": 21.845, "longitude": 86.352, "distance_m": 600, "criticality_weight": 0.85,
                }
            ],
        },
    }


# --------------------------------------------------------------------------------------
# Scenario 4: Sensor disagreement (1 frame, operator-verification demo)
# --------------------------------------------------------------------------------------

def sensor_disagreement() -> dict[str, Any]:
    sid = "sensor_disagreement"
    mean, std = 22.0, 5.5
    return {
        "schema_version": SCHEMA_VERSION,
        "scenario_id": sid,
        "title": "Korba Industrial Belt — Sensor Disagreement",
        "description": "Cloud-edge obstruction triggering verification routing instead of suppression.",
        "mode": "HISTORICAL REPLAY",
        "source_provenance": "Curated from historical NASA FIRMS detections over the Korba super thermal power complex.",
        "classification_note": "Disagreement reference scenario. Stub inference stands in for trained models.",
        "baseline": {"facility_mean": mean, "facility_std": std, "coordinate_mean": mean, "coordinate_std": std},
        "frames": [
            _frame(
                sid, 0, 0.0, "uncertain_state",
                "T+00m: Conflicted Multi-Sensor Observation",
                "VIIRS flags a 68 MW anomaly under cloud obstruction. MODIS does not detect an anomaly. Safety rule routes to UNCERTAIN.",
                [_detection("det-viirs-cld", "VIIRS", "2026-09-05T16:08:20Z", 22.3552, 82.7204, 68.4, 338.0, 288.0,
                            confidence="low", cloud_flag=True, quality_score=0.45)],
                {
                    "facility_id": "fac-korba-01",
                    "facility_name": "Korba Super Thermal Power",
                    "facility_type": "Thermal Power Complex",
                    "lulc_class": "industrial_developed",
                    "lulc_entropy_500m": 1.62,
                    "is_in_industrial_polygon": True,
                    "is_mine_polygon": False,
                    "distance_to_industrial_m": 0,
                    "persistence_score": 0.62,
                    "baseline_frp_mean": mean,
                    "baseline_frp_std": std,
                    "sensor_agreement_state": "disagreement",
                    "sensor_count": 1,
                    "data_quality_flag": "CLOUD_OBSTRUCTED",
                    "data_quality_score": 0.45,
                    "frp_z_score": 4.43,
                    "facility_frp_zscore": 4.43,
                    "cluster_pixel_count": 1,
                    "centroid_drift_velocity_mph": 0.0,
                    "frp_trend_mw_per_hour": 4.5,
                    "stub_class_probabilities": {"1": 0.42, "2": 0.08, "3": 0.18, "4": 0.02, "5": 0.30},
                    "stub_anomaly_score": 0.76,
                    "recommended_action": "OPERATOR VERIFICATION REQUIRED: inspect optical cloud overlay or task the next satellite overpass.",
                    "historical_baseline_timeline": _baseline_timeline(mean, std, 68.4),
                },
            )
        ],
        "facility": {
            "id": "fac-korba-01",
            "name": "Korba Super Thermal Power & Coal Yard",
            "type": "Thermal Power & Coal Storage",
            "coordinates": [22.355, 82.720],
            "polygon": [
                [22.368, 82.705], [22.368, 82.735], [22.342, 82.735],
                [22.342, 82.705], [22.368, 82.705],
            ],
            "baselineFRPMean": mean,
            "baselineFRPStd": std,
            "expectedPersistence": 0.65,
            "typicalHotspots": 1,
            "nearbySettlements": ["Korba East Colony", "Gevra Township"],
            "nearbyAssets": [
                {
                    "id": "ast-kor-01", "name": "Coal Washery Conveyor Belt 2", "type": "substation",
                    "latitude": 22.358, "longitude": 82.724, "distance_m": 350, "criticality_weight": 0.80,
                }
            ],
        },
    }


BUILDERS = [industrial_escalation, persistent_flare, wildfire, sensor_disagreement]


def main() -> None:
    REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    for builder in BUILDERS:
        scenario = builder()
        path = REPLAY_DIR / f"{scenario['scenario_id']}.json"
        path.write_text(json.dumps(scenario, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(REPLAY_DIR.parents[1])} ({len(scenario['frames'])} frames)")


if __name__ == "__main__":
    main()
