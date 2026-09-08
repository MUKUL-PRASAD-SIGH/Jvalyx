import type { LatLngBoundsLiteral, LatLngTuple } from 'leaflet';

/** Mainland + island territories bounding box for India. */
export const INDIA_BOUNDS: LatLngBoundsLiteral = [
  [6.5, 67.0], // SW  (below Kanyakumari / Lakshadweep side)
  [37.6, 97.5], // NE  (Ladakh / Arunachal)
];

/** Slightly padded max-bounds so the user can pan a little past the coastline. */
export const INDIA_MAX_BOUNDS: LatLngBoundsLiteral = [
  [2.0, 60.0],
  [41.0, 104.0],
];

export const INDIA_CENTER: LatLngTuple = [22.8, 80.5];

export const INDIA_DEFAULT_ZOOM = 5;
export const INDIA_MIN_ZOOM = 4;
export const INDIA_MAX_ZOOM = 12;

/** Tighter fit used on first paint — mainland + immediate neighbours, not the far islands. */
export const INDIA_FIT_BOUNDS: LatLngBoundsLiteral = [
  [7.5, 68.0],
  [35.7, 92.0],
];

/** FIRMS country code for the archive / country API. */
export const INDIA_COUNTRY_CODE = 'IND';

/** Quick-search shortcuts (keyless — geocoding uses Nominatim). */
export const INDIA_PLACES: { label: string; center: LatLngTuple; zoom: number }[] = [
  { label: 'Delhi NCR', center: [28.61, 77.21], zoom: 9 },
  { label: 'Punjab & Haryana', center: [30.2, 75.9], zoom: 7 },
  { label: 'Mumbai', center: [19.08, 72.88], zoom: 9 },
  { label: 'Bengaluru', center: [12.97, 77.59], zoom: 9 },
  { label: 'Similipal, Odisha', center: [21.85, 86.34], zoom: 9 },
  { label: 'Bandipur, Karnataka', center: [11.71, 76.53], zoom: 9 },
  { label: 'Uttarakhand Hills', center: [30.07, 79.09], zoom: 8 },
  { label: 'Northeast (Assam)', center: [26.2, 92.9], zoom: 7 },
];
