import { Flame } from 'lucide-react';
import { FiresProvider, useFires } from './state/store';
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
  return (
    <div className="w-[330px] rounded-lg border border-white/10 bg-[#0b0f14] p-4 text-sm text-white/60 shadow-2xl">
      <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-widest text-orange-300">
        <Flame className="h-4 w-4" /> Burned Area
      </div>
      Monthly MODIS / VIIRS burned-area mosaics for India are not wired in this build.
      Active-fire hotspots remain the primary layer.
    </div>
  );
}

function Shell() {
  const { panelMode, activeTool, dataStatus } = useFires();

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#08131b] font-sans text-white">
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
