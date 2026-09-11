import {
  Settings,
  Settings2,
  Flame,
  MapPinned,
  Wind,
  Bell,
  Download,
  GraduationCap,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import type { PanelMode } from '../types';
import { mapBus } from '../map/mapBus';
import { cn } from './ui';

interface Tile {
  id: string;
  label: string;
  icon: LucideIcon;
  mode?: PanelMode;
}

const TILES: Tile[] = [
  { id: 'basic', label: 'Basic Layers', icon: Settings, mode: 'basic' },
  { id: 'advanced', label: 'Advanced Layers', icon: Settings2, mode: 'advanced' },
  { id: 'burned', label: 'Burn Footprint', icon: Flame, mode: 'burned-area' },
  { id: 'alerts', label: 'Fire Alerts', icon: Bell },
  { id: 'downloads', label: 'Data & CSV', icon: Download },
  { id: 'smoke', label: 'Dynamic Imagery', icon: Wind },
  { id: 'india', label: 'Recenter India', icon: MapPinned },
];

export function MainMapMenu() {
  const { panelMode } = useFires();
  const dispatch = useFiresDispatch();

  const handleTileClick = (tile: Tile) => {
    if (tile.mode) {
      dispatch({ type: 'setPanelMode', mode: tile.mode });
      return;
    }
    switch (tile.id) {
      case 'downloads':
        dispatch({ type: 'openTable' });
        dispatch({ type: 'setPanelMode', mode: null });
        break;
      case 'alerts':
        dispatch({ type: 'setColorMode', mode: 'frp' });
        dispatch({ type: 'setPanelMode', mode: 'basic' });
        break;
      case 'smoke':
        dispatch({ type: 'toggleGibs', id: 'viirs-truecolor' });
        dispatch({ type: 'setPanelMode', mode: 'basic' });
        break;
      case 'india':
        mapBus.emit('fitIndia');
        dispatch({ type: 'setPanelMode', mode: null });
        break;
    }
  };

  return (
    <div className="w-[300px] overflow-hidden rounded-lg border border-white/10 bg-[#0b0f14] shadow-2xl">
      <div className="flex items-center justify-between bg-[#12303a] px-3 py-2 text-emerald-300">
        <span className="text-sm font-black uppercase tracking-widest">Main Map Menu</span>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          <button type="button" onClick={() => dispatch({ type: 'setPanelMode', mode: null })}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {TILES.map((tile) => {
          const active = tile.mode && panelMode === tile.mode;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileClick(tile)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border p-2 text-center text-[10px] font-bold uppercase leading-tight transition-colors',
                active
                  ? 'border-emerald-400 bg-emerald-500 text-emerald-950'
                  : 'border-white/10 bg-[#1c2530] text-white/80 hover:border-white/25 hover:bg-[#232e3b]',
              )}
            >
              <tile.icon className="h-5 w-5" />
              {tile.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
