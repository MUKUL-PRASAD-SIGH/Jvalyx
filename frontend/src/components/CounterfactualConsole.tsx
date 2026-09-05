import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';

interface CounterfactualConsoleProps {
  deviation: number; // 0.0 to 1.0
  isSimulated: boolean;
  onDeviationChange: (val: number) => void;
  onResetSimulation: () => void;
}

export const CounterfactualConsole: React.FC<CounterfactualConsoleProps> = ({
  deviation,
  isSimulated,
  onDeviationChange,
  onResetSimulation
}) => {
  const getDeviationLabel = (val: number) => {
    if (val <= 0.15) return { text: 'Routine Flaring (Baseline)', color: 'text-cyan-400' };
    if (val <= 0.45) return { text: 'Elevated Heat (+3σ)', color: 'text-yellow-400' };
    if (val <= 0.80) return { text: 'Significant Anomaly (+10σ)', color: 'text-amber-500' };
    return { text: 'Catastrophic Flare (+25σ)', color: 'text-rose-400' };
  };

  const status = getDeviationLabel(deviation);

  return (
    <div className="bg-background-card border border-border px-3.5 py-2.5 shadow-solid-sm select-none">
      <div className="flex items-center justify-between gap-4">
        {/* Label & Active State */}
        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-zinc-200 uppercase">
            WHAT-IF SIMULATOR:
          </span>
          <span className={`font-bold font-tabular text-xs ${status.color}`}>
            {status.text}
          </span>
        </div>

        {/* The Slider Control */}
        <div className="flex-1 max-w-md flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">0.0 (Norm)</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={deviation}
            onChange={(e) => onDeviationChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">1.0 (Surge)</span>
        </div>

        {/* Reset Button */}
        {isSimulated ? (
          <button
            onClick={onResetSimulation}
            title="Reset to scenario baseline"
            className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-border text-zinc-300 hover:text-cyan-300 text-xs font-mono flex items-center gap-1 transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            RESET
          </button>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
            DRAG TO SIMULATE
          </span>
        )}
      </div>
    </div>
  );
};
