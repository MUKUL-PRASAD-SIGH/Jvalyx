import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { ScenarioFrame, FacilityDigitalTwin } from '../types';
import type { FIRMSRecord } from '../services/firms';
import { Layers, Crosshair, Navigation, Compass } from 'lucide-react';

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
  onSelectHotspot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  // Basemap type: Satellite imagery vs Dark tactical
  const [basemapType, setBasemapType] = useState<'satellite' | 'dark'>('satellite');

  // Layer Visibility States
  const [showRawDetections, setShowRawDetections] = useState(true);
  const [showFacilityPolygon, setShowFacilityPolygon] = useState(true);
  const [showSegmentationMask, setShowSegmentationMask] = useState(true);
  const [showPlumeCorridor, setShowPlumeCorridor] = useState(true);
  const [showAssets, setShowAssets] = useState(true);

  // Switch basemap tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (basemapLayerRef.current) map.removeLayer(basemapLayerRef.current);
    if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

    if (basemapType === 'satellite') {
      const tile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
          maxZoom: 18,
        }
      ).addTo(map);
      basemapLayerRef.current = tile;

      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18, opacity: 0.85 }
      ).addTo(map);
      labelsLayerRef.current = labels;
    } else {
      const cartoKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
      const darkUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

      const tile = L.tileLayer(darkUrl, {
        attribution: cartoKey
          ? '&copy; CARTO | NASA FIRMS & SIH 2026'
          : 'Tiles &copy; Esri &mdash; DeLorme, NAVTEQ',
        maxZoom: 19,
        subdomains: cartoKey ? 'abcd' : [],
      }).addTo(map);
      basemapLayerRef.current = tile;
    }
  }, [basemapType]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [frame.fusedEvent.latitude, frame.fusedEvent.longitude],
        zoom: firmsHotspots && firmsHotspots.length > 0 ? 6 : 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Default satellite tiles
      const satTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map);
      basemapLayerRef.current = satTile;

      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18, opacity: 0.85 }
      ).addTo(map);
      labelsLayerRef.current = labels;

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }
  }, []);

  // Update Map Overlays when frame or layer toggles change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // If viewing Live NASA FIRMS hotspots
    if (firmsHotspots && firmsHotspots.length > 0) {
      firmsHotspots.forEach((spot, idx) => {
        const isSelected = idx === selectedHotspotIndex;
        const radius = Math.min(22, Math.max(10, Math.sqrt(spot.frp) * 2.0));

        const iconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer">
            ${isSelected ? '<div class="absolute w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping"></div>' : ''}
            <div style="width: ${Math.round(radius)}px; height: ${Math.round(radius)}px" class="rounded-sm border ${
              isSelected ? 'border-cyan-300 bg-cyan-500 text-black font-black' : spot.frp > 80 ? 'border-rose-400 bg-rose-600 text-white' : 'border-amber-400 bg-amber-500 text-black'
            } text-[9px] font-mono font-bold shadow-md flex items-center justify-center">
              ${spot.frp.toFixed(0)}M
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'firms-marker-pin',
          iconSize: [28, 20],
          iconAnchor: [14, 10],
        });

        const marker = L.marker([spot.latitude, spot.longitude], { icon });

        marker.on('click', () => {
          if (onSelectHotspot) onSelectHotspot(idx);
          map.setView([spot.latitude, spot.longitude], Math.max(map.getZoom(), 12));
        });

        marker.bindTooltip(
          `<div class="font-mono text-xs font-bold text-zinc-100">Hotspot #${idx + 1}</div>
           <div class="font-mono text-[10px] text-amber-300">FRP: ${spot.frp.toFixed(1)} MW</div>`,
          { permanent: false, direction: 'top' }
        );

        layerGroup.addLayer(marker);
      });

      return;
    }

    // Standard Scenario Rendering
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
        color: '#64748b',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#475569',
        fillOpacity: 0.1,
      });

      facilityPolygon.bindTooltip(
        `<div class="font-mono text-xs font-bold text-zinc-200">${facility.name}</div>
         <div class="text-[10px] text-zinc-400 font-mono">Facility Perimeter</div>`,
        { permanent: false, direction: 'top' }
      );

      layerGroup.addLayer(facilityPolygon);
    }

    // 2. Probabilistic Plume Corridor (50% core and 90% dispersion cone)
    if (showPlumeCorridor && frame.tactical?.plumeCorridor) {
      const { cone90, cone50, centerline, windSpeedMps, windDirectionDeg } = frame.tactical.plumeCorridor;

      // 90% outer envelope
      const poly90 = L.polygon(cone90, {
        color: '#c084fc',
        weight: 1.5,
        dashArray: '4, 6',
        fillColor: '#a855f7',
        fillOpacity: 0.22,
      });

      poly90.bindTooltip(
        `<div class="font-mono text-xs font-bold text-purple-200">Downwind Dispersion Envelope (90%)</div>
         <div class="font-mono text-[10px] text-zinc-300">Wind: ${windSpeedMps.toFixed(1)} m/s @ ${windDirectionDeg.toFixed(0)}°</div>`,
        { permanent: false, direction: 'right' }
      );
      layerGroup.addLayer(poly90);

      // 50% core hazard cone
      const poly50 = L.polygon(cone50, {
        color: '#e9d5ff',
        weight: 1.8,
        fillColor: '#9333ea',
        fillOpacity: 0.38,
      });
      layerGroup.addLayer(poly50);

      // Trajectory centerline
      const line = L.polyline(centerline, {
        color: '#ffffff',
        weight: 2,
        dashArray: '3, 4',
        opacity: 0.9,
      });
      layerGroup.addLayer(line);
    }

    // 3. Tactical Segmentation Mask (Active Burn Perimeter)
    if (showSegmentationMask && frame.tactical?.segmentationMask) {
      const mask = frame.tactical.segmentationMask;
      const maskPolygon = L.polygon(mask.coordinates[0] as [number, number][], {
        color: '#ff3b3b',
        weight: 2.2,
        fillColor: '#e11d48',
        fillOpacity: 0.45,
      });
      maskPolygon.bindTooltip(
        `<div class="font-mono text-xs font-bold text-rose-200">Active Thermal Front</div>
         <div class="font-mono text-[10px] text-zinc-300">Segmentation Mask</div>`,
        { permanent: false }
      );
      layerGroup.addLayer(maskPolygon);
    }

    // 4. Raw Sensor Thermal Detections
    if (showRawDetections && frame.fusedEvent.detections) {
      frame.fusedEvent.detections.forEach((det, idx) => {
        const markerHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 border border-zinc-100 ${
              det.sensor === 'VIIRS' ? 'bg-amber-500' : 'bg-rose-500'
            } shadow-sm flex items-center justify-center text-[8px] font-mono font-black text-black">
              ${det.sensor[0]}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-thermal-pin',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([det.latitude, det.longitude], { icon: customIcon });

        marker.bindPopup(
          `<div class="p-2 font-mono text-xs bg-zinc-950 text-zinc-100 border border-zinc-700">
             <div class="font-bold text-amber-400 border-b border-zinc-700 pb-1 mb-1">DETECTION #${idx + 1} (${det.sensor})</div>
             <div>FRP: <span class="text-rose-400 font-bold">${det.frp_mw.toFixed(1)} MW</span></div>
             <div>Temp (TI4): ${det.bright_ti4_k.toFixed(1)} K</div>
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
        <div class="w-5 h-5 border-2 border-white/90 bg-zinc-950/90 flex items-center justify-center shadow-md">
          <div class="w-1.5 h-1.5 bg-white"></div>
        </div>
      </div>
    `;
    const fusedIcon = L.divIcon({
      html: fusedIconHtml,
      className: 'fused-centroid-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const fusedMarker = L.marker([fusedLat, fusedLon], { icon: fusedIcon });
    layerGroup.addLayer(fusedMarker);

    // 6. Critical Assets with Threat Proximity
    if (showAssets && facility.nearbyAssets) {
      facility.nearbyAssets.forEach((asset) => {
        const isSettlement = asset.type === 'settlement';
        const distKm = (asset.distance_m / 1000).toFixed(1);

        const assetMarkerHtml = `
          <div class="px-2 py-0.5 border border-white/20 bg-black/85 text-zinc-300 text-[9px] font-mono font-medium shadow-md whitespace-nowrap backdrop-blur">
            <span class="text-zinc-500">[${isSettlement ? 'SETTLEMENT' : 'INFRA'}]</span> ${asset.name} (${distKm} km)
          </div>
        `;

        const assetIcon = L.divIcon({
          html: assetMarkerHtml,
          className: 'asset-badge-icon',
          iconSize: [130, 20],
          iconAnchor: [65, 10],
        });

        const assetMarker = L.marker([asset.latitude, asset.longitude], { icon: assetIcon });
        layerGroup.addLayer(assetMarker);
      });
    }
  }, [
    frame,
    facility,
    showRawDetections,
    showFacilityPolygon,
    showSegmentationMask,
    showPlumeCorridor,
    showAssets,
    firmsHotspots,
    selectedHotspotIndex,
  ]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [frame.fusedEvent.latitude, frame.fusedEvent.longitude],
        firmsHotspots && firmsHotspots.length > 0 ? 11 : 13
      );
    }
  };

  const plume = frame.tactical?.plumeCorridor;
  const windDir = plume?.windDirectionDeg ?? 135;
  const windSpd = plume?.windSpeedMps ?? 6.5;

  return (
    <div className="relative w-full h-full min-h-[460px] bg-background-subtle border border-border overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Coordinates & Recenter */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-[#0b0f14]/90 border border-white/10 px-3 py-1.5 shadow-lg backdrop-blur text-xs font-mono">
        <span className="text-zinc-400">CENTROID:</span>
        <span className="text-zinc-100 font-semibold">
          {frame.fusedEvent.latitude.toFixed(4)}°N, {frame.fusedEvent.longitude.toFixed(4)}°E
        </span>
        <button
          onClick={recenterMap}
          title="Recenter Map"
          className="ml-2 px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-300 hover:text-white text-[10px] flex items-center gap-1 transition-colors"
        >
          <Crosshair className="w-3 h-3" />
          RECENTER
        </button>
      </div>

      {/* Top Center: Wind Vector & Downwind Heading */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2.5 bg-[#0b0f14]/95 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] px-3.5 py-1.5 backdrop-blur text-xs font-mono">
        <div className="flex items-center gap-1.5 text-purple-300 font-medium">
          <Compass className="w-3.5 h-3.5 text-purple-400" />
          <span>WIND VECTOR:</span>
        </div>
        <div className="flex items-center gap-1.5 text-purple-200">
          <Navigation
            className="w-3.5 h-3.5 text-purple-400 transition-transform duration-500"
            style={{ transform: `rotate(${windDir}deg)` }}
          />
          <span className="font-tabular font-bold text-white">{windSpd.toFixed(1)} m/s</span>
          <span className="text-purple-400/80 font-bold">@</span>
          <span className="font-tabular font-bold text-purple-200">{windDir.toFixed(0)}°</span>
        </div>
      </div>

      {/* Top Right: Basemap Selector & Layer Toggles */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Basemap Toggle */}
        <div className="flex overflow-hidden rounded border border-white/10 bg-[#0b0f14]/90 shadow-lg backdrop-blur text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setBasemapType('satellite')}
            className={`px-3 py-1 transition-colors ${
              basemapType === 'satellite'
                ? 'bg-zinc-700 text-white font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setBasemapType('dark')}
            className={`px-3 py-1 transition-colors ${
              basemapType === 'dark'
                ? 'bg-zinc-700 text-white font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Dark Map
          </button>
        </div>

        {/* Map Overlays Dropdown */}
        <div className="bg-[#0b0f14]/90 border border-white/10 p-2 shadow-lg backdrop-blur text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/10 pb-1 mb-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Map Overlays</span>
          </div>

          <div className="space-y-1 text-[11px]">
            <label className="flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showFacilityPolygon}
                onChange={(e) => setShowFacilityPolygon(e.target.checked)}
                className="accent-zinc-400 h-3 w-3"
              />
              <span>Facility Boundary</span>
            </label>

            <label className="flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPlumeCorridor}
                onChange={(e) => setShowPlumeCorridor(e.target.checked)}
                className="accent-purple-500 h-3 w-3"
              />
              <span className="text-purple-300">Plume Corridor</span>
            </label>

            <label className="flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSegmentationMask}
                onChange={(e) => setShowSegmentationMask(e.target.checked)}
                className="accent-rose-500 h-3 w-3"
              />
              <span className="text-rose-300">Burn Perimeter</span>
            </label>

            <label className="flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showRawDetections}
                onChange={(e) => setShowRawDetections(e.target.checked)}
                className="accent-amber-400 h-3 w-3"
              />
              <span>Sensor Hotspots</span>
            </label>

            <label className="flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAssets}
                onChange={(e) => setShowAssets(e.target.checked)}
                className="accent-zinc-400 h-3 w-3"
              />
              <span>Nearby Assets</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Left: Tactical Mini Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3 bg-[#0b0f14]/95 border border-white/10 px-3 py-1.5 shadow-lg backdrop-blur text-[10px] font-mono text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" />
          <span>Perimeter</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-purple-500/40 border border-purple-400" />
          <span className="text-purple-300 font-medium">Plume Cone</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-rose-500/40 border border-rose-500" />
          <span className="text-rose-300 font-medium">Thermal Front</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 border border-white bg-white" />
          <span>Centroid</span>
        </span>
      </div>
    </div>
  );
};
