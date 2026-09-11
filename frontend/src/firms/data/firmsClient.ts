import type { DataStatus, FireDetection, ProductId } from '../types';
import { FIRE_PRODUCTS, PRODUCTS_BY_ID } from '../config/products';
import { INDIA_FIRMS_BBOX } from '../config/india';
import { parseFirmsCsv } from './parse';
import { generateSyntheticDetections } from './synthetic';

const MAP_KEY = (import.meta.env.VITE_FIRMS_MAP_KEY as string | undefined)?.trim();
const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8000';

/**
 * Candidate URLs for FIRMS queries:
 * 1. Relative `/firms-proxy/api/...` (proxied by Vite dev server or Nginx container — same-origin, zero CORS)
 * 2. FastAPI backend proxy at `${BACKEND_BASE}/api/firms/...` (has CORS middleware enabled)
 * 3. Direct upstream fallback
 */
function getFirmsApiCandidates(subpath: string): string[] {
  const clean = subpath.replace(/^\/+/, '');
  return [
    `/firms-proxy/api/${clean}`,
    `${BACKEND_BASE}/api/firms/${clean}`,
    `https://firms.modaps.eosdis.nasa.gov/api/${clean}`,
  ];
}

/** Approx. detections per product for the synthetic fallback (7-day India window). */
const SYNTHETIC_VOLUME: Record<ProductId, number> = {
  VIIRS_NOAA20_NRT: 900,
  VIIRS_NOAA21_NRT: 820,
  VIIRS_SNPP_NRT: 780,
  MODIS_NRT: 420,
  LANDSAT_NRT: 90,
};

export interface LoadResult {
  detections: FireDetection[];
  status: DataStatus;
}

function clampDayRange(days: number): number {
  return Math.max(1, Math.min(10, Math.round(days)));
}

interface DateSlice {
  startDate: string;
  days: number;
}

/**
 * NASA FIRMS Area API accepts at most 5 days per query.
 * For windows spanning > 5 days (or rolling recent windows), partition into slices.
 */
function getDateSlices(dayRange: number, endDate: Date): DateSlice[] {
  const effectiveDays = Math.max(2, Math.min(10, Math.round(dayRange)));
  const slices: DateSlice[] = [];
  const startTime = endDate.getTime() - (effectiveDays - 1) * 86_400_000;
  let currentStart = new Date(startTime);
  let remainingDays = effectiveDays;

  while (remainingDays > 0) {
    const chunkDays = Math.min(5, remainingDays);
    slices.push({
      startDate: currentStart.toISOString().slice(0, 10),
      days: chunkDays,
    });
    currentStart = new Date(currentStart.getTime() + chunkDays * 86_400_000);
    remainingDays -= chunkDays;
  }

  return slices;
}

/** Live NASA FIRMS Area API — partitions into <=5-day slices and queries India bounding box via CORS proxies. */
async function fetchLiveProduct(
  productId: ProductId,
  dayRange: number,
  endDate: Date,
): Promise<FireDetection[]> {
  const product = PRODUCTS_BY_ID[productId];
  const slices = getDateSlices(dayRange, endDate);

  const chunkPromises = slices.map(async (slice) => {
    const subpath = `area/csv/${MAP_KEY}/${product.apiSource}/${INDIA_FIRMS_BBOX}/${slice.days}/${slice.startDate}`;
    const candidateUrls = getFirmsApiCandidates(subpath);

    let lastError: unknown = null;
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        if (/Invalid MAP_KEY|Invalid API call|error/i.test(text.slice(0, 200)) && !text.includes('latitude')) {
          throw new Error(`FIRMS ${product.apiSource}: ${text.slice(0, 120)}`);
        }
        return parseFirmsCsv(text, productId);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`FIRMS ${product.apiSource} fetch failed`);
  });

  const results = await Promise.all(chunkPromises);
  const flat = results.flat();

  const seen = new Set<string>();
  return flat.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

/** Bundled CSV dropped by the team at /data/<file>. Best-effort, optional. */
async function fetchBundled(productId: ProductId): Promise<FireDetection[]> {
  const product = PRODUCTS_BY_ID[productId];
  const candidates = [
    `/data/${product.apiSource}.csv`,
    `/data/${productId}.csv`,
    `/data/${product.sensor.toLowerCase()}_india.csv`,
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok && res.headers.get('content-type')?.includes('csv') !== false) {
        const text = await res.text();
        if (text.includes('latitude')) return parseFirmsCsv(text, productId);
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

export interface LoadOptions {
  products: ProductId[];
  days: number;
  endDate: Date;
}

/**
 * Resolution order: live FIRMS API (if a MAP_KEY is set) → bundled CSVs in
 * /public/data → synthetic India data. Whatever succeeds first wins per run.
 */
export async function loadDetections(opts: LoadOptions): Promise<LoadResult> {
  const products = opts.products.length ? opts.products : FIRE_PRODUCTS.map((p) => p.id);
  const dayRange = clampDayRange(opts.days);

  if (MAP_KEY) {
    try {
      const batches = await Promise.all(
        products.map(async (id) => {
          try {
            return await fetchLiveProduct(id, dayRange, opts.endDate);
          } catch (err) {
            console.warn(`[firms] live fetch for ${id} failed:`, err);
            return [];
          }
        }),
      );
      const detections = batches.flat();
      if (detections.length > 0) {
        return {
          detections,
          status: {
            source: 'live',
            message: `NASA FIRMS NRT · ${products.length} products · ${dayRange}-day window`,
            fetchedAt: new Date(),
            total: detections.length,
          },
        };
      }
    } catch (err) {
      // fall through to bundled / synthetic
      console.warn('[firms] live fetch failed, falling back:', err);
    }
  }

  const bundled = (await Promise.all(products.map(fetchBundled))).flat();
  if (bundled.length > 0) {
    return {
      detections: bundled,
      status: {
        source: 'bundled',
        message: `Bundled India dataset · ${bundled.length.toLocaleString()} detections`,
        fetchedAt: new Date(),
        total: bundled.length,
      },
    };
  }

  const synthetic = products.flatMap((id) =>
    generateSyntheticDetections({
      productId: id,
      count: Math.round((SYNTHETIC_VOLUME[id] ?? 200) * (dayRange / 7)),
      rangeEnd: opts.endDate,
      days: dayRange,
    }),
  );
  return {
    detections: synthetic,
    status: {
      source: 'synthetic',
      message: MAP_KEY
        ? 'Live feed unavailable — showing representative synthetic India data'
        : 'No MAP_KEY / dataset — showing representative synthetic India data',
      fetchedAt: new Date(),
      total: synthetic.length,
    },
  };
}

export const HAS_MAP_KEY = Boolean(MAP_KEY);
