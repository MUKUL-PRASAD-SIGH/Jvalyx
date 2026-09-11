import { useState } from 'react';
import { Menu, Search, Megaphone, MessageSquareText, Flame, X, Check, Send, Radio, Satellite } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { QuickSearch } from './QuickSearch';

export function TopBar() {
  const { timeRange, dataStatus } = useFires();
  const dispatch = useFiresDispatch();
  const [searchOpen, setSearchOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setAnnouncementsOpen(true)}
          className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-white/15 lg:flex"
        >
          <Megaphone className="h-4 w-4 text-amber-300" />
          <span>Announcements</span>
        </button>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-white/15 lg:flex"
        >
          <MessageSquareText className="h-4 w-4" />
          <span>Feedback</span>
        </button>
      </div>

      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
      {announcementsOpen && <AnnouncementsModal onClose={() => setAnnouncementsOpen(false)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
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

function AnnouncementsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 font-sans backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-white/15 bg-[#0b0f14] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#121b24] px-4 py-3">
          <div className="flex items-center gap-2 font-black tracking-wide text-amber-300">
            <Megaphone className="h-4 w-4" />
            <span>OPERATIONAL ANNOUNCEMENTS</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3.5 p-4 text-xs">
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Radio className="h-3.5 w-3.5" />
              <span>NASA FIRMS NRT Satellite Constellation Active</span>
            </div>
            <p className="mt-1 text-white/70 leading-relaxed">
              VIIRS NOAA-20, NOAA-21, S-NPP (375m) and MODIS Terra/Aqua (1km) feeds are live over India.
              Overpass scans are processed in near-real-time.
            </p>
          </div>

          <div className="rounded border border-sky-500/30 bg-sky-950/20 p-3">
            <div className="flex items-center gap-1.5 font-bold text-sky-300">
              <Satellite className="h-3.5 w-3.5" />
              <span>278 Industrial & Mining Polygons Tagged</span>
            </div>
            <p className="mt-1 text-white/70 leading-relaxed">
              Curated spatial boundaries for Korba, Jharia, Raniganj, Singareni, Talcher, Bellary, Rourkela,
              and major petrochemical refineries are active for spatial containment.
            </p>
          </div>

          <div className="rounded border border-white/10 bg-white/5 p-3">
            <div className="font-bold text-zinc-200">System Information</div>
            <p className="mt-1 text-white/60 leading-relaxed">
              Jvalyx v0.1.0 (SIH 2026). Open-Meteo ECMWF/GFS live atmospheric wind integration active for plume
              dispersion corridors.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 bg-black/30 px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem('jvalyx_feedback') || '[]');
      existing.push({ text: feedback, timestamp: new Date().toISOString() });
      localStorage.setItem('jvalyx_feedback', JSON.stringify(existing));
    } catch {
      /* ignore */
    }
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 font-sans backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-white/15 bg-[#0b0f14] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#121b24] px-4 py-3">
          <div className="flex items-center gap-2 font-black tracking-wide text-cyan-300">
            <MessageSquareText className="h-4 w-4" />
            <span>OPERATOR FEEDBACK</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-xs">
            <Check className="h-8 w-8 text-emerald-400" />
            <span className="font-bold text-emerald-300">Feedback Logged Successfully</span>
            <span className="text-white/60">Thank you for helping improve Jvalyx situational awareness.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 text-xs">
            <p className="mb-2 text-white/70">
              Report thermal false alarms, coordinate deviations, or suggestions for the Jvalyx operations team:
            </p>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter observations, facility notes, or discrepancy report..."
              className="w-full rounded border border-white/15 bg-black/40 p-2.5 text-xs text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!feedback.trim()}
                className="flex items-center gap-1.5 rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

