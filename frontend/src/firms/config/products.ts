import type { FireProduct, ProductId } from '../types';

/**
 * FIRMS active-fire products. `apiSource` is the token used by the country CSV API:
 *   https://firms.modaps.eosdis.nasa.gov/api/country/csv/{MAP_KEY}/{apiSource}/IND/{dayRange}
 */
export const FIRE_PRODUCTS: FireProduct[] = [
  {
    id: 'VIIRS_NOAA20_NRT',
    apiSource: 'VIIRS_NOAA20_NRT',
    label: 'VIIRS / NOAA-20 [375m]',
    shortLabel: 'NOAA-20',
    sensor: 'VIIRS',
    platform: 'NOAA-20 (JPSS-1)',
    resolution: '375 m',
    footprintM: 375,
    color: '#ff3b30',
  },
  {
    id: 'VIIRS_NOAA21_NRT',
    apiSource: 'VIIRS_NOAA21_NRT',
    label: 'VIIRS / NOAA-21 [375m]',
    shortLabel: 'NOAA-21',
    sensor: 'VIIRS',
    platform: 'NOAA-21 (JPSS-2)',
    resolution: '375 m',
    footprintM: 375,
    color: '#ff453a',
  },
  {
    id: 'VIIRS_SNPP_NRT',
    apiSource: 'VIIRS_SNPP_NRT',
    label: 'VIIRS / Suomi NPP [375m]',
    shortLabel: 'S-NPP',
    sensor: 'VIIRS',
    platform: 'Suomi NPP',
    resolution: '375 m',
    footprintM: 375,
    color: '#ff6b52',
  },
  {
    id: 'MODIS_NRT',
    apiSource: 'MODIS_NRT',
    label: 'MODIS / Aqua + Terra [1km]',
    shortLabel: 'MODIS',
    sensor: 'MODIS',
    platform: 'Aqua & Terra',
    resolution: '1 km',
    footprintM: 1000,
    color: '#ff9f0a',
  },
  {
    id: 'LANDSAT_NRT',
    apiSource: 'LANDSAT_NRT',
    label: 'OLI / Landsat [30m]',
    shortLabel: 'Landsat',
    sensor: 'OLI',
    platform: 'Landsat 8/9',
    resolution: '30 m',
    footprintM: 30,
    color: '#d10f45',
  },
];

export const PRODUCTS_BY_ID: Record<ProductId, FireProduct> = FIRE_PRODUCTS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<ProductId, FireProduct>,
);

/** Products enabled by default (matches FIRMS "POLAR ORBITING 6/6" minus Landsat for volume). */
export const DEFAULT_PRODUCTS: ProductId[] = [
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'VIIRS_SNPP_NRT',
  'MODIS_NRT',
];

/**
 * "Time since detection" ramp — FIRMS 4-colour scheme. Hours before the range end.
 */
export const TIME_RAMP: { maxHours: number; color: string; label: string }[] = [
  { maxHours: 6, color: '#fff5b1', label: '0–6 h' },
  { maxHours: 12, color: '#ffb14e', label: '6–12 h' },
  { maxHours: 24, color: '#fa6a3c', label: '12–24 h' },
  { maxHours: Infinity, color: '#c81e1e', label: '> 24 h' },
];

/** FRP graduated ramp (MW). */
export const FRP_RAMP: { max: number; color: string; label: string }[] = [
  { max: 5, color: '#ffe9a8', label: '< 5' },
  { max: 20, color: '#ffb14e', label: '5–20' },
  { max: 50, color: '#fa6a3c', label: '20–50' },
  { max: 100, color: '#e63329', label: '50–100' },
  { max: Infinity, color: '#8c0f10', label: '> 100' },
];

export const CONFIDENCE_RAMP: Record<'low' | 'nominal' | 'high', { color: string; label: string }> = {
  low: { color: '#ffd24a', label: 'Low' },
  nominal: { color: '#fa7a3c', label: 'Nominal' },
  high: { color: '#d1211b', label: 'High' },
};

export function colorForTimeSince(acquiredAt: Date, rangeEnd: Date): string {
  const hours = (rangeEnd.getTime() - acquiredAt.getTime()) / 3_600_000;
  return (TIME_RAMP.find((b) => hours <= b.maxHours) ?? TIME_RAMP[TIME_RAMP.length - 1]).color;
}

export function colorForFrp(frp: number): string {
  return (FRP_RAMP.find((b) => frp <= b.max) ?? FRP_RAMP[FRP_RAMP.length - 1]).color;
}

export function normalizeConfidence(raw: string): 'low' | 'nominal' | 'high' {
  const token = raw.trim().toLowerCase();
  if (token === 'l' || token === 'low') return 'low';
  if (token === 'h' || token === 'high') return 'high';
  if (token === 'n' || token === 'nominal') return 'nominal';
  const numeric = Number(token);
  if (!Number.isNaN(numeric)) {
    if (numeric < 30) return 'low';
    if (numeric >= 80) return 'high';
    return 'nominal';
  }
  return 'nominal';
}
