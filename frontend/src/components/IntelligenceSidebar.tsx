import React, { useState } from 'react';
import { 
  Flame, 
  ShieldAlert, 
  Clock, 
  MapPin, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  AlertOctagon
} from 'lucide-react';
import type { ScenarioFrame, FireClassId } from '../types';
import { FIRE_CLASSES } from '../data/scenarios';
import { EvidenceCard } from './EvidenceCard';
import { temperature_ratio } from '../utils/math';

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
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const handleAction = (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL') => {
    onVerify(action);
    setVerificationFeedback(action === 'CONFIRM_CRITICAL' ? 'OPERATOR_CONFIRMED' : 'OPERATOR_REJECTED');
    setTimeout(() => setVerificationFeedback(null), 3500);
  };

  // Primary detection for contrast ratio
  const primaryDet = fusedEvent.detections[0] || {
    bright_ti4_k: 340,
    bright_ti5_k: 295,
    frp_mw: 40
  };
  const tempRatio = temperature_ratio(primaryDet.bright_ti4_k, primaryDet.bright_ti5_k);

  return (
    <div className="w-full flex flex-col gap-3.5 bg-background text-zinc-100 font-sans select-none">
      {/* 1. Primary Classification Header Box */}
      <div className="bg-background-card border border-border p-3.5 shadow-solid-sm">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1.5">
          <span className="flex items-center gap-1.5 tracking-wider">
            <Cpu className="w-3 h-3 text-cyan-400" />
            INFERRED CLASSIFICATION
          </span>
          <span className="px-1.5 py-0.2 border border-zinc-700 bg-zinc-800 text-zinc-300 uppercase">
            CONFIDENCE: {decision.confidence_state}
          </span>
        </div>

        <div className="flex items-start gap-2.5">
          <div 
            className="w-8 h-8 border border-border flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-solid-sm"
            style={{ backgroundColor: `${currentClass.color}22`, borderColor: currentClass.color, color: currentClass.color }}
          >
            {decision.class_id}
          </div>
          <div>
            <h2 className="text-sm font-mono font-black text-zinc-100 tracking-wide uppercase">
              {decision.class_name}
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              {currentClass.description}
            </p>
          </div>
        </div>

        {/* Five-Class Competing Probabilities Stack */}
        <div className="mt-3 pt-3 border-t border-border/80">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-2">
            <span>5-CLASS PROBABILITY DISTRIBUTION (CatBoost)</span>
            <span className="text-zinc-500">Σ p_k = 1.0</span>
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
                  <div className="flex-1 h-3 bg-background border border-border/70 overflow-hidden relative">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.round(prob * 100)}%`,
                        backgroundColor: cls.color,
                        opacity: isSelected ? 1 : 0.45
                      }}
                    />
                  </div>
                  <span className={`w-12 text-right font-tabular text-[11px] ${isSelected ? 'font-bold text-zinc-100' : 'text-zinc-400'}`}>
                    {(prob * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Composite Risk Index Gauge & Breakdown */}
      <div className="bg-background-card border border-border p-3.5 shadow-solid-sm">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
          <span className="flex items-center gap-1.5 tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            COMPOSITE RISK INDEX (R)
          </span>
          <span className="text-zinc-400 font-mono">SCALE [0–100]</span>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black tracking-tight text-rose-400 font-tabular">
              {risk.total}
            </span>
            <span className="text-xs font-mono text-zinc-400">/ 100</span>
          </div>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 border uppercase ${
            risk.total >= 75
              ? 'border-rose-500 bg-rose-950/40 text-rose-300'
              : risk.total >= 45
              ? 'border-amber-500 bg-amber-950/40 text-amber-300'
              : 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
          }`}>
            {risk.total >= 75 ? 'HIGH HAZARD' : risk.total >= 45 ? 'ELEVATED' : 'NOMINAL'}
          </span>
        </div>

        {/* Total Risk Bar */}
        <div className="w-full h-2.5 bg-background border border-border overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-500 ${
              risk.total >= 75 ? 'bg-rose-500' : risk.total >= 45 ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${risk.total}%` }}
          />
        </div>

        {/* 4-Component Risk Breakdown Matrix */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-border/80">
          <div className="bg-background border border-border/60 p-1.5">
            <div className="text-zinc-400">SEVERITY (35%)</div>
            <div className="text-xs font-bold text-zinc-100 font-tabular mt-0.5">
              {(risk.severity * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-background border border-border/60 p-1.5">
            <div className="text-zinc-400">ANOMALY (25%)</div>
            <div className="text-xs font-bold text-amber-300 font-tabular mt-0.5">
              {(risk.anomaly * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-background border border-border/60 p-1.5">
            <div className="text-zinc-400">SPREAD (20%)</div>
            <div className="text-xs font-bold text-purple-300 font-tabular mt-0.5">
              {(risk.spread * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-background border border-border/60 p-1.5">
            <div className="text-zinc-400">EXPOSURE (20%)</div>
            <div className="text-xs font-bold text-rose-300 font-tabular mt-0.5">
              {(risk.exposure * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Four Evidence Cards */}
      <div className="flex flex-col gap-2.5">
        {/* Card 1: Thermal Evidence */}
        <EvidenceCard
          title="1. Thermal & Radiometric Evidence"
          icon={Flame}
          metrics={[
            { label: 'OBSERVED FRP', value: fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0).toFixed(1), unit: 'MW', highlight: true },
            { label: 'TEMP CONTRAST (TI4/TI5)', value: tempRatio.toFixed(2), unit: 'ratio' },
            { label: 'CLUSTER EXTENT', value: fusedEvent.cluster_pixel_count, unit: 'pixels' },
            { label: 'FRP TREND (dF/dt)', value: `+${fusedEvent.frp_trend_mw_per_hour.toFixed(1)}`, unit: 'MW/h' }
          ]}
          whyItMatters="SWIR/TIR brightness contrast exceeds 1.15; multi-pixel FRP growth indicates rapid combustion rather than small static thermal source."
        />

        {/* Card 2: Context Evidence */}
        <EvidenceCard
          title="2. Geospatial & Context Evidence"
          icon={MapPin}
          metrics={[
            { label: 'INDUSTRIAL POLYGON', value: fusedEvent.is_in_industrial_polygon ? 'INSIDE' : 'OUTSIDE', highlight: fusedEvent.is_in_industrial_polygon },
            { label: 'LULC CLASS', value: fusedEvent.lulc_class },
            { label: 'LULC ENTROPY (500m)', value: fusedEvent.lulc_entropy_500m.toFixed(2), unit: 'H' },
            { label: 'NEAREST CRITICAL ASSET', value: fusedEvent.distance_to_industrial_m > 0 ? `${fusedEvent.distance_to_industrial_m}m` : '0m (Collocated)' }
          ]}
          whyItMatters={
            fusedEvent.is_in_industrial_polygon
              ? 'Heat is collocated inside a registered industrial petrochemical boundary, escalating priority for tactical containment.'
              : 'Heat detected over open canopy/terrain; low Shannon entropy matches continuous vegetative fuel beds.'
          }
        />

        {/* Card 3: Temporal Evidence */}
        <EvidenceCard
          title="3. Temporal & Baseline Evidence"
          icon={Clock}
          badge={`Z = ${fusedEvent.facility_frp_zscore.toFixed(1)}σ`}
          badgeColor={
            fusedEvent.facility_frp_zscore >= 4.0
              ? 'text-rose-400 border-rose-500/50 bg-rose-950/40'
              : 'text-cyan-400 border-cyan-500/50 bg-cyan-950/40'
          }
          metrics={[
            { label: '90-DAY PERSISTENCE', value: fusedEvent.persistence_score.toFixed(2), unit: 'P_coord' },
            { label: 'BASELINE FRP MEAN (μ)', value: fusedEvent.baseline_frp_mean.toFixed(1), unit: 'MW' },
            { label: 'FACILITY Z-SCORE', value: `${fusedEvent.facility_frp_zscore.toFixed(2)}σ`, highlight: fusedEvent.facility_frp_zscore >= 4.0 },
            { label: 'DRIFT VELOCITY', value: `${fusedEvent.centroid_drift_velocity_mph.toFixed(0)}`, unit: 'm/h' }
          ]}
          whyItMatters={
            fusedEvent.facility_frp_zscore >= 4.0
              ? `Thermal output is ${fusedEvent.facility_frp_zscore.toFixed(1)}σ above normal historical operations (threshold: 4.0σ), triggering immediate anomaly escalation.`
              : 'Thermal emissions remain aligned with normal operational variance. Baseline shift(1) prevents event self-contamination.'
          }
        />

        {/* Card 4: Decision & Arbitration Evidence */}
        <EvidenceCard
          title="4. Decision & Arbitration Evidence"
          icon={ShieldAlert}
          badge={decision.route_state}
          badgeColor={
            decision.route_state === 'CRITICAL'
              ? 'text-rose-300 border-rose-500 bg-rose-950/60'
              : decision.route_state === 'UNCERTAIN'
              ? 'text-amber-300 border-amber-500 bg-amber-950/60'
              : 'text-cyan-300 border-cyan-500 bg-cyan-950/60'
          }
          metrics={[
            { label: 'ISOLATION ANOMALY SCORE', value: decision.anomaly_score.toFixed(2), unit: '[0–1]', highlight: decision.anomaly_score >= 0.75 },
            { label: 'SENSOR AGREEMENT', value: fusedEvent.sensor_agreement_state },
            { label: 'DATA QUALITY SCORE', value: `${(fusedEvent.data_quality_score * 100).toFixed(0)}%` },
            { label: 'RECOMMENDED ACTION', value: 'TACTICAL PIPELINE' }
          ]}
          whyItMatters={
            decision.route_state === 'CRITICAL'
              ? 'Arbitration policy matched Critical condition (p_1 >= 0.45 or is_industrial AND Z >= 4.0). Plume corridor & tactical mask generated.'
              : decision.route_state === 'UNCERTAIN'
              ? 'Safety arbitration policy prevents silent suppression on sensor disagreement or cloud attenuation. Operator review required.'
              : 'Normal route: event verified against historical digital twin. Continued passive telemetry monitoring.'
          }
        />
      </div>

      {/* 4. Operator Verification Station (Human-in-the-Loop) */}
      <div className="bg-background-card border border-border p-3.5 shadow-solid-sm">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-2">
          <span className="flex items-center gap-1.5 font-bold tracking-wider text-zinc-200">
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
            OPERATOR-IN-THE-LOOP VERIFICATION
          </span>
          <span className="text-zinc-500 font-mono">AUDITABLE ACTION</span>
        </div>

        {verificationFeedback && (
          <div className="mb-2 p-2 bg-cyan-950/60 border border-cyan-500 text-cyan-300 font-mono text-xs animate-pulse">
            ✔ Decision logged to immutable audit trail: {verificationFeedback}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction('CONFIRM_CRITICAL')}
            className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500 text-rose-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-solid-sm hover:shadow-solid-rose"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            CONFIRM CRITICAL
          </button>

          <button
            onClick={() => handleAction('REJECT_NORMAL')}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-solid-sm"
          >
            <XCircle className="w-3.5 h-3.5 text-zinc-400" />
            MARK ROUTINE
          </button>
        </div>

        <div className="mt-2.5 p-2 bg-background border border-border/80 text-[11px] font-mono text-zinc-400">
          <span className="text-zinc-300 font-bold">PROTOCOL NOTE:</span> Confirming an uncertain alert taskings optical satellite passes and generates downwind hazard corridors.
        </div>
      </div>
    </div>
  );
};
