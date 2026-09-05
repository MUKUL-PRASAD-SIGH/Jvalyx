import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Satellite
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
  onSelectScenario: (scenarioId: string) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onOpenAuditLog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scenarios,
  currentScenario,
  currentFrameIndex,
  isPlaying,
  playbackSpeed,
  routeState,
  isSimulated,
  onSelectScenario,
  onTogglePlay,
  onReset,
  onSpeedChange,
  onOpenAuditLog
}) => {
  const currentFrame = currentScenario.frames[currentFrameIndex] || currentScenario.frames[0];

  const getRouteBadge = (state: RouteState) => {
    switch (state) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-950/80 border-rose-500 text-rose-200',
          icon: ShieldAlert,
          dot: 'bg-rose-500 animate-ping',
          label: 'CRITICAL ESCALATION'
        };
      case 'UNCERTAIN':
        return {
          bg: 'bg-amber-950/80 border-amber-500 text-amber-200',
          icon: AlertTriangle,
          dot: 'bg-amber-500 animate-pulse',
          label: 'UNCERTAIN / VERIFY'
        };
      case 'NORMAL':
      default:
        return {
          bg: 'bg-cyan-950/80 border-cyan-500 text-cyan-200',
          icon: CheckCircle2,
          dot: 'bg-cyan-400',
          label: 'NORMAL / ROUTINE'
        };
    }
  };

  const badge = getRouteBadge(routeState);
  const BadgeIcon = badge.icon;

  return (
    <header className="w-full bg-background-subtle border-b border-border text-zinc-100 select-none">
      {/* Top Telemetry Ticker Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/60 text-[11px] font-mono text-zinc-400 bg-background">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-bold tracking-wider text-cyan-400">
            <Satellite className="w-3.5 h-3.5" />
            SPACE HAZARD INTELLIGENCE SYSTEM
          </span>
          <span className="hidden md:inline text-zinc-600">|</span>
          <span className="hidden md:inline text-zinc-400">
            ENGINE: <span className="text-zinc-200">CatBoost MultiClass v0.1.0</span>
          </span>
          <span className="hidden lg:inline text-zinc-600">|</span>
          <span className="hidden lg:inline text-zinc-400">
            POLICY: <span className="text-zinc-200">arbitrator-0.1.0</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isSimulated ? (
            <span className="px-2 py-0.5 border border-amber-500/60 bg-amber-950/40 text-amber-300 text-[10px] font-bold tracking-wider animate-pulse">
              DEMO SIMULATION ACTIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 border border-cyan-500/60 bg-cyan-950/40 text-cyan-300 text-[10px] font-bold tracking-wider">
              HISTORICAL REPLAY PACK
            </span>
          )}

          <span className="text-zinc-400 font-mono">
            OVERPASS: <span className="text-zinc-100 font-semibold">{currentFrame.timestamp.replace('T', ' ').replace('Z', ' UTC')}</span>
          </span>

          <button 
            onClick={onOpenAuditLog}
            className="px-2 py-0.5 border border-border bg-background-card hover:bg-background-elevated hover:border-cyan-500 text-zinc-300 hover:text-cyan-300 text-[10px] transition-colors"
          >
            AUDIT LOG
          </button>
        </div>
      </div>

      {/* Main Console Command Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Active Scenario Selection */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900 border border-zinc-700 shadow-solid-sm">
            <Flame className="w-5 h-5 text-rose-500 fill-rose-500/20" />
            <span className="font-mono text-base font-black tracking-widest text-zinc-100">
              JVALYX
            </span>
          </div>

          <div className="flex flex-col">
            <div className="text-[10px] font-mono text-zinc-400 tracking-wider">SELECT SCENARIO</div>
            <select
              value={currentScenario.id}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="bg-background-card border border-border text-zinc-100 text-xs px-2.5 py-1 focus:outline-none focus:border-cyan-500 hover:border-border-highlight cursor-pointer font-sans font-medium"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-background text-zinc-100">
                  [{sc.category}] {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Replay Controls & Timeline Scrubber */}
        <div className="flex items-center gap-2 bg-background border border-border p-1">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Replay' : 'Play Scenario Replay'}
            className="px-3 py-1 bg-background-card hover:bg-cyan-950 hover:text-cyan-300 border border-border hover:border-cyan-500 text-zinc-200 text-xs flex items-center gap-1.5 transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono font-semibold">PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                <span className="font-mono font-semibold">PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={onReset}
            title="Reset Scenario to Frame 0"
            className="p-1.5 bg-background-card hover:bg-zinc-800 border border-border text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Toggle */}
          <div className="flex items-center border border-border bg-background-card ml-1 text-[11px] font-mono">
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

          {/* Frame Progress Stepper Indicator */}
          <div className="px-3 py-1 font-mono text-xs flex items-center gap-2 text-zinc-400 border-l border-border ml-1">
            <span>FRAME:</span>
            <div className="flex items-center gap-1">
              {currentScenario.frames.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-1.5 border transition-all ${
                    idx === currentFrameIndex
                      ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : idx < currentFrameIndex
                      ? 'bg-zinc-600 border-zinc-500'
                      : 'bg-zinc-900 border-zinc-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-zinc-200 font-bold">
              {currentFrameIndex + 1}/{currentScenario.frames.length}
            </span>
          </div>
        </div>

        {/* Dynamic Route State Badge */}
        <div className={`flex items-center gap-2.5 px-3 py-1.5 border shadow-solid-sm transition-all ${badge.bg}`}>
          <div className="relative flex items-center justify-center">
            <span className={`w-2.5 h-2.5 rounded-none ${badge.dot}`} />
          </div>
          <BadgeIcon className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono tracking-wider opacity-80 leading-none">ARBITRATION ROUTE</span>
            <span className="text-xs font-mono font-bold tracking-wider leading-tight">{badge.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
