import { Plus, Minus, LocateFixed, Maximize } from 'lucide-react';
import { mapBus } from '../map/mapBus';

export function MapControls() {
  return (
    <div className="absolute left-3 top-16 z-[1000] flex flex-col gap-2">
      <div className="overflow-hidden rounded border border-white/15 bg-[#0e1218]/95 shadow-lg">
        <button
          type="button"
          onClick={() => mapBus.emit('zoomIn', undefined)}
          className="grid h-8 w-8 place-items-center text-white/80 hover:bg-white/10"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-white/10" />
        <button
          type="button"
          onClick={() => mapBus.emit('zoomOut', undefined)}
          className="grid h-8 w-8 place-items-center text-white/80 hover:bg-white/10"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => mapBus.emit('geolocate', undefined)}
        className="grid h-8 w-8 place-items-center rounded border border-white/15 bg-[#0e1218]/95 text-white/80 shadow-lg hover:bg-white/10"
        aria-label="Locate me"
      >
        <LocateFixed className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => mapBus.emit('fitIndia', undefined)}
        className="grid h-8 w-8 place-items-center rounded border border-white/15 bg-[#0e1218]/95 text-white/80 shadow-lg hover:bg-white/10"
        aria-label="Fit India"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
}
