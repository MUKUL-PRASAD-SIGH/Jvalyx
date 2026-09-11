import { useState } from 'react';
import {
  MapPinned,
  Flame,
  Image,
  Bell,
  Archive,
  Server,
  BookOpen,
  GitBranch,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { mapBus } from '../map/mapBus';
import { cn } from './ui';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

const ITEMS: NavItem[] = [
  { id: 'fit', label: 'India Fire Map', icon: MapPinned, active: true },
  { id: 'table', label: 'Active Fire Data', icon: Flame },
  { id: 'imagery', label: 'Satellite Imagery', icon: Image },
  { id: 'alerts', label: 'Fire Alerts & High-FRP', icon: Bell },
  { id: 'download', label: 'Download Data (CSV)', icon: Archive },
  { id: 'webservices', label: 'Backend Web Services', icon: Server },
  { id: 'tutorials', label: 'User Guide & FAQ', icon: BookOpen },
  { id: 'about', label: 'About Jvalyx Platform', icon: GitBranch },
];

export function HamburgerNav() {
  const { hamburgerOpen } = useFires();
  const dispatch = useFiresDispatch();
  const [modalContent, setModalContent] = useState<{ title: string; body: React.ReactNode } | null>(null);

  const handleItemClick = (id: string) => {
    switch (id) {
      case 'fit':
        mapBus.emit('fitIndia');
        dispatch({ type: 'toggleHamburger', open: false });
        break;
      case 'table':
      case 'download':
        dispatch({ type: 'openTable' });
        dispatch({ type: 'toggleHamburger', open: false });
        break;
      case 'imagery':
        dispatch({ type: 'setBasemap', id: 'esri-imagery' });
        dispatch({ type: 'toggleHamburger', open: false });
        break;
      case 'alerts':
        dispatch({ type: 'setColorMode', mode: 'frp' });
        dispatch({ type: 'setPanelMode', mode: 'basic' });
        dispatch({ type: 'toggleHamburger', open: false });
        break;
      case 'webservices':
        setModalContent({
          title: 'Jvalyx Backend Web Services (API)',
          body: (
            <div className="space-y-2 font-mono text-xs text-white/80">
              <p className="text-emerald-400 font-bold">FastAPI REST & WebSocket Endpoints (Port 8000):</p>
              <ul className="list-disc pl-4 space-y-1 text-white/70">
                <li><code className="text-sky-300">GET /api/firms/*</code> — NASA FIRMS CORS Reverse Proxy</li>
                <li><code className="text-sky-300">GET /api/weather</code> — Open-Meteo live ECMWF atmospheric wind</li>
                <li><code className="text-sky-300">GET /api/facilities/industrial-polygons</code> — 278 GeoJSON polygons</li>
                <li><code className="text-sky-300">GET /api/facilities/lookup</code> — Ray-casting spatial containment</li>
                <li><code className="text-sky-300">GET /events</code> & <code className="text-sky-300">WS /ws/events</code> — Digital twin stream</li>
                <li><code className="text-sky-300">GET /audit</code> & <code className="text-sky-300">POST /audit/offshore-sync</code> — Compliance logs</li>
              </ul>
            </div>
          ),
        });
        break;
      case 'tutorials':
        setModalContent({
          title: 'Quick User Guide & FAQs',
          body: (
            <div className="space-y-2 text-xs text-white/80">
              <div className="rounded border border-white/10 p-2.5 bg-white/5">
                <span className="font-bold text-amber-300">How to analyze an active fire?</span>
                <p className="mt-1 text-white/60">Click any hotspot pin on the map to inspect FRP, brightness, sensor type, and click "Analyze" for real-time wind plume and industrial spatial containment.</p>
              </div>
              <div className="rounded border border-white/10 p-2.5 bg-white/5">
                <span className="font-bold text-cyan-300">What are the 278 polygons?</span>
                <p className="mt-1 text-white/60">Curated industrial complexes and open-cast coal mining fields (Korba, Jharia, Raniganj, Singareni, Talcher, MRPL, Jamnagar) mapped to separate routine flaring from uncontrolled fires.</p>
              </div>
            </div>
          ),
        });
        break;
      case 'about':
        setModalContent({
          title: 'About Jvalyx Thermal Intelligence Platform',
          body: (
            <div className="space-y-2 text-xs text-white/80">
              <p className="font-semibold text-white">Smart India Hackathon (SIH 2026) Prototype</p>
              <p className="text-white/60 leading-relaxed">
                Jvalyx is an end-to-end multi-satellite thermal intelligence platform combining NASA FIRMS (VIIRS NOAA-20/21/S-NPP, MODIS), Open-Meteo live atmospheric dispersion, CatBoost multi-class incident triage, and persistent audit compliance.
              </p>
            </div>
          ),
        });
        break;
    }
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1400] bg-black/40 transition-opacity',
          hamburgerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => dispatch({ type: 'toggleHamburger', open: false })}
      />
      <nav
        className={cn(
          'fixed left-0 top-0 z-[1401] h-full w-72 transform bg-[#0b0f14] text-white shadow-2xl transition-transform',
          hamburgerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-[#8a0f2e] to-[#a11540] px-4 py-3">
          <span className="text-lg font-black tracking-widest">JVALYX · FIRMS</span>
          <button type="button" onClick={() => dispatch({ type: 'toggleHamburger', open: false })}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-2">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors',
                item.active && 'bg-[#a11540]/25 font-semibold text-white',
              )}
            >
              <item.icon className="h-4 w-4 text-white/70" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="absolute bottom-0 w-full border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-white/40">
          Jvalyx v0.1.0 · Active-fire data © NASA FIRMS / LANCE · Open-Meteo live atmospheric winds.
        </div>
      </nav>

      {modalContent && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-white/15 bg-[#0b0f14] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#121b24] px-4 py-3">
              <span className="font-bold text-amber-300 text-sm">{modalContent.title}</span>
              <button type="button" onClick={() => setModalContent(null)} className="rounded p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">{modalContent.body}</div>
            <div className="border-t border-white/10 bg-black/30 px-4 py-2 text-right">
              <button
                type="button"
                onClick={() => setModalContent(null)}
                className="rounded bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

