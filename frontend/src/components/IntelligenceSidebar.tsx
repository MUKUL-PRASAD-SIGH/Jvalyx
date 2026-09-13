import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCheck, 
  Flame, 
  Activity, 
  Wind, 
  Building2,
  ChevronRight
} from 'lucide-react';
import type { ScenarioFrame, FacilityDigitalTwin, FireClassId } from '../types';

interface IntelligenceSidebarProps {
  frame: ScenarioFrame;
  facility?: FacilityDigitalTwin;
  onVerify: (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL', notes?: string) => void;
}

export const IntelligenceSidebar: React.FC<IntelligenceSidebarProps> = ({
  frame,
  facility,
  onVerify
}) => {
  const { fusedEvent, decision, risk } = frame;
  const [actionDone, setActionDone] = useState<string | null>(null);

  const handleAction = (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL') => {
    onVerify(action);
    setActionDone(action === 'CONFIRM_CRITICAL' ? 'Critical Escalation Confirmed' : 'Marked Routine');
    setTimeout(() => setActionDone(null), 3500);
  };

  const totalFRP = fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0);
  const isCritical = decision.route_state === 'CRITICAL';
  const isUncertain = decision.route_state === 'UNCERTAIN';

  const plume = frame.tactical?.plumeCorridor;
  const windDir = plume?.windDirectionDeg ?? 135;
  const windSpd = plume?.windSpeedMps ?? 6.5;

  const shortNames: Record<number, string> = {
    1: 'Industrial Fire',
    2: 'Wildfire',
    3: 'Coal Seam Fire',
    4: 'Agricultural Burn',
    5: 'Routine Flare',
  };

  const classColors: Record<number, string> = {
    1: '#f43f5e', // rose
    2: '#f59e0b', // amber
    3: '#a855f7', // purple
    4: '#eab308', // yellow
    5: '#64748b', // slate
  };

  const windCardinal = 
    windDir > 22.5 && windDir <= 67.5 ? 'NE' :
    windDir > 67.5 && windDir <= 112.5 ? 'E' :
    windDir > 112.5 && windDir <= 157.5 ? 'SE' :
    windDir > 157.5 && windDir <= 202.5 ? 'S' :
    windDir > 202.5 && windDir <= 247.5 ? 'SW' :
    windDir > 247.5 && windDir <= 292.5 ? 'W' :
    windDir > 292.5 && windDir <= 337.5 ? 'NW' : 'N';

  // Clean title
  const cleanTitle = decision.class_name
    .replace('Accidental ', '')
    .replace(' / ', ' & ');

  // Clean directive without robotic boilerplate
  const cleanDirective = decision.recommended_action
    ? decision.recommended_action.replace(/^(CRITICAL EMERGENCY:\s*|OPERATOR VERIFICATION REQUIRED:\s*)/i, '')
    : null;

  return (
    <aside className="w-full flex flex-col gap-4 bg-[#080a0d]/95 border border-white/[0.08] p-5 text-zinc-100 backdrop-blur-md select-none font-sans">
      
      {/* 1. Header & Title (Minimal, punchy, editorial) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              isCritical ? 'bg-rose-500 animate-ping' : isUncertain ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
            <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400 font-semibold">
              DECISION ASSESSMENT
            </span>
          </div>

          <span className={`text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 uppercase ${
            isCritical 
              ? 'text-rose-400 bg-rose-950/60 border border-rose-800/60' 
              : isUncertain 
                ? 'text-amber-300 bg-amber-950/60 border border-amber-800/60' 
                : 'text-zinc-300 bg-zinc-800/60 border border-zinc-700/60'
          }`}>
            {decision.route_state}
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
          {cleanTitle}
        </h1>

        {/* Facility metadata */}
        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
          <span>{facility?.name || fusedEvent.facility_name || 'Mangalore Petrochemical Complex'}</span>
        </div>
      </div>

      {/* 2. Directive Banner (Clean, one-liner, no dense paragraphs) */}
      {cleanDirective && (
        <div className="flex items-start gap-2 text-xs font-mono text-amber-200/90 bg-amber-500/[0.06] border-l-2 border-amber-400/80 px-2.5 py-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-snug">{cleanDirective}</span>
        </div>
      )}

      {/* 3. Essential Telemetry (4 crisp numbers, minimal labels, no nested boxes) */}
      <div className="border-t border-b border-white/[0.08] py-3 grid grid-cols-2 gap-x-5 gap-y-3">
        {/* Metric 1: Heat Output */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Heat Output</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-bold text-white font-tabular">
              {totalFRP.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-zinc-400">MW</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            +{fusedEvent.frp_trend_mw_per_hour.toFixed(0)} MW/h surge
          </span>
        </div>

        {/* Metric 2: Anomaly Z-Score */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
            <Activity className="w-3 h-3 text-amber-400" />
            <span>FRP Deviation</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-mono font-bold font-tabular ${
              fusedEvent.facility_frp_zscore >= 4.0 ? 'text-rose-400' : 'text-white'
            }`}>
              {fusedEvent.facility_frp_zscore >= 0 ? `+${fusedEvent.facility_frp_zscore.toFixed(1)}σ` : `${fusedEvent.facility_frp_zscore.toFixed(1)}σ`}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            Baseline: {fusedEvent.baseline_frp_mean.toFixed(0)} MW
          </span>
        </div>

        {/* Metric 3: Wind Dispersion */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
            <Wind className="w-3 h-3 text-purple-400" />
            <span>Wind Vector</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-bold text-purple-200 font-tabular">
              {windSpd.toFixed(1)} m/s
            </span>
            <span className="text-xs font-mono text-purple-300 font-semibold">{windCardinal}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            Heading: {windDir.toFixed(0)}°
          </span>
        </div>

        {/* Metric 4: Complex Containment */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
            <Building2 className="w-3 h-3 text-zinc-400" />
            <span>Containment</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-mono font-bold text-zinc-100 uppercase tracking-wide">
              {fusedEvent.is_in_industrial_polygon ? 'Inside Perimeter' : 'Exterior Zone'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 truncate">
            Industrial Facility
          </span>
        </div>
      </div>

      {/* 4. Threat Score Gauge (Minimalist hairline) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs font-mono">
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">
            Threat Score
          </span>
          <span className="font-bold">
            <span className={`text-base font-tabular ${
              risk.total >= 75 ? 'text-rose-400' : risk.total >= 45 ? 'text-amber-400' : 'text-zinc-200'
            }`}>
              {risk.total}
            </span>
            <span className="text-zinc-500 font-normal text-xs"> / 100</span>
          </span>
        </div>

        {/* Ultra-sleek meter */}
        <div className="w-full h-1.5 bg-zinc-900 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 ${
              risk.total >= 75 ? 'bg-rose-500' : risk.total >= 45 ? 'bg-amber-500' : 'bg-zinc-400'
            }`}
            style={{ width: `${risk.total}%` }}
          />
        </div>

        <div className="flex justify-between text-[8px] font-mono text-zinc-500">
          <span>0 Normal</span>
          <span>50 Elevated</span>
          <span>80 Critical Escalation</span>
        </div>
      </div>

      {/* 5. Classification Likelihoods (Clean borderless list, no truncation) */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-400">
          Candidate Probabilities
        </div>

        <div className="space-y-1.5">
          {([1, 2, 3, 4, 5] as FireClassId[]).map((clsId) => {
            const prob = decision.class_probabilities[clsId] || 0;
            const isSelected = clsId === decision.class_id;

            return (
              <div key={clsId} className="flex items-center gap-2 text-xs font-mono">
                <span className={`w-32 truncate text-[11px] ${
                  isSelected ? 'font-bold text-white' : 'text-zinc-400'
                }`}>
                  {shortNames[clsId]}
                </span>

                <div className="flex-1 h-1 bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.round(prob * 100)}%`,
                      backgroundColor: classColors[clsId],
                      opacity: isSelected ? 1 : 0.3
                    }}
                  />
                </div>

                <span className={`w-8 text-right font-tabular text-[10px] ${
                  isSelected ? 'font-bold text-white' : 'text-zinc-500'
                }`}>
                  {(prob * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Operator Verification Actions */}
      <div className="pt-1 flex flex-col gap-2">
        {actionDone && (
          <div className="p-1.5 bg-zinc-900/90 border border-emerald-500/40 text-emerald-300 font-mono text-xs text-center flex items-center justify-center gap-2">
            <CheckCheck className="w-3.5 h-3.5" />
            {actionDone}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleAction('CONFIRM_CRITICAL')}
            className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/60 hover:border-rose-500 text-rose-200 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            CONFIRM CRITICAL
          </button>

          <button
            onClick={() => handleAction('REJECT_NORMAL')}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
            MARK ROUTINE
          </button>
        </div>
      </div>

    </aside>
  );
};
