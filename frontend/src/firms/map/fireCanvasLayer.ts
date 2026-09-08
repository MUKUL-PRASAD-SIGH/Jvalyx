import L from 'leaflet';
import type { ColorMode, FireDetection } from '../types';
import { PRODUCTS_BY_ID, colorForFrp, colorForTimeSince } from '../config/products';

const CONFIDENCE_COLOR: Record<'low' | 'nominal' | 'high', string> = {
  low: '#ffd24a',
  nominal: '#fa7a3c',
  high: '#d1211b',
};

export interface FireCanvasOptions extends L.LayerOptions {
  colorMode: ColorMode;
  opacity: number;
  rangeEnd: Date;
  onSelect?: (detection: FireDetection | null) => void;
  onHover?: (detection: FireDetection | null) => void;
}

/**
 * Canvas layer that draws FIRMS-style square fire pixels. Handles thousands of
 * points smoothly and does its own click hit-testing.
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
    const base = zoom >= 9 ? 6 : zoom >= 7 ? 4 : zoom >= 6 ? 3 : 2.5;
    const bounds = map.getBounds().pad(0.15);

    this._points = [];
    for (const d of this._data as FireDetection[]) {
      if (d.latitude > bounds.getNorth() || d.latitude < bounds.getSouth()) continue;
      if (d.longitude > bounds.getEast() || d.longitude < bounds.getWest()) continue;
      const p = map.latLngToContainerPoint([d.latitude, d.longitude]);
      const footprint = PRODUCTS_BY_ID[d.productId]?.footprintM ?? 375;
      const s = base * (footprint >= 1000 ? 1.35 : footprint <= 30 ? 0.7 : 1);
      ctx.fillStyle = this._colorFor(d);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      this._points.push({ x: p.x, y: p.y, d });
    }

    if (this._selectedId) {
      const hit = this._points.find((pt: any) => pt.d.id === this._selectedId);
      if (hit) {
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, base + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  },

  _nearest(this: any, layerPoint: L.Point): FireDetection | null {
    const cp = this._map.layerPointToContainerPoint(layerPoint);
    let best: any = null;
    let bestDist = 12;
    for (const pt of this._points ?? []) {
      const dist = Math.hypot(pt.x - cp.x, pt.y - cp.y);
      if (dist < bestDist) {
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
} {
  // @ts-expect-error - Leaflet's extend() typing
  return new FireCanvasLayer(detections, options);
}
