import React from 'react';
import { Flame, Satellite, Radar } from 'lucide-react';

export type AppView = 'live' | 'twin';

interface GlobalNavProps {
  view: AppView;
  onSelectView: (view: AppView) => void;
}

const TABS: Array<{
  id: AppView;
  label: string;
  sub: string;
  icon: typeof Satellite;
}> = [
  {
    id: 'live',
    label: 'LIVE INDIA FIRE MONITOR',
    sub: 'NASA FIRMS nationwide thermal detections',
    icon: Satellite,
  },
  {
    id: 'twin',
    label: 'INCIDENT DIGITAL TWIN',
    sub: 'Scenario replay · plume · baseline · verification',
    icon: Radar,
  },
];

/**
 * Top-level view switcher. Owns the Jvalyx brand mark; each view keeps its own
 * secondary header (FIRMS `TopBar`, digital-twin `Header`) beneath this bar.
 */
export const GlobalNav: React.FC<GlobalNavProps> = ({ view, onSelectView }) => (
  <nav className="z-[2000] flex h-11 shrink-0 items-center gap-4 border-b border-border bg-background px-4 text-zinc-100 select-none">
    <div className="flex items-center gap-2">
      <Flame className="h-5 w-5 fill-rose-500/20 text-rose-500" />
      <span className="font-mono text-base font-black tracking-widest">JVALYX</span>
    </div>

    <div className="flex items-center gap-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectView(tab.id)}
            title={tab.sub}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[11px] font-bold tracking-wider transition-colors ${
              active
                ? 'border-cyan-500 bg-cyan-950/70 text-cyan-200 shadow-solid-cyan'
                : 'border-border bg-background-card text-zinc-400 hover:border-border-highlight hover:text-zinc-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>

    <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 lg:block">
      Research prototype · analyst decision support
    </span>
  </nav>
);
