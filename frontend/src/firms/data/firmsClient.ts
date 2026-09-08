import type { DataStatus, FireDetection, ProductId } from '../types';
import { FIRE_PRODUCTS, PRODUCTS_BY_ID } from '../config/products';
import { INDIA_COUNTRY_CODE } from '../config/india';
import { parseFirmsCsv } from './parse';
import { generateSyntheticDetections } from './synthetic';

const FIRMS_API_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/country/csv';
const MAP_KEY = (import.meta.env.VITE_FIRMS_MAP_KEY as string | undefined)?.trim();

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

/** Live NASA FIRMS country API — one request per product. */
async function fetchLiveProduct(
  productId: ProductId,
  dayRange: number,
  endDate: Date,
): Promise<FireDetection[]> {
  const product = PRODUCTS_BY_ID[productId];
  const iso = endDate.toISOString().slice(0, 10);
  const url = `${FIRMS_API_BASE}/${MAP_KEY}/${product.apiSource}/${INDIA_COUNTRY_CODE}/${dayRange}/${iso}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS ${product.apiSource} → HTTP ${res.status}`);
  const text = await res.text();
  if (/Invalid MAP_KEY|error/i.test(text.slice(0, 200)) && !text.includes('latitude')) {
    throw new Error(`FIRMS ${product.apiSource}: ${text.slice(0, 120)}`);
  }
  return parseFirmsCsv(text, productId);
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
        products.map((id) => fetchLiveProduct(id, dayRange, opts.endDate)),
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
