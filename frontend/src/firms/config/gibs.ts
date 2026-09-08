import type { GibsLayerConfig } from '../types';

/**
 * NASA GIBS (Global Imagery Browse Services) — free, keyless WMTS in EPSG:3857.
 * URL pattern:
 *   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{time}/{matrix}/{z}/{y}/{x}.{ext}
 * `{time}` is a YYYY-MM-DD date; imagery is daily.
 */
export const GIBS_ENDPOINT = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

export function gibsUrlTemplate(layer: GibsLayerConfig): string {
  return `${GIBS_ENDPOINT}/${layer.layer}/default/{time}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.format}`;
}

/** Matches the FIRMS "Dynamic Imagery" group. */
export const GIBS_DYNAMIC_IMAGERY: GibsLayerConfig[] = [
  {
    id: 'viirs-noaa20-truecolor',
    label: 'VIIRS NOAA-20 Corrected Reflectance (true color)',
    layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxZoom: 9,
    group: 'dynamic-imagery',
  },
  {
    id: 'viirs-noaa21-truecolor',
    label: 'VIIRS NOAA-21 Corrected Reflectance (true color)',
    layer: 'VIIRS_NOAA21_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxZoom: 9,
    group: 'dynamic-imagery',
  },
  {
    id: 'viirs-snpp-truecolor',
    label: 'VIIRS S-NPP Corrected Reflectance (true color)',
    layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxZoom: 9,
    group: 'dynamic-imagery',
  },
  {
    id: 'modis-aqua-truecolor',
    label: 'MODIS/Aqua Corrected Reflectance (true color)',
    layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxZoom: 9,
    group: 'dynamic-imagery',
  },
  {
    id: 'modis-terra-truecolor',
    label: 'MODIS/Terra Corrected Reflectance (true color)',
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxZoom: 9,
    group: 'dynamic-imagery',
  },
];

/** Thermal-anomaly & fire reference overlays available in Advanced mode. */
export const GIBS_REFERENCE_LAYERS: GibsLayerConfig[] = [
  {
    id: 'viirs-thermal-anomalies',
    label: 'VIIRS S-NPP Thermal Anomalies (Day & Night)',
    layer: 'VIIRS_SNPP_Thermal_Anomalies_375m_All',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    format: 'png',
    maxZoom: 8,
    group: 'overlay',
  },
];
