import type { FireDetection } from '../types';
import type { RiskBreakdown, RouteState } from '../../types';

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8000';

/** Result of routing one live FIRMS detection through the real backend pipeline
 * (`POST /api/triage/classify`) — the trained CatBoost classifier, the Isolation Forest
 * anomaly score, and the same arbitration/risk formulas the digital twin uses, instead of
 * `triage.ts`'s hardcoded heuristic buckets. */
export interface BackendClassification {
  classId: number;
  className: string;
  classProbabilities: Record<number, number>;
  anomalyScore: number;
  routeState: RouteState;
  confidenceState: 'low' | 'medium' | 'high';
  risk: RiskBreakdown;
  facilityFrpZscore: number;
  isInIndustrialPolygon: boolean;
  distanceToIndustrialM: number;
  matchedFacility: string | null;
  /** False whenever the model's `lulc_class` fell outside its trained vocabulary — true
   * for essentially every live point, since there's no live land-cover source wired in
   * yet (see `backend/models/artifacts/README.md`). Surface this, don't hide it. */
  lulcInVocabulary: boolean;
  modelVersion: string;
  anomalyModelVersion: string;
}

/** Throws on any non-2xx response or network failure — callers should fall back to the
 * local heuristic (`triageHotspot` with no `backend` argument) exactly like the digital
 * twin falls back to the offline replay pack when the backend is unreachable. */
export async function classifyDetectionBackend(
  detection: FireDetection,
  signal?: AbortSignal,
): Promise<BackendClassification> {
  const res = await fetch(`${BACKEND_BASE}/api/triage/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      id: detection.id,
      latitude: detection.latitude,
      longitude: detection.longitude,
      brightness: detection.brightness,
      brightness_secondary: detection.brightnessSecondary,
      frp: detection.frp,
      scan: detection.scan,
      track: detection.track,
      confidence_level: detection.confidenceLevel,
      daynight: detection.daynight,
      acquired_at: detection.acquiredAt.toISOString(),
      instrument: detection.instrument,
    }),
  });
  if (!res.ok) {
    throw new Error(`backend triage classify failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    classId: data.class_id,
    className: data.class_name,
    classProbabilities: data.class_probabilities,
    anomalyScore: data.anomaly_score,
    routeState: data.route_state,
    confidenceState: data.confidence_state,
    risk: data.risk,
    facilityFrpZscore: data.facility_frp_zscore,
    isInIndustrialPolygon: data.is_in_industrial_polygon,
    distanceToIndustrialM: data.distance_to_industrial_m,
    matchedFacility: data.matched_facility,
    lulcInVocabulary: data.lulc_in_vocabulary,
    modelVersion: data.model_version,
    anomalyModelVersion: data.anomaly_model_version,
  };
}
