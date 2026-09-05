import React from 'react';
import { Sliders, Wind, RotateCcw, Sparkles } from 'lucide-react';

interface CounterfactualConsoleProps {
  deviation: number; // 0.0 to 1.0
  windShiftDeg: number; // -20 to +20
  isSimulated: boolean;
  onDeviationChange: (val: number) => void;
  onWindShiftChange: (val: number) => void;
  onResetSimulation: () => void;
}

export const CounterfactualConsole: React.FC<CounterfactualConsoleProps> = ({
  deviation,
  windShiftDeg,
  isSimulated,
  onDeviationChange,
  onWindShiftChange,
  onResetSimulation
}) => {
  const getDeviationLabel = (val: number) => {
    if (val <= 0.15) return { text: '0.0 — NORMAL ROUTINE OPERATION', color: 'text-cyan-400' };
    if (val <= 0.45) return { text: '0.3 — ELEVATED OPERATIONAL FLARE', color: 'text-yellow-400' };
    if (val <= 0.80) return { text: '0.7 — FACILITY-WIDE ANOMALY SURGE', color: 'text-amber-500' };
    return { text: '1.0 — CATASTROPHIC INDUSTRIAL FIRE', color: 'text-rose-400' };
  };

  const devStatus = getDeviationLabel(deviation);

  return (
    <div className="bg-background-card border border-border p-3.5 shadow-solid-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-100 uppercase">
            THERMAL DIGITAL TWIN — WHAT-IF SIMULATOR
          </span>
        </div>

        {isSimulated ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 border border-amber-500 bg-amber-950/60 text-amber-300 font-mono text-[9px] font-bold tracking-wider animate-pulse">
              DEMO COUNTERFACTUAL MODE
            </span>
            <button
              onClick={onResetSimulation}
              title="Reset What-If Simulation to Scenario Baseline"
              className="p-1 bg-background hover:bg-zinc-800 border border-border text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-zinc-400">OFFLINE PREVIEW</span>
        )}
      </div>

      <p className="text-[11px] font-sans text-zinc-300 mb-3 leading-snug">
        Test how the arbitration engine dynamically transitions routing states as operational deviation crosses the critical <span className="font-mono text-cyan-300 font-bold">4.0σ</span> baseline threshold.
      </p>

      {/* Control 1: Operational Deviation Slider */}
      <div className="space-y-1.5 mb-3.5 bg-background border border-border p-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-300 font-bold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            INCIDENT INTENSITY / DEVIATION:
          </span>
          <span className={`font-bold font-tabular text-xs ${devStatus.color}`}>
            {devStatus.text}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={deviation}
          onChange={(e) => onDeviationChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-cyan-400"
        />

        <div className="flex justify-between text-[9px] font-mono text-zinc-400 px-0.5">
          <span>0.0 (Routine)</span>
          <span>0.3 (Elevated)</span>
          <span>0.7 (Facility Anomaly)</span>
          <span>1.0 (Critical Surge)</span>
        </div>
      </div>

      {/* Control 2: Wind Vector Shift Slider */}
      <div className="space-y-1.5 bg-background border border-border p-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-300 font-bold flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-purple-400" />
            WIND DIRECTION SHIFT (MONTE CARLO PLUME):
          </span>
          <span className="font-bold font-tabular text-xs text-purple-300">
            {windShiftDeg > 0 ? `+${windShiftDeg}°` : `${windShiftDeg}°`}
          </span>
        </div>

        <input
          type="range"
          min="-20"
          max="20"
          step="2"
          value={windShiftDeg}
          onChange={(e) => onWindShiftChange(parseInt(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-purple-400"
        />

        <div className="flex justify-between text-[9px] font-mono text-zinc-400 px-0.5">
          <span>-20° (Shift West)</span>
          <span>0° (Forecast Azimuth)</span>
          <span>+20° (Shift East toward Settlement)</span>
        </div>
      </div>
    </div>
  );
};
