import { useState } from 'react';
import { Menu, Search, Megaphone, MessageSquareText, Flame } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { QuickSearch } from './QuickSearch';

export function TopBar() {
  const { timeRange, dataStatus } = useFires();
  const dispatch = useFiresDispatch();
  const [searchOpen, setSearchOpen] = useState(false);

  const windowLabel =
    timeRange.window === '24h'
      ? '24 HOURS'
      : timeRange.window === '48h'
        ? '48 HOURS'
        : timeRange.window === '7d'
          ? 'WEEK'
          : 'CUSTOM';
  const dateLabel = timeRange.end.toISOString().slice(0, 10);

  return (
    <header className="relative z-[1200] flex h-12 items-center justify-between bg-gradient-to-r from-[#8a0f2e] via-[#a11540] to-[#7a0c28] px-3 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch({ type: 'toggleHamburger' })}
          className="grid h-8 w-8 place-items-center rounded hover:bg-white/15"
          aria-label="Site menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/95">
            <Flame className="h-5 w-5 text-[#a11540]" />
          </span>
          <div className="leading-tight">
            <div className="text-lg font-black tracking-wider">JVALYX · FIRMS</div>
            <div className="hidden text-[10px] font-medium uppercase tracking-[0.15em] text-white/70 sm:block">
              India Fire Information · Resource Management
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full hidden -translate-x-1/2 items-center gap-4 rounded-b bg-black/55 px-3 py-1 font-mono text-[11px] text-white/80 backdrop-blur md:flex">
        <HoverReadout />
        <span className="text-white/40">|</span>
        <span>
          FIRES: {dateLabel} ({windowLabel})
        </span>
        <span className="text-white/40">|</span>
        <span
          className={
            dataStatus.source === 'live'
              ? 'text-emerald-300'
              : dataStatus.source === 'error'
                ? 'text-rose-300'
                : 'text-amber-300'
          }
        >
          {dataStatus.source === 'live'
            ? 'LIVE NRT'
            : dataStatus.source === 'bundled'
              ? 'DATASET'
              : dataStatus.source === 'synthetic'
                ? 'SYNTHETIC'
                : dataStatus.source === 'loading'
                  ? 'LOADING…'
                  : 'FEED ERROR'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-white/15"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
            <Search className="h-3.5 w-3.5" />
          </span>
          <span className="hidden lg:inline">Quick Search</span>
        </button>
        <button type="button" className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-white/15 lg:flex">
          <Megaphone className="h-4 w-4 text-amber-300" />
          <span>Announcements</span>
        </button>
        <button type="button" className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-white/15 lg:flex">
          <MessageSquareText className="h-4 w-4" />
          <span>Feedback</span>
        </button>
      </div>

      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </header>
  );
}

function HoverReadout() {
  const { hoveredCoord } = useFires();
  if (!hoveredCoord) return <span>Lat: —, Lon: —</span>;
  return (
    <span>
      Lat: {hoveredCoord.lat.toFixed(3)}°, Lon: {hoveredCoord.lon.toFixed(3)}°
    </span>
  );
}
