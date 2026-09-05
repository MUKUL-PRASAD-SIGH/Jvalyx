import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { ScenarioFrame, FacilityDigitalTwin } from '../types';
import { Layers, Crosshair } from 'lucide-react';

interface TacticalMapProps {
  frame: ScenarioFrame;
  facility: FacilityDigitalTwin;
  isSimulated?: boolean;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  frame,
  facility
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
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });

      // Dark Matter Basemap Tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> | SIH 2026 Jvalyx',
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map persistent across frame renders
    };
  }, []);

  // Update Map Elements when frame or layer toggles change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Pan smoothly if center changed significantly
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
        { permanent: false, direction: 'top', className: 'custom-map-tooltip' }
      );

      layerGroup.addLayer(facilityPolygon);
    }

    // 2. Probabilistic Plume Corridor (50% and 90% envelopes)
    if (showPlumeCorridor && frame.tactical?.plumeCorridor) {
      const { cone90, cone50, centerline, windSpeedMps, windDirectionDeg } = frame.tactical.plumeCorridor;

      // 90% Outer Envelope (Wider, lighter opacity)
      const poly90 = L.polygon(cone90, {
        color: '#c084fc',
        weight: 1.2,
        dashArray: '3, 5',
        fillColor: '#a855f7',
        fillOpacity: 0.18
      });

      poly90.bindTooltip(
        `<div class="font-mono text-xs font-bold text-purple-300">Downwind Probability Corridor (90%)</div>
         <div class="font-mono text-[10px] text-zinc-300">Wind: ${windSpeedMps} m/s @ ${windDirectionDeg}° (Monte Carlo Envelope)</div>`,
        { permanent: false, direction: 'right' }
      );
      layerGroup.addLayer(poly90);

      // 50% Core Dispersion Envelope (Narrower, denser opacity)
      const poly50 = L.polygon(cone50, {
        color: '#d8b4fe',
        weight: 1.5,
        fillColor: '#9333ea',
        fillOpacity: 0.32
      });

      poly50.bindTooltip(
        `<div class="font-mono text-xs font-bold text-purple-200">High-Density Plume Envelope (50%)</div>`,
        { permanent: false, direction: 'right' }
      );
      layerGroup.addLayer(poly50);

      // Centerline
      const line = L.polyline(centerline, {
        color: '#f3e8ff',
        weight: 1.5,
        dashArray: '2, 3',
        opacity: 0.8
      });
      layerGroup.addLayer(line);
    }

    // 3. Tactical Segmentation Mask (Burn & Smoke area)
    if (showSegmentationMask && frame.tactical?.segmentationMask) {
      const mask = frame.tactical.segmentationMask;
      const maskPolygon = L.polygon(mask.coordinates[0] as [number, number][], {
        color: '#f43f5e',
        weight: 2,
        fillColor: '#e11d48',
        fillOpacity: 0.45
      });

      maskPolygon.bindTooltip(
        `<div class="font-mono text-xs font-bold text-rose-300">Tactical Burn & Heat Mask</div>
         <div class="font-mono text-[10px] text-zinc-200">Burn Area: ${(mask.burnAreaM2 / 10000).toFixed(1)} ha (${mask.burnAreaM2.toLocaleString()} m²)</div>
         <div class="font-mono text-[10px] text-zinc-300">Smoke Perimeter: ${(mask.smokeAreaM2 / 10000).toFixed(1)} ha</div>`,
        { permanent: false, direction: 'top' }
      );
      layerGroup.addLayer(maskPolygon);
    }

    // 4. Raw Sensor Detections
    if (showRawDetections && frame.fusedEvent.detections) {
      frame.fusedEvent.detections.forEach((det, idx) => {
        const radius = Math.min(24, Math.max(8, Math.sqrt(det.frp_mw) * 2.2));

        const markerHtml = `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-${Math.round(radius * 2)}px h-${Math.round(radius * 2)}px rounded-full bg-rose-600/30 animate-ping"></div>
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
             <div>Cloud Flag: <span class="${det.cloud_flag ? 'text-amber-400 font-bold' : 'text-zinc-400'}">${det.cloud_flag ? 'TRUE (Obstructed)' : 'CLEAR'}</span></div>
             <div class="text-[9px] text-zinc-500 mt-1">${det.timestamp}</div>
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
    fusedMarker.bindTooltip(
      `<div class="font-mono text-xs font-bold text-cyan-300">Fused Centroid (${frame.fusedEvent.event_id})</div>
       <div class="font-mono text-[10px] text-zinc-300">Active Hotspots: ${frame.fusedEvent.cluster_pixel_count} | FRP Z: ${frame.fusedEvent.facility_frp_zscore.toFixed(2)}σ</div>`,
      { permanent: false, direction: 'top' }
    );
    layerGroup.addLayer(fusedMarker);

    // 6. Critical Assets & Settlements
    if (showAssets && facility.nearbyAssets) {
      facility.nearbyAssets.forEach((asset) => {
        const isSettlement = asset.type === 'settlement';
        const assetMarkerHtml = `
          <div class="px-1.5 py-0.5 border ${
            isSettlement
              ? 'border-emerald-500 bg-emerald-950/90 text-emerald-300'
              : 'border-yellow-500 bg-yellow-950/90 text-yellow-300'
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

        assetMarker.bindTooltip(
          `<div class="font-mono text-xs font-bold text-zinc-100">${asset.name}</div>
           <div class="text-[10px] text-zinc-300 font-mono">Distance to Hazard: ${asset.distance_m} m</div>
           ${asset.population_at_risk ? `<div class="text-[10px] text-rose-300 font-mono">Population at Risk: ${asset.population_at_risk.toLocaleString()}</div>` : ''}`,
          { permanent: false, direction: 'top' }
        );

        layerGroup.addLayer(assetMarker);
      });
    }
  }, [frame, facility, showRawDetections, showFacilityPolygon, showSegmentationMask, showPlumeCorridor, showAssets]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([frame.fusedEvent.latitude, frame.fusedEvent.longitude], 13);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-background-subtle border border-border overflow-hidden select-none">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Active Event Coordinates Bar */}
      <div className="absolute top-3 left-3 z-[1000] bg-background/90 border border-border px-3 py-1.5 shadow-solid-sm backdrop-blur-sm text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">CENTROID:</span>
          <span className="text-cyan-300 font-bold font-tabular">
            {frame.fusedEvent.latitude.toFixed(4)}°N, {frame.fusedEvent.longitude.toFixed(4)}°E
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">CLUSTER PIXELS:</span>
          <span className="text-amber-400 font-bold font-tabular">
            {frame.fusedEvent.cluster_pixel_count}
          </span>
          <button
            onClick={recenterMap}
            title="Recenter Map to Centroid"
            className="ml-2 px-1.5 py-0.5 bg-background-card hover:bg-zinc-800 border border-border text-zinc-300 hover:text-cyan-300 text-[10px] flex items-center gap-1 transition-colors"
          >
            <Crosshair className="w-3 h-3" />
            RECENTER
          </button>
        </div>
      </div>

      {/* Top Right: Layer Switcher & Visibility Controls */}
      <div className="absolute top-3 right-3 z-[1000] bg-background/95 border border-border p-2 shadow-solid-sm backdrop-blur-sm text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 border-b border-border pb-1 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          MAP INTELLIGENCE LAYERS
        </div>

        <div className="space-y-1 text-[11px]">
          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showRawDetections}
              onChange={(e) => setShowRawDetections(e.target.checked)}
              className="accent-amber-500 rounded-none w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-500 inline-block"></span> Raw Hotspots ({frame.fusedEvent.detections.length})
            </span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showFacilityPolygon}
              onChange={(e) => setShowFacilityPolygon(e.target.checked)}
              className="accent-cyan-500 rounded-none w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 border border-white inline-block"></span> Facility Boundary
            </span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showSegmentationMask}
              onChange={(e) => setShowSegmentationMask(e.target.checked)}
              className="accent-rose-500 rounded-none w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-rose-600 inline-block"></span> Tactical Burn Mask
            </span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showPlumeCorridor}
              onChange={(e) => setShowPlumeCorridor(e.target.checked)}
              className="accent-purple-500 rounded-none w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-600 inline-block"></span> Plume Corridor (50/90%)
            </span>
          </label>

          <label className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={showAssets}
              onChange={(e) => setShowAssets(e.target.checked)}
              className="accent-emerald-500 rounded-none w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-600 inline-block"></span> Assets & Settlements
            </span>
          </label>
        </div>
      </div>

      {/* Bottom Left: Tactical Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 border border-border px-3 py-2 shadow-solid-sm backdrop-blur-sm text-[10px] font-mono text-zinc-300">
        <div className="font-bold text-zinc-400 mb-1 tracking-wider">GEOSPATIAL LEGEND</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500 border border-black inline-block"></span>
            <span>VIIRS (375m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-orange-600 border border-black inline-block"></span>
            <span>MODIS (1km)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-rose-600/70 border border-rose-400 inline-block"></span>
            <span>Burn Core</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-purple-600/50 border border-purple-400 inline-block"></span>
            <span>Plume Envelope</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 border border-white border-dashed inline-block"></span>
            <span>Facility Twin</span>
          </div>
        </div>
      </div>
    </div>
  );
};
