import type { BasemapConfig } from '../types';

/**
 * All keyless — no token required. Mirrors the FIRMS "Static Backgrounds" group
 * (Blue Marble / Firefly / Streets) with equivalents that don't need a NASA GIBS
 * snapshot key.
 */
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
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    thumbnail: 'https://a.basemaps.cartocdn.com/dark_all/4/11/6.png',
  },
  {
    id: 'carto-light',
    label: 'Light',
    group: 'terrain',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    thumbnail: 'https://a.basemaps.cartocdn.com/light_all/4/11/6.png',
  },
  {
    id: 'osm',
    label: 'Streets',
    group: 'street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    thumbnail: 'https://a.tile.openstreetmap.org/4/11/6.png',
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

/** Reference overlay: place & boundary labels that sit above imagery basemaps. */
export const REFERENCE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

export const DEFAULT_BASEMAP_ID = 'esri-imagery';
