import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { ScenarioFrame, FacilityDigitalTwin } from '../types';
import type { FIRMSRecord } from '../services/firms';
import { Layers, Crosshair } from 'lucide-react';

interface TacticalMapProps {
  frame: ScenarioFrame;
  facility: FacilityDigitalTwin;
  isSimulated?: boolean;
  firmsHotspots?: FIRMSRecord[];
  selectedHotspotIndex?: number;
  onSelectHotspot?: (index: number) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  frame,
  facility,
  firmsHotspots,
  selectedHotspotIndex,
  onSelectHotspot
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Layer Visibility States
  const [showRawDetections, setShowRawDetections] = useState(true);
  const [showFacilityPolygon, setShowFacilityPolygon] = useState(true);
  const [showSegmentationMask, setShowSegmentationMask] = useState(true);
  const [showPlumeCorridor, setShowPlumeCorridor] = useState(true);
  const [showAssets, setShowAssets] = useState(true);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [frame.fusedEvent.latitude, frame.fusedEvent.longitude],
        zoom: firmsHotspots && firmsHotspots.length > 0 ? 6 : 13,
        zoomControl: true,
        attributionControl: true
      });

      // Tactical Dark Basemap Tiles (Authenticated CARTO with Esri fallback)
      const cartoKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
      const darkTileUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

      L.tileLayer(darkTileUrl, {
        attribution: cartoKey
          ? '&copy; <a href="https://carto.com/">CARTO</a> | NASA FIRMS & SIH 2026'
          : 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | NASA FIRMS & SIH 2026',
        maxZoom: 19,
        subdomains: cartoKey ? 'abcd' : [],
      }).addTo(map);

      if (!cartoKey) {
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 18, opacity: 0.85, pane: 'shadowPane' }
        ).addTo(map);
      }

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }
  }, []);

  // Update Map Elements when frame or hotspots change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // If viewing Live NASA FIRMS hotspots
    if (firmsHotspots && firmsHotspots.length > 0) {
      firmsHotspots.forEach((spot, idx) => {
        const isSelected = idx === selectedHotspotIndex;
        const radius = Math.min(20, Math.max(8, Math.sqrt(spot.frp) * 2.0));

        const iconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer">
            ${isSelected ? '<div class="absolute w-8 h-8 rounded-none border-2 border-cyan-400 bg-cyan-400/30 animate-ping"></div>' : ''}
            <div style="width: ${Math.round(radius)}px; height: ${Math.round(radius)}px" class="px-1 py-0.5 border ${
              isSelected ? 'border-cyan-300 bg-cyan-500 text-black font-black' : spot.frp > 80 ? 'border-rose-400 bg-rose-600 text-white' : 'border-amber-400 bg-amber-500 text-black'
            } text-[8px] font-mono font-bold shadow-solid-sm flex items-center justify-center">
              ${spot.frp.toFixed(0)}M
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'firms-marker-pin',
          iconSize: [28, 20],
          iconAnchor: [14, 10]
        });

        const marker = L.marker([spot.latitude, spot.longitude], { icon });

        marker.on('click', () => {
          if (onSelectHotspot) onSelectHotspot(idx);
          map.setView([spot.latitude, spot.longitude], Math.max(map.getZoom(), 11));
        });

        marker.bindTooltip(
          `<div class="font-mono text-xs font-bold text-zinc-100">NASA FIRMS Hotspot #${idx + 1}</div>
           <div class="font-mono text-[10px] text-amber-300">FRP: ${spot.frp.toFixed(1)} MW | ${spot.satellite === 'N' ? 'VIIRS' : 'MODIS'}</div>
           <div class="font-mono text-[9px] text-zinc-400">Click to analyze with Jvalyx AI</div>`,
          { permanent: false, direction: 'top' }
        );

        layerGroup.addLayer(marker);
      });

      // Also render plume if active selected hotspot has one
      if (frame.tactical?.plumeCorridor && showPlumeCorridor) {
        const { cone90, cone50, centerline } = frame.tactical.plumeCorridor;
        const p90 = L.polygon(cone90, { color: '#c084fc', weight: 1.2, dashArray: '3, 4', fillColor: '#a855f7', fillOpacity: 0.2 });
        const p50 = L.polygon(cone50, { color: '#d8b4fe', weight: 1.5, fillColor: '#9333ea', fillOpacity: 0.35 });
        const line = L.polyline(centerline, { color: '#f3e8ff', weight: 1.5, dashArray: '2, 3' });
        layerGroup.addLayer(p90);
        layerGroup.addLayer(p50);
        layerGroup.addLayer(line);
      }

      return;
    }

    // Otherwise standard Scenario Rendering
    const currentCenter = map.getCenter();
    const targetLat = frame.fusedEvent.latitude;
    const targetLon = frame.fusedEvent.longitude;
    const dist = Math.hypot(currentCenter.lat - targetLat, currentCenter.lng - targetLon);
    if (dist > 0.05) {
      map.setView([targetLat, targetLon], 13);
    }

    // 1. Facility Boundary Polygon
    if (showFacilityPolygon && facility.polygon && facility.polygon.length > 0) {
      const facilityPolygon = L.polygon(facility.polygon as [number, number][], {
        color: '#ffffff',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#38bdf8',
        fillOpacity: 0.06
      });

      facilityPolygon.bindTooltip(
        `<div class="font-mono text-xs font-bold text-zinc-100">${facility.name}</div>
         <div class="text-[10px] text-cyan-300 font-mono">${facility.type}</div>`,
        { permanent: false, direction: 'top' }
      );

      layerGroup.addLayer(facilityPolygon);
    }

    // 2. Probabilistic Plume Corridor (50% and 90% envelopes)
    if (showPlumeCorridor && frame.tactical?.plumeCorridor) {
      const { cone90, cone50, centerline, windSpeedMps, windDirectionDeg } = frame.tactical.plumeCorridor;

      const poly90 = L.polygon(cone90, {
        color: '#c084fc',
        weight: 1.2,
        dashArray: '3, 5',
        fillColor: '#a855f7',
        fillOpacity: 0.18
      });

      poly90.bindTooltip(
        `<div class="font-mono text-xs font-bold text-purple-300">Downwind Probability Corridor (90%)</div>
         <div class="font-mono text-[10px] text-zinc-300">Wind: ${windSpeedMps.toFixed(1)} m/s @ ${windDirectionDeg.toFixed(0)}°</div>
         <div class="font-mono text-[9px] text-purple-400/80">Monte Carlo Plume Envelope · Open-Meteo vectors</div>`,
        { permanent: false, direction: 'right' }
      );
      layerGroup.addLayer(poly90);

      const poly50 = L.polygon(cone50, {
        color: '#d8b4fe',
        weight: 1.5,
        fillColor: '#9333ea',
        fillOpacity: 0.32
      });
      layerGroup.addLayer(poly50);

      const line = L.polyline(centerline, {
        color: '#f3e8ff',
        weight: 1.5,
        dashArray: '2, 3',
        opacity: 0.8
      });
      layerGroup.addLayer(line);
    }

    // 3. Tactical Segmentation Mask
    if (showSegmentationMask && frame.tactical?.segmentationMask) {
      const mask = frame.tactical.segmentationMask;
      const maskPolygon = L.polygon(mask.coordinates[0] as [number, number][], {
        color: '#f43f5e',
        weight: 2,
        fillColor: '#e11d48',
        fillOpacity: 0.45
      });
      layerGroup.addLayer(maskPolygon);
    }

    // 4. Raw Sensor Detections
    if (showRawDetections && frame.fusedEvent.detections) {
      frame.fusedEvent.detections.forEach((det, idx) => {
        const markerHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 border-2 border-zinc-100 ${
              det.sensor === 'VIIRS' ? 'bg-amber-500' : 'bg-orange-600'
            } shadow-solid-sm flex items-center justify-center text-[8px] font-black text-black">
              ${det.sensor[0]}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-thermal-pin',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([det.latitude, det.longitude], { icon: customIcon });

        marker.bindPopup(
          `<div class="p-2 font-mono text-xs bg-zinc-900 text-zinc-100 border border-zinc-700">
             <div class="font-bold text-amber-400 border-b border-zinc-700 pb-1 mb-1">DETECTION #${idx + 1} (${det.sensor})</div>
             <div>FRP: <span class="text-rose-400 font-bold">${det.frp_mw.toFixed(1)} MW</span></div>
             <div>TI4 (SWIR): ${det.bright_ti4_k.toFixed(1)} K</div>
             <div>TI5 (TIR): ${det.bright_ti5_k.toFixed(1)} K</div>
             <div>Quality: ${(det.quality_score * 100).toFixed(0)}%</div>
           </div>`
        );

        layerGroup.addLayer(marker);
      });
    }

    // 5. Fused Centroid Crosshair Marker
    const fusedLat = frame.fusedEvent.latitude;
    const fusedLon = frame.fusedEvent.longitude;
    const fusedIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="w-6 h-6 border-2 border-cyan-400 bg-cyan-950/60 flex items-center justify-center shadow-solid-cyan">
          <div class="w-2 h-2 bg-cyan-300"></div>
        </div>
      </div>
    `;
    const fusedIcon = L.divIcon({
      html: fusedIconHtml,
      className: 'fused-centroid-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const fusedMarker = L.marker([fusedLat, fusedLon], { icon: fusedIcon });
    layerGroup.addLayer(fusedMarker);

    // 6. Critical Assets
    if (showAssets && facility.nearbyAssets) {
      facility.nearbyAssets.forEach((asset) => {
        const isSettlement = asset.type === 'settlement';
        const assetMarkerHtml = `
          <div class="px-1.5 py-0.5 border ${
            isSettlement ? 'border-emerald-500 bg-emerald-950/90 text-emerald-300' : 'border-yellow-500 bg-yellow-950/90 text-yellow-300'
          } text-[9px] font-mono font-bold shadow-solid-sm whitespace-nowrap">
            ${isSettlement ? '🏘' : '⚡'} ${asset.name}
          </div>
        `;

        const assetIcon = L.divIcon({
          html: assetMarkerHtml,
          className: 'asset-badge-icon',
          iconSize: [120, 20],
          iconAnchor: [60, 10]
        });

        const assetMarker = L.marker([asset.latitude, asset.longitude], { icon: assetIcon });
        layerGroup.addLayer(assetMarker);
      });
    }
  }, [frame, facility, showRawDetections, showFacilityPolygon, showSegmentationMask, showPlumeCorridor, showAssets, firmsHotspots, selectedHotspotIndex]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([frame.fusedEvent.latitude, frame.fusedEvent.longitude], firmsHotspots && firmsHotspots.length > 0 ? 11 : 13);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-background-subtle border border-border overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Active Coordinates / FIRMS Info */}
      <div className="absolute top-3 left-3 z-[1000] bg-background/90 border border-border px-3 py-1.5 shadow-solid-sm backdrop-blur-sm text-xs font-mono">
        <div className="flex items-center gap-3">
          {firmsHotspots && firmsHotspots.length > 0 ? (
            <>
              <span className="text-amber-400 font-bold">NASA FIRMS ACTIVE FEED:</span>
              <span className="text-zinc-200">{firmsHotspots.length} HOTSPOTS</span>
              <span className="text-zinc-600">|</span>
              <span className="text-cyan-300 font-tabular">
                SELECTED: #{selectedHotspotIndex !== undefined ? selectedHotspotIndex + 1 : 1}
              </span>
            </>
          ) : (
            <>
              <span className="text-zinc-400">CENTROID:</span>
              <span className="text-cyan-300 font-bold font-tabular">
                {frame.fusedEvent.latitude.toFixed(4)}°N, {frame.fusedEvent.longitude.toFixed(4)}°E
              </span>
            </>
          )}

          <button
            onClick={recenterMap}
            title="Recenter Map"
            className="ml-2 px-1.5 py-0.5 bg-background-card hover:bg-zinc-800 border border-border text-zinc-300 hover:text-cyan-300 text-[10px] flex items-center gap-1 transition-colors"
          >
            <Crosshair className="w-3 h-3" />
            RECENTER
          </button>
        </div>
      </div>

      {/* Top Right: Layer Switcher */}
      <div className="absolute top-3 right-3 z-[1000] bg-background/95 border border-border p-2 shadow-solid-sm backdrop-blur-sm text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 border-b border-border pb-1 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          MAP LAYERS
        </div>

        <div className="space-y-1 text-[11px]">
          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showRawDetections}
              onChange={(e) => setShowRawDetections(e.target.checked)}
              className="accent-amber-500 rounded-none w-3.5 h-3.5"
            />
            <span>Hotspots</span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showFacilityPolygon}
              onChange={(e) => setShowFacilityPolygon(e.target.checked)}
              className="accent-cyan-500 rounded-none w-3.5 h-3.5"
            />
            <span>Facility Boundaries</span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showPlumeCorridor}
              onChange={(e) => setShowPlumeCorridor(e.target.checked)}
              className="accent-purple-500 rounded-none w-3.5 h-3.5"
            />
            <span>Plume Corridors</span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showSegmentationMask}
              onChange={(e) => setShowSegmentationMask(e.target.checked)}
              className="accent-rose-500 rounded-none w-3.5 h-3.5"
            />
            <span>Burn / Smoke Masks</span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showAssets}
              onChange={(e) => setShowAssets(e.target.checked)}
              className="accent-emerald-500 rounded-none w-3.5 h-3.5"
            />
            <span>Assets & Settlements</span>
          </label>
        </div>
      </div>
    </div>
  );
};
