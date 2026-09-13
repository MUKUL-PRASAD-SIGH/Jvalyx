import type { FireDetection } from '../types';
import { matchIndustrialPolygon } from './industrialSpatial';
import { PROTECTED_AREAS } from '../config/protectedAreas';
import { haversine_m } from '../../utils/math';
import { getClassification } from './classificationCache';

const STUBBLE_MONTHS = new Set([9, 10, 3, 4]);
const fastCache = new Map<string, number>();

/**
 * High-performance heuristic classifier (< 0.005 ms per detection)
 * suitable for batching thousands of FIRMS points without lagging the UI thread.
 */
export function getFastClassId(d: FireDetection): number {
  const cached = getClassification(d.id);
  if (cached) return cached.classId;

  const hit = fastCache.get(d.id);
  if (hit !== undefined) return hit;

  const poly = matchIndustrialPolygon(d.latitude, d.longitude);
  let classId = 4;

  if (poly) {
    const isMine = Boolean(
      (poly.coal_industrial_zone && poly.coal_industrial_zone.toLowerCase().includes('coal')) ||
      poly.industrial === 'mine' ||
      (poly.name && poly.name.toLowerCase().includes('coal'))
    );
    if (isMine) {
      classId = 3; // Mining
    } else if (d.frp >= 75) {
      classId = 1; // Industrial Fire/Explosion
    } else {
      classId = 5; // Routine Flare / Industrial Heat
    }
  } else {
    let inForest = false;
    for (const pa of PROTECTED_AREAS) {
      const dDeg = (pa.radiusKm * 1000) / 111000;
      if (Math.abs(d.latitude - pa.lat) <= dDeg && Math.abs(d.longitude - pa.lon) <= dDeg) {
        if (haversine_m(d.latitude, d.longitude, pa.lat, pa.lon) <= pa.radiusKm * 1000) {
          inForest = true;
          break;
        }
      }
    }

    if (inForest && d.frp >= 15) {
      classId = 2; // Wildfire
    } else if (d.frp >= 40 && d.brightness >= 340) {
      classId = 2; // Wildfire
    } else {
      const month = d.acquiredAt.getUTCMonth() + 1;
      if (STUBBLE_MONTHS.has(month) && d.frp < 35) {
        classId = 4; // Agricultural / Stubble Burning
      } else if (d.frp >= 50) {
        classId = 2; // Wildfire
      } else {
        classId = 4; // Agricultural
      }
    }
  }

  fastCache.set(d.id, classId);
  return classId;
}

export interface ClassBreakdownItem {
  id: number;
  key: string;
  emoji: string;
  label: string;
  count: number;
  totalFrp: number;
}

export function computeClassBreakdown(detections: FireDetection[]): ClassBreakdownItem[] {
  const counts: Record<number, { count: number; frp: number }> = {
    1: { count: 0, frp: 0 },
    2: { count: 0, frp: 0 },
    3: { count: 0, frp: 0 },
    4: { count: 0, frp: 0 },
    5: { count: 0, frp: 0 },
  };

  for (const d of detections) {
    const c = getFastClassId(d);
    const item = counts[c] ?? counts[4];
    item.count += 1;
    item.frp += d.frp;
  }

  return [
    { id: 1, key: 'industrial', emoji: '🏢', label: 'Industrial Fire', count: counts[1].count, totalFrp: counts[1].frp },
    { id: 2, key: 'wildfire', emoji: '🌲', label: 'Wildfire / Forest', count: counts[2].count, totalFrp: counts[2].frp },
    { id: 3, key: 'mining', emoji: '⛏️', label: 'Mining / Coal-Seam', count: counts[3].count, totalFrp: counts[3].frp },
    { id: 4, key: 'agricultural', emoji: '🌾', label: 'Stubble Burning', count: counts[4].count, totalFrp: counts[4].frp },
    { id: 5, key: 'flare', emoji: '💥', label: 'Flare / Routine Heat', count: counts[5].count, totalFrp: counts[5].frp },
  ];
}
