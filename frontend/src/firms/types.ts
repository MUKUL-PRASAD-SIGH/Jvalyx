/** Canonical, normalized active-fire detection (superset of FIRMS CSV columns). */
export interface FireDetection {
  id: string;
  latitude: number;
  longitude: number;
  /** Primary brightness temperature (K): bright_ti4 for VIIRS, brightness for MODIS. */
  brightness: number;
  /** Secondary brightness temperature (K): bright_ti5 for VIIRS, bright_t31 for MODIS. */
  brightnessSecondary: number | null;
  scan: number;
  track: number;
  /** Fire Radiative Power in megawatts. */
  frp: number;
  /** UTC acquisition time. */
  acquiredAt: Date;
  satellite: string;
  instrument: string;
  /** Raw confidence token: 'l' | 'n' | 'h' for VIIRS, or 0-100 string for MODIS. */
  confidence: string;
  /** Normalized confidence bucket. */
  confidenceLevel: 'low' | 'nominal' | 'high';
  version: string;
  daynight: 'D' | 'N';
  /** Which FIRMS product this detection belongs to. */
  productId: ProductId;
}

export type ProductId =
  | 'VIIRS_SNPP_NRT'
  | 'VIIRS_NOAA20_NRT'
  | 'VIIRS_NOAA21_NRT'
  | 'MODIS_NRT'
  | 'LANDSAT_NRT';

export interface FireProduct {
  id: ProductId;
  /** FIRMS API source token. */
  apiSource: string;
  label: string;
  shortLabel: string;
  sensor: 'VIIRS' | 'MODIS' | 'OLI';
  platform: string;
  resolution: string;
  /** Nominal footprint in metres, used for pixel sizing on the map. */
  footprintM: number;
  color: string;
}

export type ColorMode = 'time' | 'frp' | 'confidence';

export type TimeWindow = '24h' | '48h' | '7d' | 'custom';

export interface TimeRange {
  window: TimeWindow;
  /** Inclusive UTC start. */
  start: Date;
  /** Exclusive UTC end. */
  end: Date;
}

export interface BasemapConfig {
  id: string;
  label: string;
  group: 'imagery' | 'street' | 'terrain' | 'dark';
  url: string;
  attribution: string;
  maxZoom: number;
  thumbnail: string;
}

export interface GibsLayerConfig {
  id: string;
  label: string;
  /** GIBS layer identifier. */
  layer: string;
  /** WMTS tile matrix set. */
  tileMatrixSet: string;
  format: 'jpg' | 'png';
  maxZoom: number;
  group: 'dynamic-imagery' | 'reference' | 'overlay';
}

export type ToolId =
  | 'measure'
  | 'location'
  | 'layers'
  | 'timeline'
  | 'capture'
  | 'share'
  | 'help'
  | 'viewmode';

export type PanelMode = 'basic' | 'advanced' | 'burned-area' | 'menu' | null;

export interface LayerState {
  /** Visible fire products. */
  products: Record<ProductId, boolean>;
  /** GIBS dynamic imagery layers keyed by id -> {on, opacity}. */
  gibs: Record<string, { on: boolean; opacity: number }>;
  /** Static reference overlays. */
  overlays: {
    protectedAreas: boolean;
    industrialZones: boolean;
    stateBoundaries: boolean;
    labels: boolean;
  };
  fireOpacity: number;
  colorMode: ColorMode;
  basemapId: string;
}

export interface DataStatus {
  source: 'live' | 'bundled' | 'synthetic' | 'loading' | 'error';
  message: string;
  fetchedAt: Date | null;
  total: number;
}
