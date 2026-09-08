import { useEffect, useRef, useState } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { INDIA_PLACES } from '../config/india';
import { mapBus } from '../map/mapBus';

interface Hit {
  label: string;
  lat: number;
  lon: number;
  zoom: number;
}

export function QuickSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=6&q=${encodeURIComponent(term)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        setHits(
          data.map((d) => ({
            label: d.display_name,
            lat: Number(d.lat),
            lon: Number(d.lon),
            zoom: 10,
          })),
        );
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const go = (hit: Hit) => {
    mapBus.emit('flyTo', { lat: hit.lat, lon: hit.lon, zoom: hit.zoom });
    onClose();
  };

  return (
    <div className="absolute right-3 top-full z-[1300] mt-1 w-80 rounded border border-white/15 bg-[#0e1218] text-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2">
        <Search className="h-4 w-4 text-white/50" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place in India…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {(hits.length ? hits : INDIA_PLACES.map((p) => ({ label: p.label, lat: p.center[0], lon: p.center[1], zoom: p.zoom }))).map(
          (hit) => (
            <button
              key={hit.label}
              type="button"
              onClick={() => go(hit)}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/10"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="line-clamp-2">{hit.label}</span>
            </button>
          ),
        )}
        {!hits.length && q.length >= 3 && !loading && (
          <div className="px-3 py-2 text-xs text-white/40">No matches.</div>
        )}
      </div>
    </div>
  );
}
