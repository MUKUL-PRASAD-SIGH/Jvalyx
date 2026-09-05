import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  Flame, 
  Layers, 
  Compass, 
  Activity
} from 'lucide-react';
import type { ScenarioFrame, FireClassId } from '../types';
import { FIRE_CLASSES } from '../data/scenarios';

interface IntelligenceSidebarProps {
  frame: ScenarioFrame;
  onVerify: (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL', notes?: string) => void;
}

export const IntelligenceSidebar: React.FC<IntelligenceSidebarProps> = ({
  frame,
  onVerify
}) => {
  const { fusedEvent, decision, risk } = frame;
  const currentClass = FIRE_CLASSES[decision.class_id] || FIRE_CLASSES[1];
  const [actionDone, setActionDone] = useState<string | null>(null);

  const handleAction = (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL') => {
    onVerify(action);
    setActionDone(action === 'CONFIRM_CRITICAL' ? 'ALERT CONFIRMED' : 'MARKED ROUTINE');
    setTimeout(() => setActionDone(null), 3000);
  };

  const totalFRP = fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0);
  const isCritical = decision.route_state === 'CRITICAL';
  const isUncertain = decision.route_state === 'UNCERTAIN';

  return (
    <div className="w-full flex flex-col gap-3 font-sans select-none">
      {/* 1. Primary Verdict & Threat Overview Card */}
      <div className={`p-4 border shadow-solid-sm bg-background-card transition-colors ${
        isCritical ? 'border-rose-500/80 bg-rose-950/20' : isUncertain ? 'border-amber-500/80 bg-amber-950/20' : 'border-border'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-mono mb-2">
          <span className="text-zinc-400 font-bold uppercase tracking-wider">
            AUTOMATED HAZARD INFERENCE
          </span>
          <span className={`px-2 py-0.5 border text-[10px] font-bold font-mono uppercase ${
            isCritical ? 'border-rose-500 bg-rose-900/50 text-rose-200' : isUncertain ? 'border-amber-500 bg-amber-900/50 text-amber-200' : 'border-cyan-500 bg-cyan-900/50 text-cyan-200'
          }`}>
            ROUTE: {decision.route_state}
          </span>
        </div>

        {/* Big Classification Heading */}
        <h2 className="text-base font-mono font-black text-zinc-100 tracking-wide uppercase flex items-center gap-2">
          <span 
            className="w-3 h-3 inline-block shrink-0"
            style={{ backgroundColor: currentClass.color }}
          />
          {decision.class_name}
        </h2>

        {/* 1-Line Explanation Verdict */}
        <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed bg-background/60 p-2 border border-border/80">
          {decision.explanation[0]}
        </p>

        {/* Single Integrated Risk Meter */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-zinc-400">COMPOSITE RISK SCORE</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-2xl font-mono font-black font-tabular ${
                risk.total >= 75 ? 'text-rose-400' : risk.total >= 45 ? 'text-amber-400' : 'text-cyan-400'
              }`}>
                {risk.total}
              </span>
              <span className="text-xs font-mono text-zinc-400">/ 100</span>
            </div>
          </div>

          <div className="w-48">
            <div className="w-full h-2.5 bg-background border border-border overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  risk.total >= 75 ? 'bg-rose-500' : risk.total >= 45 ? 'bg-amber-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${risk.total}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-zinc-400 mt-1">
              <span>Low</span>
              <span>Elevated</span>
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. The 4 Essential Decision Metrics (Clean 2x2 Grid) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Metric 1: Observed Heat */}
        <div className="bg-background-card border border-border p-3 shadow-solid-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>OBSERVED HEAT (FRP)</span>
          </div>
          <div className="text-lg font-mono font-bold text-zinc-100 font-tabular">
            {totalFRP.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">MW</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Trend: <span className="text-rose-300 font-bold">+{fusedEvent.frp_trend_mw_per_hour.toFixed(0)} MW/h</span> ({fusedEvent.cluster_pixel_count} px)
          </div>
        </div>

        {/* Metric 2: Baseline Deviation */}
        <div className="bg-background-card border border-border p-3 shadow-solid-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>BASELINE DEVIATION</span>
          </div>
          <div className={`text-lg font-mono font-bold font-tabular ${
            fusedEvent.facility_frp_zscore >= 4.0 ? 'text-rose-400' : 'text-zinc-100'
          }`}>
            {fusedEvent.facility_frp_zscore >= 0 ? `+${fusedEvent.facility_frp_zscore.toFixed(1)}σ` : `${fusedEvent.facility_frp_zscore.toFixed(1)}σ`}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Normal: {fusedEvent.baseline_frp_mean.toFixed(0)} ± {fusedEvent.baseline_frp_std.toFixed(0)} MW
          </div>
        </div>

        {/* Metric 3: Geospatial Threat */}
        <div className="bg-background-card border border-border p-3 shadow-solid-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>FACILITY BOUNDARY</span>
          </div>
          <div className="text-sm font-mono font-bold text-cyan-300">
            {fusedEvent.is_in_industrial_polygon ? 'INSIDE COMPLEX' : 'OUTSIDE FACILITY'}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-0.5 truncate">
            {fusedEvent.facility_name || 'Forest / Open Terrain'}
          </div>
        </div>

        {/* Metric 4: Sensor Agreement */}
        <div className="bg-background-card border border-border p-3 shadow-solid-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>SENSOR CONSENSUS</span>
          </div>
          <div className="text-sm font-mono font-bold text-zinc-200 uppercase">
            {fusedEvent.sensor_agreement_state.replace(/_/g, ' ')}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Sensors: {fusedEvent.detections.map(d => d.sensor).join(' + ')}
          </div>
        </div>
      </div>

      {/* 3. Streamlined 5-Class Probabilities */}
      <div className="bg-background-card border border-border p-3 shadow-solid-sm">
        <div className="text-[10px] font-mono text-zinc-400 font-bold uppercase mb-2">
          COMPETING CLASS PROBABILITIES
        </div>
        <div className="space-y-1.5">
          {([1, 2, 3, 4, 5] as FireClassId[]).map((clsId) => {
            const cls = FIRE_CLASSES[clsId];
            const prob = decision.class_probabilities[clsId] || 0;
            const isSelected = clsId === decision.class_id;

            return (
              <div key={clsId} className="flex items-center gap-2 text-xs font-mono">
                <span className={`w-4 text-center font-bold ${isSelected ? 'text-cyan-300' : 'text-zinc-400'}`}>
                  C{clsId}
                </span>
                <span className={`w-36 truncate text-[11px] ${isSelected ? 'font-bold text-zinc-100' : 'text-zinc-400'}`}>
                  {cls.name.split('/')[0]}
                </span>
                <div className="flex-1 h-2 bg-background border border-border/70 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.round(prob * 100)}%`,
                      backgroundColor: cls.color,
                      opacity: isSelected ? 1 : 0.4
                    }}
                  />
                </div>
                <span className={`w-10 text-right font-tabular text-[11px] ${isSelected ? 'font-bold text-zinc-100' : 'text-zinc-400'}`}>
                  {(prob * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Operator Verification Station */}
      <div className="bg-background-card border border-border p-3.5 shadow-solid-sm">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2">
          <span className="font-bold text-zinc-200 uppercase">OPERATOR DECISION</span>
          <span className="text-[10px] text-zinc-500">HUMAN-IN-THE-LOOP</span>
        </div>

        {actionDone && (
          <div className="mb-2 p-2 bg-cyan-950/70 border border-cyan-500 text-cyan-300 font-mono text-xs text-center animate-pulse">
            ✔ Decision Recorded: {actionDone}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction('CONFIRM_CRITICAL')}
            className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/70 border border-rose-500 text-rose-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-solid-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            CONFIRM CRITICAL
          </button>

          <button
            onClick={() => handleAction('REJECT_NORMAL')}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-solid-sm"
          >
            <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
            MARK ROUTINE
          </button>
        </div>
      </div>
    </div>
  );
};
