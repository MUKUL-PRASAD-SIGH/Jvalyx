/**
 * Backend (`EventIntelligence`) -> frontend (`ScenarioFrame`) mapping.
 *
 * The two layers grew separate field vocabularies (see `docs/cross-layer-findings.md`
 * F1-F5). The backend is the source of truth for arbitration, risk and classification;
 * this module is the single place that reshapes its payloads for the existing dashboard
 * components, so those components stay unaware of which source is driving them.
 *
 * Notable conversions:
 *   - flat `features` map -> the fields `FusedEvent` exposes directly
 *   - baseline mean/sigma recovered from the historical timeline (mean, upper1Sigma)
 *   - segmentation GeoJSON ([lon, lat]) -> Leaflet ring order ([lat, lon])
 *   - snake_case audit rows -> camelCase `OperatorAuditEntry`
 */

import type {
  BackendAuditEntry,
  BackendEventIntelligence,
  BackendScenarioSummary,
} from './api';
import type {
  CriticalAsset,
  Detection,
  FacilityDigitalTwin,
  FireClassId,
  OperatorAuditEntry,
  RouteState,
  ScenarioFrame,
  SensorAgreementState,
  TacticalData,
} from '../types';

const AGREEMENT_STATES: SensorAgreementState[] = [
  'single_sensor',
  'multi_sensor_same_instrument',
  'multi_sensor_cross_confirmed',
  'disagreement',
  'unknown',
];

function toAgreementState(raw: unknown): SensorAgreementState {
  const value = String(raw ?? 'unknown');
  // `agreement` is the backend's legacy alias for a cross-confirmed fusion.
  if (value === 'agreement') return 'multi_sensor_cross_confirmed';
  return (AGREEMENT_STATES as string[]).includes(value)
    ? (value as SensorAgreementState)
    : 'unknown';
}

function num(source: Record<string, unknown>, key: string, fallback = 0): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' && value ? value : fallback;
}

/** Class probabilities arrive keyed by stringified class id. */
function toClassProbabilities(raw: Record<string, number>): Record<FireClassId, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<FireClassId, number>;
  for (const [key, value] of Object.entries(raw ?? {})) {
    const id = Number(key) as FireClassId;
    if (id >= 1 && id <= 5) out[id] = value;
  }
  return out;
}

function toDetections(
  raw: unknown,
  qualityFallback: number,
): Detection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const d = entry as Record<string, unknown>;
    const rawQuality = (d.raw_quality ?? {}) as Record<string, unknown>;
    return {
      detection_id: str(d, 'detection_id', 'det-unknown'),
      sensor: (str(d, 'sensor', 'REPLAY') as Detection['sensor']) ?? 'REPLAY',
      timestamp: str(d, 'timestamp'),
      latitude: num(d, 'latitude'),
      longitude: num(d, 'longitude'),
      frp_mw: num(d, 'frp_mw'),
      bright_ti4_k: num(d, 'bright_ti4_k'),
      bright_ti5_k: num(d, 'bright_ti5_k'),
      scan_km: num(d, 'scan_km') || undefined,
      track_km: num(d, 'track_km') || undefined,
      confidence: (d.confidence as Detection['confidence']) ?? undefined,
      daynight: (d.daynight as Detection['daynight']) ?? undefined,
      cloud_flag: Boolean(d.cloud_flag),
      // The backend keeps per-detection quality under `raw_quality`, not top level.
      sun_glint_flag: Boolean(rawQuality.sun_glint_flag),
      quality_score: num(rawQuality, 'quality_score', qualityFallback),
    };
  });
}

function toTactical(
  raw: Record<string, unknown> | null,
  fallbackAssets: CriticalAsset[],
): TacticalData | undefined {
  if (!raw) return undefined;

  const assets: CriticalAsset[] = Array.isArray(raw.affected_assets)
    ? (raw.affected_assets as Record<string, unknown>[]).map((a) => ({
        id: str(a, 'id'),
        name: str(a, 'name'),
        type: str(a, 'type', 'settlement') as CriticalAsset['type'],
        latitude: num(a, 'latitude'),
        longitude: num(a, 'longitude'),
        distance_m: num(a, 'distance_m'),
        criticality_weight: num(a, 'criticality_weight', 0.5),
        population_at_risk:
          typeof a.population_at_risk === 'number' ? a.population_at_risk : undefined,
      }))
    : [];

  const plume = raw.plume_corridor as Record<string, unknown> | null | undefined;
  const geojson = raw.segmentation_geojson as Record<string, unknown> | null | undefined;

  // GeoJSON stores [lon, lat]; Leaflet (and every component here) wants [lat, lon].
  let segmentationMask: TacticalData['segmentationMask'];
  const feature = (geojson?.features as Record<string, unknown>[] | undefined)?.[0];
  const geometry = feature?.geometry as Record<string, unknown> | undefined;
  if (geometry && Array.isArray(geometry.coordinates)) {
    segmentationMask = {
      type: (geometry.type as 'Polygon' | 'MultiPolygon') ?? 'Polygon',
      coordinates: (geometry.coordinates as [number, number][][]).map((ring) =>
        ring.map(([lon, lat]) => [lat, lon] as [number, number]),
      ),
      burnAreaM2: num(raw, 'burn_area_m2'),
      smokeAreaM2: num(raw, 'smoke_area_m2'),
    };
  }

  return {
    segmentationMask,
    plumeCorridor: plume
      ? {
          centerline: plume.centerline as [number, number][],
          cone50: plume.cone50 as [number, number][],
          cone90: plume.cone90 as [number, number][],
          windSpeedMps: num(plume, 'wind_speed_mps'),
          windDirectionDeg: num(plume, 'wind_direction_deg'),
        }
      : undefined,
    affectedAssets: assets.length > 0 ? assets : fallbackAssets,
    swir_nir_ratio: typeof raw.swir_nir_ratio === 'number' ? raw.swir_nir_ratio : undefined,
    delta_nbr: typeof raw.delta_nbr === 'number' ? raw.delta_nbr : undefined,
    delta_ndvi: typeof raw.delta_ndvi === 'number' ? raw.delta_ndvi : undefined,
  };
}

/**
 * Reshape one backend event into the `ScenarioFrame` the dashboard renders.
 *
 * `facility` supplies only presentation details the backend event does not carry
 * (facility display name, LULC label, asset fallback).
 */
export function toScenarioFrame(
  event: BackendEventIntelligence,
  facility?: FacilityDigitalTwin,
): ScenarioFrame {
  const fused = (event.fused_event ?? {}) as Record<string, unknown>;
  const features = event.features ?? {};
  const timeline = (event.historical_baseline_timeline ?? []) as Array<Record<string, number | string>>;

  // The backend does not send baseline mean/sigma as scalars; the timeline carries
  // both (`mean` and its +1 sigma band), which is what the drawer and sidebar show.
  const lastRow = timeline[timeline.length - 1] ?? {};
  const baselineMean = Number(lastRow.mean ?? facility?.baselineFRPMean ?? 0);
  const baselineStd = Number(lastRow.upper1Sigma ?? 0) - baselineMean;

  const detections = toDetections(fused.detections, num(features, 'data_quality_score'));

  return {
    timestamp: event.timestamp,
    frameIndex: event.frame_index,
    label: event.label,
    description: event.description,
    fusedEvent: {
      event_id: String(fused.event_id ?? event.event_id),
      created_at: str(fused, 'created_at', event.timestamp),
      latitude: num(fused, 'latitude'),
      longitude: num(fused, 'longitude'),
      detections,
      sensor_count: num(fused, 'sensor_count', detections.length || 1),
      corroboration_count: num(fused, 'corroboration_count', 1),
      data_quality_pass: fused.data_quality_pass !== false,
      sensor_agreement_state: toAgreementState(fused.sensor_agreement_state),
      data_quality_flag: str(fused, 'data_quality_flag', 'UNKNOWN'),
      data_quality_score: num(features, 'data_quality_score'),
      facility_id: (fused.facility_id as string | null) ?? facility?.id ?? null,
      facility_name: facility?.name ?? str(fused, 'facility_id', 'Unmapped location'),
      facility_type: str(fused, 'facility_type', facility?.type ?? 'none'),
      lulc_class: facility?.type ?? 'unknown',
      lulc_entropy_500m: num(features, 'lulc_entropy_500m'),
      is_in_industrial_polygon: num(features, 'is_in_industrial_polygon') === 1,
      is_mine_polygon: num(features, 'is_mine_polygon') === 1,
      distance_to_industrial_m: num(features, 'distance_to_industrial_m'),
      persistence_score: num(features, 'persistence_score'),
      baseline_frp_mean: baselineMean,
      baseline_frp_std: baselineStd > 0 ? baselineStd : 1,
      frp_z_score: num(features, 'frp_z_score'),
      facility_frp_zscore: num(features, 'facility_frp_zscore'),
      cluster_pixel_count: num(features, 'cluster_pixel_count', 1),
      centroid_drift_velocity_mph: num(features, 'centroid_drift_velocity_mph'),
      frp_trend_mw_per_hour: num(features, 'frp_trend_mw_per_hour'),
      route_state: event.route_state as RouteState,
      verification_status: event.verification_status,
    },
    decision: {
      event_id: event.event_id,
      class_id: event.decision.class_id as FireClassId,
      class_name: event.decision.class_name,
      class_probabilities: toClassProbabilities(event.decision.class_probabilities),
      anomaly_score: event.decision.anomaly_score,
      route_state: event.decision.route_state as RouteState,
      risk_score: event.decision.risk_score,
      confidence_state: event.decision.confidence_state,
      explanation: event.decision.explanation,
      recommended_action: event.decision.recommended_action,
      model_version: event.decision.model_version,
      policy_version: event.decision.policy_version,
    },
    risk: event.risk,
    tactical: toTactical(event.tactical, facility?.nearbyAssets ?? []),
    historicalBaselineTimeline: timeline.map((row) => ({
      day: String(row.day ?? ''),
      mean: Number(row.mean ?? 0),
      upper1Sigma: Number(row.upper1Sigma ?? 0),
      upper3Sigma: Number(row.upper3Sigma ?? 0),
      observedFRP: Number(row.observedFRP ?? 0),
    })),
  };
}

const AUDIT_ACTIONS = new Set<OperatorAuditEntry['action']>([
  'CONFIRM_CRITICAL',
  'REJECT_NORMAL',
  'SIMULATE_DEVIATION',
  'REQUEST_TACTICAL_PASS',
]);

/**
 * Backend audit rows -> the modal's shape. `GET /audit` already returns newest-first,
 * which is the order the modal renders, so the sequence is preserved as received.
 *
 * Lifecycle rows (REPLAY_START, SCENARIO_LOAD, ...) are kept and shown under
 * REQUEST_TACTICAL_PASS so the compliance log stays complete rather than silently
 * dropping entries the union type does not name.
 */
export function toAuditEntries(entries: BackendAuditEntry[]): OperatorAuditEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    eventId: entry.event_id,
    timestamp: entry.timestamp.replace('T', ' ').replace('Z', ' UTC'),
    action: (AUDIT_ACTIONS.has(entry.action as OperatorAuditEntry['action'])
      ? entry.action
      : 'REQUEST_TACTICAL_PASS') as OperatorAuditEntry['action'],
    operator: entry.operator,
    notes: entry.notes || entry.action.replace(/_/g, ' ').toLowerCase(),
    priorRouteState: (entry.prior_route_state ?? 'NORMAL') as RouteState,
    newRouteState: (entry.new_route_state ?? entry.prior_route_state ?? 'NORMAL') as RouteState,
  }));
}

/** Facility digital twin carried on a backend scenario summary, when it has one. */
export function toFacility(
  summary: BackendScenarioSummary | undefined,
  fallback?: FacilityDigitalTwin,
): FacilityDigitalTwin | undefined {
  const raw = summary?.facility;
  if (!raw) return fallback;
  const f = raw as Record<string, unknown>;
  return {
    id: str(f, 'id', fallback?.id ?? ''),
    name: str(f, 'name', fallback?.name ?? ''),
    type: str(f, 'type', fallback?.type ?? ''),
    coordinates: (f.coordinates as [number, number]) ?? fallback?.coordinates ?? [0, 0],
    polygon: (f.polygon as [number, number][]) ?? fallback?.polygon ?? [],
    baselineFRPMean: num(f, 'baselineFRPMean', fallback?.baselineFRPMean ?? 0),
    baselineFRPStd: num(f, 'baselineFRPStd', fallback?.baselineFRPStd ?? 1),
    expectedPersistence: num(f, 'expectedPersistence', fallback?.expectedPersistence ?? 0),
    typicalHotspots: num(f, 'typicalHotspots', fallback?.typicalHotspots ?? 1),
    nearbySettlements: (f.nearbySettlements as string[]) ?? fallback?.nearbySettlements ?? [],
    nearbyAssets: (f.nearbyAssets as CriticalAsset[]) ?? fallback?.nearbyAssets ?? [],
  };
}
