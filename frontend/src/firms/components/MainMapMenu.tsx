import {
  Settings,
  Settings2,
  Flame,
  MapPinned,
  Wind,
  FlaskConical,
  Bell,
  Download,
  GraduationCap,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import type { PanelMode } from '../types';
import { cn } from './ui';

interface Tile {
  id: string;
  label: string;
  icon: LucideIcon;
  mode?: PanelMode;
  soon?: boolean;
}

const TILES: Tile[] = [
  { id: 'basic', label: 'Basic Mode', icon: Settings, mode: 'basic' },
  { id: 'advanced', label: 'Advanced Mode', icon: Settings2, mode: 'advanced' },
  { id: 'burned', label: 'Burned Area', icon: Flame, mode: 'burned-area' },
  { id: 'uscanada', label: 'US / Canada', icon: MapPinned, soon: true },
  { id: 'smoke', label: 'Smoke / Aerosols', icon: Wind, soon: true },
  { id: 'experimental', label: 'Experimental', icon: FlaskConical, soon: true },
  { id: 'alerts', label: 'Fire Alerts', icon: Bell, soon: true },
  { id: 'downloads', label: 'Downloads', icon: Download, soon: true },
];

export function MainMapMenu() {
  const { panelMode } = useFires();
  const dispatch = useFiresDispatch();

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
              disabled={tile.soon}
              onClick={() => tile.mode && dispatch({ type: 'setPanelMode', mode: tile.mode })}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border p-2 text-center text-[10px] font-bold uppercase leading-tight transition-colors',
                active
                  ? 'border-emerald-400 bg-emerald-500 text-emerald-950'
                  : 'border-white/10 bg-[#1c2530] text-white/80 hover:border-white/25 hover:bg-[#232e3b]',
                tile.soon && 'cursor-not-allowed opacity-45',
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
