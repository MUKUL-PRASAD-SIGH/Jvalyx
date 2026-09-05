import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  ClipboardList,
  Satellite,
  Download
} from 'lucide-react';
import type { Scenario, RouteState } from '../types';

interface HeaderProps {
  scenarios: Scenario[];
  currentScenario: Scenario;
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  routeState: RouteState;
  isSimulated: boolean;
  isFirmsMode: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onOpenAuditLog: () => void;
  onToggleFirmsMode: () => void;
  onFetchCustomFirmsKey: (key: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  scenarios,
  currentScenario,
  currentFrameIndex,
  isPlaying,
  playbackSpeed,
  routeState,
  isSimulated,
  isFirmsMode,
  onSelectScenario,
  onTogglePlay,
  onReset,
  onSpeedChange,
  onOpenAuditLog,
  onToggleFirmsMode,
  onFetchCustomFirmsKey
}) => {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [firmsKey, setFirmsKey] = useState('');

  const getRouteBadge = (state: RouteState) => {
    switch (state) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-solid-rose',
          icon: ShieldAlert,
          dot: 'bg-rose-500 animate-ping',
          label: 'CRITICAL ESCALATION'
        };
      case 'UNCERTAIN':
        return {
          bg: 'bg-amber-950/80 border-amber-500 text-amber-200',
          icon: AlertTriangle,
          dot: 'bg-amber-500 animate-pulse',
          label: 'UNCERTAIN — VERIFY'
        };
      case 'NORMAL':
      default:
        return {
          bg: 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-solid-cyan',
          icon: CheckCircle2,
          dot: 'bg-cyan-400',
          label: 'NORMAL ROUTINE'
        };
    }
  };

  const badge = getRouteBadge(routeState);
  const BadgeIcon = badge.icon;

  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (firmsKey.trim()) {
      onFetchCustomFirmsKey(firmsKey.trim());
      setShowKeyInput(false);
    }
  };

  return (
    <header className="w-full bg-background-subtle border-b border-border text-zinc-100 select-none">
      <div className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 shadow-solid-sm">
            <Flame className="w-5 h-5 text-rose-500 fill-rose-500/20" />
            <span className="font-mono text-base font-black tracking-widest text-zinc-100">
              JVALYX
            </span>
          </div>

          {/* NASA FIRMS Toggle Button */}
          <button
            onClick={onToggleFirmsMode}
            className={`px-3 py-1.5 border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-solid-sm ${
              isFirmsMode
                ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-solid-amber'
                : 'bg-background-card hover:bg-zinc-800 border-border text-zinc-300 hover:text-amber-300'
            }`}
          >
            <Satellite className="w-3.5 h-3.5 text-amber-400" />
            <span>{isFirmsMode ? 'LIVE NASA FIRMS ACTIVE' : 'LOAD NASA FIRMS'}</span>
          </button>

          {!isFirmsMode ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-zinc-400 font-semibold uppercase">
                SCENARIO:
              </label>
              <select
                value={currentScenario.id}
                onChange={(e) => onSelectScenario(e.target.value)}
                className="bg-background-card border border-border text-zinc-100 text-xs px-3 py-1.5 focus:outline-none focus:border-cyan-500 hover:border-border-highlight cursor-pointer font-sans font-medium"
              >
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id} className="bg-background text-zinc-100">
                    {sc.name} ({sc.category})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-amber-300 font-bold">
                24H INDIA NRT FEED (VIIRS/MODIS)
              </span>
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-[10px] font-mono text-zinc-400 hover:text-cyan-300 underline"
              >
                {showKeyInput ? 'Cancel' : 'Enter Custom MAP_KEY'}
              </button>
            </div>
          )}

          {isSimulated && (
            <span className="px-2 py-0.5 border border-amber-500/80 bg-amber-950/60 text-amber-300 font-mono text-[10px] font-bold tracking-wider animate-pulse">
              WHAT-IF ACTIVE
            </span>
          )}
        </div>

        {/* Timeline Replay Controls (Hidden if in live FIRMS mode) */}
        {!isFirmsMode ? (
          <div className="flex items-center gap-2 bg-background border border-border px-2.5 py-1">
            <button
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause' : 'Play Timeline'}
              className="px-3 py-1 bg-background-card hover:bg-cyan-950 hover:text-cyan-300 border border-border hover:border-cyan-500 text-zinc-200 text-xs flex items-center gap-1.5 transition-colors font-mono font-bold"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                  <span>PLAY REPLAY</span>
                </>
              )}
            </button>

            <button
              onClick={onReset}
              title="Reset Timeline"
              className="p-1.5 bg-background-card hover:bg-zinc-800 border border-border text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center border border-border bg-background-card text-[11px] font-mono">
              {[0.5, 1, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`px-2 py-0.5 border-r last:border-r-0 border-border transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <div className="px-2 font-mono text-xs flex items-center gap-1.5 text-zinc-400 border-l border-border ml-1">
              <span>STEP:</span>
              <span className="text-cyan-300 font-bold font-tabular">
                {currentFrameIndex + 1}/{currentScenario.frames.length}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
            <span>NASA SATELLITES:</span>
            <span className="text-amber-400 font-bold">SUOMI-NPP & NOAA-20 / VIIRS 375M</span>
          </div>
        )}

        {/* Right: Route Badge & Audit Log */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2.5 px-3 py-1.5 border transition-all ${badge.bg}`}>
            <span className={`w-2.5 h-2.5 rounded-none ${badge.dot}`} />
            <BadgeIcon className="w-4 h-4" />
            <span className="text-xs font-mono font-bold tracking-wider">{badge.label}</span>
          </div>

          <button 
            onClick={onOpenAuditLog}
            className="px-2.5 py-1.5 border border-border bg-background-card hover:bg-background-elevated hover:border-cyan-500 text-zinc-300 hover:text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            AUDIT LOG
          </button>
        </div>
      </div>

      {/* MAP_KEY Input Drawer (Conditional) */}
      {showKeyInput && (
        <form onSubmit={handleApplyKey} className="px-5 py-2 bg-background border-t border-border flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-400">NASA FIRMS MAP_KEY:</span>
          <input
            type="text"
            placeholder="Enter your 32-character NASA FIRMS key..."
            value={firmsKey}
            onChange={(e) => setFirmsKey(e.target.value)}
            className="flex-1 max-w-md bg-background-card border border-border px-2.5 py-1 text-zinc-100 text-xs focus:border-cyan-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-cyan-950 border border-cyan-500 text-cyan-200 text-xs font-bold hover:bg-cyan-900 transition-colors flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            FETCH LIVE SATELLITE NRT
          </button>
        </form>
      )}
    </header>
  );
};
