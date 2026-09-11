import type { BasemapConfig } from '../types';

/**
 * Keyless & Authenticated Basemaps.
 *
 * CARTO requires parameter `?key=...` (not `?api_key=`).
 * When VITE_CARTO_API_KEY is present in .env, authenticated CARTO raster tiles
 * are loaded directly without watermarks.
 * When omitted, clean keyless Esri Canvas tiles are used as fallback.
 */
export const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();

export const BASEMAPS: BasemapConfig[] = [
  {
    id: 'esri-imagery',
    label: 'Satellite (Blue Marble)',
    group: 'imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    thumbnail:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/6/11',
  },
  {
    id: 'carto-dark',
    label: 'Firefly (Dark)',
    group: 'dark',
    url: CARTO_API_KEY
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: CARTO_API_KEY
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 19,
    thumbnail: CARTO_API_KEY
      ? `https://a.basemaps.cartocdn.com/rastertiles/dark_all/4/11/6.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/4/6/11',
  },
  {
    id: 'carto-light',
    label: 'Light',
    group: 'terrain',
    url: CARTO_API_KEY
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: CARTO_API_KEY
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 19,
    thumbnail: CARTO_API_KEY
      ? `https://a.basemaps.cartocdn.com/rastertiles/light_all/4/11/6.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/4/6/11',
  },
  {
    id: 'osm',
    label: 'Streets',
    group: 'street',
    url: CARTO_API_KEY
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors' + (CARTO_API_KEY ? ' &copy; CARTO' : ''),
    maxZoom: 19,
    thumbnail: CARTO_API_KEY
      ? `https://a.basemaps.cartocdn.com/rastertiles/voyager/4/11/6.png?key=${CARTO_API_KEY}`
      : 'https://a.tile.openstreetmap.org/4/11/6.png',
  },
  {
    id: 'esri-terrain',
    label: 'Terrain',
    group: 'terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS',
    maxZoom: 13,
    thumbnail:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/4/6/11',
  },
];

/** Reference overlays: place & boundary labels that sit above basemaps. */
export const REFERENCE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

export const DARK_CANVAS_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

export const LIGHT_CANVAS_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

export function getReferenceLabelUrl(basemapId: string): string {
  if (basemapId === 'carto-dark' && !CARTO_API_KEY) {
    return DARK_CANVAS_LABELS_URL;
  }
  if (basemapId === 'carto-light' && !CARTO_API_KEY) {
    return LIGHT_CANVAS_LABELS_URL;
  }
  return REFERENCE_LABELS_URL;
}

export const DEFAULT_BASEMAP_ID = 'esri-imagery';
