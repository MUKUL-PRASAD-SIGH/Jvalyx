import { FiresProvider, useFires, useFiresDispatch, useVisibleDetections } from './state/store';
import { X, Flame, Sparkles } from 'lucide-react';
import { FireMap } from './map/FireMap';
import { TopBar } from './components/TopBar';
import { HamburgerNav } from './components/HamburgerNav';
import { MapControls } from './components/MapControls';
import { MainMapMenu } from './components/MainMapMenu';
import { BasicModePanel, AdvancedModePanel } from './components/LayerPanel';
import { BottomToolbar } from './components/BottomToolbar';
import { TimelineScrubber } from './components/TimelineScrubber';
import { AttributeTable } from './components/AttributeTable';
import { LegendPanel } from './components/LegendPanel';
import { DetectionCard } from './components/DetectionCard';
import { DataStatusChip } from './components/DataStatusChip';
import { HotspotAnalysis } from './components/HotspotAnalysis';

function BurnedAreaPanel() {
  const visible = useVisibleDetections();
  const dispatch = useFiresDispatch();

  // Estimate cumulative thermal burn footprint from visible pixels
  const totalBurnAreaSqKm = visible.reduce((acc, d) => {
    const pixelArea = (d.scan || 0.38) * (d.track || 0.38);
    return acc + pixelArea;
  }, 0);

  const severeFires = visible.filter((d) => d.frp >= 50);

  return (
    <div className="w-[330px] rounded-lg border border-white/15 bg-[#0b0f14] p-3.5 text-xs text-white shadow-2xl">
      <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-orange-400">
          <Flame className="h-4 w-4" />
          <span>Burn Footprint Analysis</span>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'setPanelMode', mode: null })}
          className="rounded p-1 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5 text-white/60" />
        </button>
      </div>

      <div className="space-y-2 font-mono text-[11px]">
        <div className="flex items-center justify-between rounded bg-white/5 px-2.5 py-1.5">
          <span className="text-white/60">Active Thermal Hotspots:</span>
          <span className="font-bold text-amber-300">{visible.length.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between rounded bg-white/5 px-2.5 py-1.5">
          <span className="text-white/60">Estimated Burn Footprint:</span>
          <span className="font-bold text-orange-300">~{totalBurnAreaSqKm.toFixed(1)} km²</span>
        </div>
        <div className="flex items-center justify-between rounded bg-white/5 px-2.5 py-1.5">
          <span className="text-white/60">High-Severity Fronts (&gt;50 MW):</span>
          <span className="font-bold text-rose-400">{severeFires.length.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => dispatch({ type: 'setColorMode', mode: 'frp' })}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-orange-600/80 px-2 py-1.5 font-sans text-[11px] font-semibold hover:bg-orange-600 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Color by FRP
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'openTable' })}
          className="flex-1 flex items-center justify-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1.5 font-sans text-[11px] font-semibold hover:bg-white/10 transition-colors"
        >
          Inspect Table
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { panelMode, activeTool, dataStatus } = useFires();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#08131b] font-sans text-white">
      <TopBar />

      <div className="relative flex-1">
        <FireMap />
        <MapControls />
        <DataStatusChip />
        <LegendPanel />
        <DetectionCard />

        <div className="absolute right-3 top-16 z-[1000] flex flex-col items-end gap-2">
          {panelMode === 'menu' && <MainMapMenu />}
          {panelMode === 'basic' && <BasicModePanel />}
          {panelMode === 'advanced' && <AdvancedModePanel />}
          {panelMode === 'burned-area' && <BurnedAreaPanel />}
        </div>

        {dataStatus.source === 'loading' && (
          <div className="absolute left-1/2 top-1/2 z-[900] -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur">
            Loading active fire data…
          </div>
        )}

        {activeTool === 'measure' && (
          <div className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-[11px] text-white/80">
            Click to add points · right-click to finish · Esc to clear
          </div>
        )}

        <BottomToolbar />
        {activeTool === 'timeline' && <TimelineScrubber />}
        <AttributeTable />
      </div>

      <HamburgerNav />
      <HotspotAnalysis />
    </div>
  );
}

export function FiresApp() {
  return (
    <FiresProvider>
      <Shell />
    </FiresProvider>
  );
}
