import type { FireDetection, ProductId } from '../types';
import { normalizeConfidence } from '../config/products';

/** Small seeded PRNG (mulberry32) so the synthetic layer is stable between renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Hotspot {
  name: string;
  lat: number;
  lon: number;
  spreadDeg: number;
  intensity: number; // relative detection weight
  biome: 'cropland' | 'forest' | 'industrial' | 'scrub';
}

/** Fire-prone regions of India, roughly weighted for a September window. */
const REGIONS: Hotspot[] = [
  { name: 'Punjab stubble belt', lat: 30.6, lon: 75.4, spreadDeg: 1.1, intensity: 0.9, biome: 'cropland' },
  { name: 'Haryana stubble belt', lat: 29.4, lon: 76.4, spreadDeg: 0.9, intensity: 0.7, biome: 'cropland' },
  { name: 'Central India (MP/Chhattisgarh)', lat: 22.3, lon: 81.0, spreadDeg: 2.4, intensity: 0.8, biome: 'forest' },
  { name: 'Odisha (Similipal / Eastern Ghats)', lat: 21.3, lon: 85.6, spreadDeg: 1.6, intensity: 0.7, biome: 'forest' },
  { name: 'Northeast (Assam / Nagaland)', lat: 26.1, lon: 93.4, spreadDeg: 2.0, intensity: 0.65, biome: 'forest' },
  { name: 'Western Ghats (Karnataka)', lat: 13.4, lon: 75.5, spreadDeg: 1.4, intensity: 0.45, biome: 'forest' },
  { name: 'Telangana / Andhra scrub', lat: 17.4, lon: 79.3, spreadDeg: 1.8, intensity: 0.5, biome: 'scrub' },
  { name: 'Rajasthan arid margin', lat: 26.6, lon: 73.6, spreadDeg: 1.7, intensity: 0.35, biome: 'scrub' },
  { name: 'Jharkhand coalfield fringe', lat: 23.7, lon: 86.2, spreadDeg: 0.7, intensity: 0.4, biome: 'industrial' },
  { name: 'Gujarat industrial coast', lat: 22.3, lon: 70.0, spreadDeg: 0.9, intensity: 0.3, biome: 'industrial' },
];

const SATELLITE_BY_PRODUCT: Record<ProductId, string[]> = {
  VIIRS_SNPP_NRT: ['N'],
  VIIRS_NOAA20_NRT: ['1'],
  VIIRS_NOAA21_NRT: ['2'],
  MODIS_NRT: ['Aqua', 'Terra'],
  LANDSAT_NRT: ['L8', 'L9'],
};

function gaussian(rng: () => number): number {
  const u = rng() || 1e-9;
  const v = rng() || 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface SyntheticOptions {
  productId: ProductId;
  /** Detections to generate for this product. */
  count: number;
  /** UTC window end (defaults to now). */
  rangeEnd?: Date;
  /** Window length in days. */
  days?: number;
  seed?: number;
}

export function generateSyntheticDetections(opts: SyntheticOptions): FireDetection[] {
  const { productId, count } = opts;
  const rangeEnd = opts.rangeEnd ?? new Date();
  const days = opts.days ?? 7;
  const rng = mulberry32((opts.seed ?? 20260908) + productId.length * 7919);

  const weightTotal = REGIONS.reduce((s, r) => s + r.intensity, 0);
  const out: FireDetection[] = [];

  for (let i = 0; i < count; i += 1) {
    // pick a region by weight
    let pick = rng() * weightTotal;
    let region = REGIONS[0];
    for (const r of REGIONS) {
      pick -= r.intensity;
      if (pick <= 0) {
        region = r;
        break;
      }
    }

    const lat = region.lat + gaussian(rng) * region.spreadDeg * 0.5;
    const lon = region.lon + gaussian(rng) * region.spreadDeg * 0.5;

    // Recency-biased timestamp within the window.
    const ageFrac = rng() ** 1.7; // skew toward recent
    const acquiredAt = new Date(rangeEnd.getTime() - ageFrac * days * 86_400_000);

    const baseFrp =
      region.biome === 'industrial'
        ? 8 + rng() * 40
        : region.biome === 'cropland'
          ? 4 + rng() * 25
          : 6 + rng() * 60;
    const frp = Math.round((baseFrp * (0.6 + rng() * 1.6)) * 10) / 10;

    const daynight: 'D' | 'N' = rng() > 0.72 ? 'N' : 'D';
    const brightness = 300 + (frp / 100) * 60 + gaussian(rng) * 6 + (daynight === 'D' ? 8 : 0);
    const confToken = frp > 45 || rng() > 0.82 ? 'h' : rng() > 0.25 ? 'n' : 'l';
    const sats = SATELLITE_BY_PRODUCT[productId];

    out.push({
      id: `syn-${productId}-${i}`,
      latitude: Number(lat.toFixed(5)),
      longitude: Number(lon.toFixed(5)),
      brightness: Number(brightness.toFixed(2)),
      brightnessSecondary: Number((285 + rng() * 20).toFixed(2)),
      scan: Number((0.38 + rng() * 0.35).toFixed(2)),
      track: Number((0.36 + rng() * 0.25).toFixed(2)),
      frp,
      acquiredAt,
      satellite: sats[Math.floor(rng() * sats.length)],
      instrument: productId.startsWith('VIIRS') ? 'VIIRS' : productId.startsWith('MODIS') ? 'MODIS' : 'OLI',
      confidence: confToken,
      confidenceLevel: normalizeConfidence(confToken),
      version: '2.0NRT',
      daynight,
      productId,
    });
  }

  return out.sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());
}
