import { useEffect } from 'react';
import { Ruler, MapPin, Layers3, SlidersHorizontal, Camera, Share2, HelpCircle, Monitor, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import type { ToolId } from '../types';
import { mapBus } from '../map/mapBus';
import { cn } from './ui';

const TOOLS: { id: ToolId; label: string; icon: LucideIcon }[] = [
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'layers', label: 'Layers', icon: Layers3 },
  { id: 'timeline', label: 'Timeline', icon: SlidersHorizontal },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'help', label: 'Help', icon: HelpCircle },
  { id: 'viewmode', label: 'View Mode', icon: Monitor },
];

export function BottomToolbar() {
  const { activeTool, panelMode } = useFires();
  const dispatch = useFiresDispatch();

  useEffect(() => {
    mapBus.emit('toggleMeasure', activeTool === 'measure');
  }, [activeTool]);

  const handle = (id: ToolId) => {
    switch (id) {
      case 'layers':
        dispatch({ type: 'setPanelMode', mode: panelMode ? null : 'basic' });
        return;
      case 'capture':
        mapBus.emit('capture', undefined);
        return;
      case 'location':
        mapBus.emit('geolocate', undefined);
        dispatch({ type: 'setTool', tool: 'location' });
        return;
      case 'share': {
        const url = window.location.href;
        navigator.clipboard?.writeText(url).catch(() => undefined);
        dispatch({ type: 'setTool', tool: 'share' });
        return;
      }
      default:
        dispatch({ type: 'setTool', tool: id });
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-[1000] -translate-x-1/2">
      <div className="flex items-stretch gap-0.5 rounded-lg border border-white/10 bg-[#0b0f14]/95 p-1 shadow-2xl backdrop-blur">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handle(t.id)}
            className={cn(
              'flex w-[68px] flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors',
              activeTool === t.id || (t.id === 'layers' && panelMode)
                ? 'bg-orange-500 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: 'setTool', tool: null })}
          className="grid w-8 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
