import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { BASEMAPS, getReferenceLabelUrl } from '../config/basemaps';
import { GIBS_DYNAMIC_IMAGERY, gibsUrlTemplate } from '../config/gibs';
import { PROTECTED_AREAS } from '../config/protectedAreas';
import {
  INDIA_CENTER,
  INDIA_DEFAULT_ZOOM,
  INDIA_FIT_BOUNDS,
  INDIA_MAX_BOUNDS,
  INDIA_MAX_ZOOM,
  INDIA_MIN_ZOOM,
} from '../config/india';
import { createFireCanvasLayer } from './fireCanvasLayer';
import { mapBus } from './mapBus';
import { attachMeasureTool } from './measureTool';
import { captureMap } from './capture';

export function FireMap() {
  const state = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const basemapRef = useRef<L.TileLayer | null>(null);
  const labelsRef = useRef<L.TileLayer | null>(null);
  const gibsRef = useRef<Record<string, L.TileLayer>>({});
  const paRef = useRef<L.LayerGroup | null>(null);
  const indRef = useRef<L.GeoJSON | null>(null);
  const fireRef = useRef<ReturnType<typeof createFireCanvasLayer> | null>(null);

  /* -- init -------------------------------------------------------------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: INDIA_CENTER,
      zoom: INDIA_DEFAULT_ZOOM,
      minZoom: INDIA_MIN_ZOOM,
      maxZoom: INDIA_MAX_ZOOM,
      maxBounds: L.latLngBounds(INDIA_MAX_BOUNDS),
      maxBoundsViscosity: 0.7,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: false,
    });
    map.setView(INDIA_CENTER, INDIA_DEFAULT_ZOOM);
    L.control.scale({ position: 'bottomleft', imperial: true, metric: true }).addTo(map);
    map.attributionControl.setPrefix('');
    // Leaflet inside a flex column often mounts before the container has its final
    // height — settle the size and fit India once it's measured.
    const settle = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(INDIA_FIT_BOUNDS), { padding: [12, 12], animate: false });
    }, 150);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    map.on('mousemove', (e) =>
      dispatch({ type: 'hover', coord: { lat: e.latlng.lat, lon: e.latlng.lng } }),
    );
    map.on('mouseout', () => dispatch({ type: 'hover', coord: null }));

    const fire = createFireCanvasLayer([], {
      colorMode: state.layers.colorMode,
      opacity: state.layers.fireOpacity,
      rangeEnd: state.timeRange.end,
      onSelect: (d) => dispatch({ type: 'select', id: d ? d.id : null }),
    });
    fire.addTo(map);
    fireRef.current = fire;
    mapRef.current = map;

    const measure = attachMeasureTool(map);
    const unbind = [
      mapBus.on('flyTo', ({ lat, lon, zoom }) => map.flyTo([lat, lon], zoom ?? map.getZoom(), { duration: 0.8 })),
      mapBus.on('fitIndia', () => map.fitBounds(L.latLngBounds(INDIA_FIT_BOUNDS), { padding: [12, 12] })),
      mapBus.on('zoomIn', () => map.zoomIn()),
      mapBus.on('zoomOut', () => map.zoomOut()),
      mapBus.on('geolocate', () =>
        map.locate({ setView: true, maxZoom: 9 }).on('locationerror', () => {
          /* silently ignore */
        }),
      ),
      mapBus.on('toggleMeasure', (on) => measure.setActive(on)),
      mapBus.on('capture', () => captureMap(containerRef.current)),
    ];

    return () => {
      window.clearTimeout(settle);
      ro.disconnect();
      unbind.forEach((u) => u());
      measure.destroy();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- basemap --------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cfg = BASEMAPS.find((b) => b.id === state.layers.basemapId) ?? BASEMAPS[0];
    if (basemapRef.current) map.removeLayer(basemapRef.current);
    basemapRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxZoom,
      subdomains: cfg.url.includes('{s}') ? 'abc' : [],
    }).addTo(map);
    basemapRef.current.setZIndex(100);

    const needLabels = (cfg.group === 'imagery' || cfg.group === 'dark' || cfg.id === 'carto-light') && state.layers.overlays.labels;
    if (labelsRef.current) {
      map.removeLayer(labelsRef.current);
      labelsRef.current = null;
    }
    if (needLabels) {
      labelsRef.current = L.tileLayer(getReferenceLabelUrl(cfg.id), {
        maxZoom: 18,
        opacity: 0.85,
        pane: 'shadowPane',
      }).addTo(map);
    }
  }, [state.layers.basemapId, state.layers.overlays.labels]);

  /* -- GIBS dynamic imagery ------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dateStr = state.timeRange.end.toISOString().slice(0, 10);
    for (const layer of GIBS_DYNAMIC_IMAGERY) {
      const s = state.layers.gibs[layer.id];
      const existing = gibsRef.current[layer.id];
      if (s?.on) {
        const url = gibsUrlTemplate(layer).replace('{time}', dateStr);
        if (!existing || (existing as any)._url !== url) {
          if (existing) map.removeLayer(existing);
          const tl = L.tileLayer(url, {
            maxZoom: INDIA_MAX_ZOOM,
            maxNativeZoom: layer.maxZoom,
            opacity: s.opacity,
            bounds: L.latLngBounds(INDIA_MAX_BOUNDS),
          }).addTo(map);
          tl.setZIndex(200);
          gibsRef.current[layer.id] = tl;
        } else {
          existing.setOpacity(s.opacity);
        }
      } else if (existing) {
        map.removeLayer(existing);
        delete gibsRef.current[layer.id];
      }
    }
  }, [state.layers.gibs, state.timeRange.end]);

  /* -- protected areas ---------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (paRef.current) {
      map.removeLayer(paRef.current);
      paRef.current = null;
    }
    if (!state.layers.overlays.protectedAreas) return;
    const group = L.layerGroup(
      PROTECTED_AREAS.map((pa) =>
        L.circle([pa.lat, pa.lon], {
          radius: pa.radiusKm * 1000,
          color: '#2dd4bf',
          weight: 1,
          opacity: 0.7,
          fillColor: '#0d9488',
          fillOpacity: 0.12,
        }).bindTooltip(`${pa.name} — ${pa.category}`, { sticky: true }),
      ),
    ).addTo(map);
    group.eachLayer((l) => (l as L.Path).bringToBack());
    paRef.current = group;
  }, [state.layers.overlays.protectedAreas]);

  /* -- industrial & mining zones ------------------------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (indRef.current) {
      map.removeLayer(indRef.current);
      indRef.current = null;
    }
    if (!state.layers.overlays.industrialZones) return;

    let active = true;
    fetch('/data/india_industrial_polygons_tagged.geojson')
      .then((res) => res.json())
      .then((data) => {
        if (!active || !mapRef.current) return;
        const layer = L.geoJSON(data, {
          style: (feature) => {
            const props = feature?.properties || {};
            const isMine = props.coal_industrial_zone || props.industrial === 'mine';
            return {
              color: isMine ? '#f59e0b' : '#38bdf8',
              weight: 1.5,
              dashArray: '4, 4',
              opacity: 0.85,
              fillColor: isMine ? '#d97706' : '#0284c7',
              fillOpacity: 0.18,
            };
          },
          onEachFeature: (feature, l) => {
            const props = feature.properties || {};
            const name = props.name || props.coal_industrial_zone || 'Industrial Facility';
            const zone = props.coal_industrial_zone
              ? String(props.coal_industrial_zone).replace(/_/g, ' ')
              : 'General Industrial';
            const area = props.area_sqkm ? `${Number(props.area_sqkm).toFixed(2)} km²` : '';
            l.bindTooltip(
              `<div class="font-mono text-xs font-bold text-zinc-100">${name}</div>
               <div class="font-mono text-[10px] text-amber-300 font-bold">${zone}</div>
               ${area ? `<div class="font-mono text-[9px] text-zinc-400">Area: ${area}</div>` : ''}`,
              { sticky: true },
            );
          },
        }).addTo(map);
        layer.eachLayer((l) => (l as L.Path).bringToBack());
        indRef.current = layer;
      })
      .catch((err) => {
        console.warn('Failed to load industrial polygons GeoJSON:', err);
      });

    return () => {
      active = false;
      if (indRef.current && mapRef.current) {
        mapRef.current.removeLayer(indRef.current);
        indRef.current = null;
      }
    };
  }, [state.layers.overlays.industrialZones]);

  /* -- fire data + style -------------------------------------------- */
  useEffect(() => {
    fireRef.current?.setData(visible);
  }, [visible]);
  useEffect(() => {
    fireRef.current?.setColorMode(state.layers.colorMode);
  }, [state.layers.colorMode]);
  useEffect(() => {
    fireRef.current?.setOpacity(state.layers.fireOpacity);
  }, [state.layers.fireOpacity]);
  useEffect(() => {
    fireRef.current?.setRangeEnd(state.timeRange.end);
  }, [state.timeRange.end]);
  useEffect(() => {
    fireRef.current?.setSelected(state.selectedId);
    const map = mapRef.current;
    if (state.selectedId && map) {
      const d = visible.find((x) => x.id === state.selectedId);
      if (d) map.panInside([d.latitude, d.longitude], { padding: [80, 80] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedId]);

  return <div ref={containerRef} className="absolute inset-0 z-0 firms-map" />;
}
