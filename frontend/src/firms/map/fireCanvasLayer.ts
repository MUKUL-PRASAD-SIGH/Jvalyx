import L from 'leaflet';
import type { ColorMode, FireDetection } from '../types';
import { PRODUCTS_BY_ID, colorForFrp, colorForTimeSince } from '../config/products';
import { getFastClassId, PENDING_CLASS_ID } from '../analysis/fastClassifier';
import { CLASS_ID_TO_KEY, FIRE_CLASS_PNG } from '../analysis/iconMap';

const CONFIDENCE_COLOR: Record<'low' | 'nominal' | 'high', string> = {
  low: '#ffd24a',
  nominal: '#fa7a3c',
  high: '#d1211b',
};

const CLASS_COLORS: Record<number, string> = {
  1: '#ef4444', // Red for Industrial
  2: '#22c55e', // Emerald for Wildfire
  3: '#94a3b8', // Slate for Mining
  4: '#f59e0b', // Amber for Stubble
  5: '#a855f7', // Violet for Flare
};

const CLASS_IMAGES: Record<string, HTMLImageElement> = {};
let imagesPreloadStarted = false;

function preloadClassIcons(onLoaded?: () => void) {
  if (imagesPreloadStarted) return;
  imagesPreloadStarted = true;
  for (const [key, url] of Object.entries(FIRE_CLASS_PNG)) {
    const img = new Image();
    img.onload = () => {
      CLASS_IMAGES[key] = img;
      onLoaded?.();
    };
    img.src = url;
  }
}

/**
 * Computes the real geographical footprint and on-screen pixel size
 * based on satellite sensor resolution, Fire Radiative Power (FRP), and map zoom.
 */
function computeFireDimensions(
  zoom: number,
  lat: number,
  productId: string,
  frp: number,
): { iconSize: number; footprintPx: number } {
  // Ground extent in meters (VIIRS 375m, MODIS 1000m, Landsat 30m)
  const sensorM = (PRODUCTS_BY_ID as Record<string, { footprintM?: number }>)[productId]?.footprintM ?? 375;
  // Intense fires (e.g. 100+ MW) have larger thermal spread (0.8x up to 2.2x)
  const frpMultiplier = Math.max(0.8, Math.min(2.2, Math.sqrt(frp / 25)));
  const groundM = sensorM * frpMultiplier;

  // Convert ground meters to screen pixels at current latitude and zoom level
  const latRad = (lat * Math.PI) / 180;
  const metersPerPixel = (40075016.686 * Math.cos(latRad)) / Math.pow(2, zoom + 8);
  const realPx = groundM / Math.max(metersPerPixel, 0.0001);

  // Minimum readable pin size when zoomed out to country view
  const minPin = zoom <= 5 ? 12 : zoom <= 7 ? 14 : zoom <= 9 ? 16 : 18;

  // Dynamic icon size that covers the relative fire area when zoomed in, clamped to max 140px
  const iconSize = Math.max(minPin, Math.min(140, realPx * 0.75));
  const footprintPx = Math.max(minPin * 1.5, realPx);

  return { iconSize, footprintPx };
}

export interface FireCanvasOptions extends L.LayerOptions {
  colorMode: ColorMode;
  opacity: number;
  rangeEnd: Date;
  mapView?: 'satellite' | 'classified';
  onSelect?: (detection: FireDetection | null) => void;
  onHover?: (detection: FireDetection | null) => void;
}

/**
 * High-performance Canvas layer.
 * Dynamically scales fire icons to cover the true relative physical ground area of the fire as the user zooms in.
 */
export const FireCanvasLayer = L.Layer.extend({
  initialize(this: any, detections: FireDetection[], options: FireCanvasOptions) {
    L.setOptions(this, options);
    this._data = detections;
    this._selectedId = null;
  },

  onAdd(this: any, map: L.Map) {
    this._map = map;
    const canvas = L.DomUtil.create('canvas', 'firms-fire-canvas') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    map.getPanes().overlayPane.appendChild(canvas);
    map.on('moveend zoomend resize viewreset', this._reset, this);
    map.on('zoomanim', this._animateZoom, this);
    map.on('click', this._onClick, this);
    map.on('mousemove', this._onMove, this);
    this._reset();

    preloadClassIcons(() => {
      if (this.options.mapView === 'classified') {
        this._draw();
      }
    });

    return this;
  },

  onRemove(this: any, map: L.Map) {
    L.DomUtil.remove(this._canvas);
    map.off('moveend zoomend resize viewreset', this._reset, this);
    map.off('zoomanim', this._animateZoom, this);
    map.off('click', this._onClick, this);
    map.off('mousemove', this._onMove, this);
  },

  setData(this: any, detections: FireDetection[]) {
    this._data = detections;
    this._draw();
  },

  setColorMode(this: any, mode: ColorMode) {
    this.options.colorMode = mode;
    this._draw();
  },

  setMapView(this: any, view: 'satellite' | 'classified') {
    this.options.mapView = view;
    this._draw();
  },

  setOpacity(this: any, opacity: number) {
    this.options.opacity = opacity;
    if (this._canvas) this._canvas.style.opacity = String(opacity);
  },

  setRangeEnd(this: any, end: Date) {
    this.options.rangeEnd = end;
    this._draw();
  },

  setSelected(this: any, id: string | null) {
    this._selectedId = id;
    this._draw();
  },

  _animateZoom(this: any, e: any) {
    const scale = this._map.getZoomScale(e.zoom);
    const offset = this._map._latLngBoundsToNewLayerBounds(this._map.getBounds(), e.zoom, e.center).min;
    L.DomUtil.setTransform(this._canvas, offset, scale);
  },

  _reset(this: any) {
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const size = this._map.getSize();
    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = size.x * dpr;
    this._canvas.height = size.y * dpr;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._canvas.style.opacity = String(this.options.opacity ?? 1);
    this._draw();
  },

  _colorFor(this: any, d: FireDetection): string {
    const mode: ColorMode = this.options.colorMode;
    if (mode === 'frp') return colorForFrp(d.frp);
    if (mode === 'confidence') return CONFIDENCE_COLOR[d.confidenceLevel];
    return colorForTimeSince(d.acquiredAt, this.options.rangeEnd ?? new Date());
  },

  _draw(this: any) {
    if (!this._ctx || !this._map) return;
    const ctx: CanvasRenderingContext2D = this._ctx;
    const map: L.Map = this._map;
    const size = map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    const zoom = map.getZoom();
    const isClassified = this.options.mapView === 'classified';
    const base = zoom >= 9 ? 6 : zoom >= 7 ? 4 : zoom >= 6 ? 3 : 2.5;
    const bounds = map.getBounds().pad(0.15);

    this._points = [];
    for (const d of this._data as FireDetection[]) {
      if (d.latitude > bounds.getNorth() || d.latitude < bounds.getSouth()) continue;
      if (d.longitude > bounds.getEast() || d.longitude < bounds.getWest()) continue;
      const p = map.latLngToContainerPoint([d.latitude, d.longitude]);

      const { iconSize, footprintPx } = computeFireDimensions(zoom, d.latitude, d.productId, d.frp);

      if (isClassified && getFastClassId(d) === PENDING_CLASS_ID) {
        // Model result still loading: neutral marker, no class icon.
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(3, iconSize / 4), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.fill();
      } else if (isClassified) {
        const classId = getFastClassId(d);
        const key = CLASS_ID_TO_KEY[classId] ?? 'agricultural';
        const img = CLASS_IMAGES[key];

        const color = CLASS_COLORS[classId] ?? '#f59e0b';

        // When zoomed in (zoom >= 11), render subtle physical ground burn footprint:
        if (zoom >= 11) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, footprintPx / 2, 0, Math.PI * 2);
          ctx.fillStyle = `${color}25`;
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = `${color}88`;
          ctx.stroke();
        }

        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, p.x - iconSize / 2, p.y - iconSize / 2, iconSize, iconSize);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(4, iconSize / 3), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      } else {
        const s = zoom >= 11 ? Math.max(8, Math.min(160, footprintPx)) : base * (footprintPx >= 20 ? 1.35 : 1);
        ctx.fillStyle = this._colorFor(d);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }

      this._points.push({ x: p.x, y: p.y, d, iconSize });
    }

    if (this._selectedId) {
      const hit = this._points.find((pt: any) => pt.d.id === this._selectedId);
      if (hit) {
        ctx.beginPath();
        const r = Math.max(12, (hit.iconSize || 16) / 2 + 5);
        ctx.arc(hit.x, hit.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  },

  _nearest(this: any, layerPoint: L.Point): FireDetection | null {
    const cp = this._map.layerPointToContainerPoint(layerPoint);
    let best: any = null;
    let bestDist = 20;
    for (const pt of this._points ?? []) {
      const hitRadius = Math.max(14, (pt.iconSize || 16) / 2 + 6);
      const dist = Math.hypot(pt.x - cp.x, pt.y - cp.y);
      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist;
        best = pt.d;
      }
    }
    return best;
  },

  _onClick(this: any, e: L.LeafletMouseEvent) {
    const hit = this._nearest(e.layerPoint);
    this.options.onSelect?.(hit);
  },

  _onMove(this: any, e: L.LeafletMouseEvent) {
    if (!this.options.onHover) return;
    const hit = this._nearest(e.layerPoint);
    this._canvas.style.cursor = hit ? 'pointer' : '';
    this.options.onHover(hit);
  },
});

export function createFireCanvasLayer(
  detections: FireDetection[],
  options: FireCanvasOptions,
): L.Layer & {
  setData: (d: FireDetection[]) => void;
  setColorMode: (m: ColorMode) => void;
  setOpacity: (o: number) => void;
  setRangeEnd: (d: Date) => void;
  setSelected: (id: string | null) => void;
  setMapView: (view: 'satellite' | 'classified') => void;
} {
  // @ts-expect-error - Leaflet's extend() typing
  return new FireCanvasLayer(detections, options);
}
