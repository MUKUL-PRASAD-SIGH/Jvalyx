import type { FireDetection } from '../types';
import { PROTECTED_AREAS } from '../config/protectedAreas';
import { KNOWN_FACILITIES } from '../../services/firms';
import {
  computeRiskScore,
  generatePlumeCorridor,
  haversine_m,
  routeEvent,
} from '../../utils/math';
import type { RiskBreakdown, RouteState } from '../../types';

export interface HotspotTriage {
  detection: FireDetection;
  context: {
    nearestFacility: { name: string; distanceM: number } | null;
    inProtectedArea: { name: string; category: string } | null;
    isIndustrial: boolean;
    facilityZ: number;
    biome: 'industrial' | 'protected-forest' | 'open-terrain';
  };
  classProbabilities: Record<number, number>;
  classId: number;
  className: string;
  anomalyScore: number;
  routeState: RouteState;
  risk: RiskBreakdown;
  plume: ReturnType<typeof generatePlumeCorridor>;
  explanation: string[];
  disclaimer: string;
}

const CLASS_NAMES: Record<number, string> = {
  1: 'Accidental Industrial Fire / Explosion',
  2: 'Wildfire or Forest Fire',
  3: 'Uncontrolled Mining / Coal-Seam Fire',
  4: 'Agricultural / Stubble Burning',
  5: 'Persistent Flare / Routine Heat',
};

const STUBBLE_MONTHS = new Set([9, 10, 3, 4]); // Sep-Oct (kharif), Mar-Apr (rabi)

export function triageHotspot(detection: FireDetection): HotspotTriage {
  // nearest known industrial facility
  let nearestFacility: { name: string; distanceM: number } | null = null;
  let facilityBaselineMean = 12;
  let facilityBaselineStd = 6;
  for (const f of KNOWN_FACILITIES) {
    const dist = haversine_m(detection.latitude, detection.longitude, f.lat, f.lon);
    if (!nearestFacility || dist < nearestFacility.distanceM) {
      nearestFacility = { name: f.name, distanceM: dist };
      if (dist <= f.radius_m) {
        facilityBaselineMean = f.baseline_frp_mean;
        facilityBaselineStd = f.baseline_frp_std;
      }
    }
  }
  const isIndustrial = !!nearestFacility && nearestFacility.distanceM <= 3500;

  // protected area membership
  let inProtectedArea: { name: string; category: string } | null = null;
  for (const pa of PROTECTED_AREAS) {
    if (haversine_m(detection.latitude, detection.longitude, pa.lat, pa.lon) <= pa.radiusKm * 1000) {
      inProtectedArea = { name: pa.name, category: pa.category };
      break;
    }
  }

  const facilityZ = isIndustrial
    ? Number(((detection.frp - facilityBaselineMean) / Math.max(facilityBaselineStd, 0.1)).toFixed(2))
    : 0;

  const biome: HotspotTriage['context']['biome'] = isIndustrial
    ? 'industrial'
    : inProtectedArea
      ? 'protected-forest'
      : 'open-terrain';

  // Heuristic class distribution from real detection attributes.
  const month = detection.acquiredAt.getUTCMonth() + 1;
  let probs: Record<number, number>;
  if (isIndustrial && (facilityZ >= 4 || detection.frp >= 90)) {
    probs = { 1: 0.68, 2: 0.06, 3: 0.04, 4: 0.02, 5: 0.2 };
  } else if (isIndustrial) {
    probs = { 1: 0.08, 2: 0.03, 3: 0.03, 4: 0.02, 5: 0.84 };
  } else if (inProtectedArea && detection.frp >= 15) {
    probs = { 1: 0.03, 2: 0.82, 3: 0.03, 4: 0.09, 5: 0.03 };
  } else if (detection.frp >= 40 && detection.brightness >= 340) {
    probs = { 1: 0.05, 2: 0.7, 3: 0.05, 4: 0.17, 5: 0.03 };
  } else if (STUBBLE_MONTHS.has(month) && detection.frp < 30) {
    probs = { 1: 0.02, 2: 0.1, 3: 0.03, 4: 0.8, 5: 0.05 };
  } else {
    probs = { 1: 0.04, 2: 0.34, 3: 0.05, 4: 0.5, 5: 0.07 };
  }
  const total = Object.values(probs).reduce((s, v) => s + v, 0);
  Object.keys(probs).forEach((k) => (probs[Number(k)] = Number((probs[Number(k)] / total).toFixed(3))));

  const classId = Number(
    Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0],
  );

  const anomalyScore = Math.max(
    0.05,
    Math.min(0.98, (detection.frp / 120) * 0.5 + (facilityZ > 0 ? facilityZ * 0.08 : 0) + (detection.confidenceLevel === 'high' ? 0.15 : 0)),
  );

  const routeState = routeEvent(
    probs,
    anomalyScore,
    isIndustrial,
    facilityZ,
    'full_agreement',
    detection.confidenceLevel === 'high' ? 0.9 : detection.confidenceLevel === 'nominal' ? 0.7 : 0.45,
  );

  const risk = computeRiskScore(
    probs,
    facilityZ,
    1,
    0,
    isIndustrial ? 0.7 : inProtectedArea ? 0.55 : 0.35,
  );

  const plume = generatePlumeCorridor([detection.latitude, detection.longitude], 6.5, 135);

  const explanation: string[] = [
    isIndustrial
      ? `Detection lies ${(nearestFacility!.distanceM / 1000).toFixed(1)} km from ${nearestFacility!.name}${facilityZ ? ` (FRP ${facilityZ >= 0 ? '+' : ''}${facilityZ}σ vs facility baseline)` : ''}.`
      : nearestFacility
        ? `Nearest industrial facility (${nearestFacility.name}) is ${(nearestFacility.distanceM / 1000).toFixed(0)} km away — treated as open terrain.`
        : 'No industrial facility nearby — treated as open terrain.',
    inProtectedArea
      ? `Inside ${inProtectedArea.name} (${inProtectedArea.category}) — vegetation-fire priority.`
      : 'Not within a mapped protected area.',
    `Observed FRP ${detection.frp.toFixed(1)} MW, brightness ${detection.brightness.toFixed(0)} K, ${detection.daynight === 'D' ? 'daytime' : 'night-time'} overpass, ${detection.confidenceLevel} confidence.`,
    `Isolation-surrogate anomaly score ${anomalyScore.toFixed(2)}; deterministic arbitration → ${routeState}.`,
  ];

  return {
    detection,
    context: { nearestFacility, inProtectedArea, isIndustrial, facilityZ, biome },
    classProbabilities: probs,
    classId,
    className: CLASS_NAMES[classId],
    anomalyScore: Number(anomalyScore.toFixed(2)),
    routeState,
    risk,
    plume,
    explanation,
    disclaimer:
      'Jvalyx triage is a heuristic lens over a single NASA FIRMS detection — not a trained model output. It classifies context (industrial vs forest vs cropland), not verified incident type.',
  };
}
