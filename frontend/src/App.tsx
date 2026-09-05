import { useState, useEffect, useMemo } from 'react';
import { SCENARIOS } from './data/scenarios';
import type { Scenario, ScenarioFrame, RouteState, OperatorAuditEntry } from './types';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { IntelligenceSidebar } from './components/IntelligenceSidebar';
import { CounterfactualConsole } from './components/CounterfactualConsole';
import { BaselineDrawer } from './components/BaselineDrawer';
import { AuditLogModal } from './components/AuditLogModal';
import { 
  computeRiskScore, 
  routeEvent, 
  generatePlumeCorridor 
} from './utils/math';

export function App() {
  // Scenario & Replay Clock State
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('industrial_escalation');
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Counterfactual Simulation State (Signature Differentiator)
  const [deviation, setDeviation] = useState<number>(0.0);
  const [windShiftDeg, setWindShiftDeg] = useState<number>(0);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  // Operator Verification & Audit Trail State
  const [manualRouteOverride, setManualRouteOverride] = useState<RouteState | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditEntries, setAuditEntries] = useState<OperatorAuditEntry[]>([
    {
      id: 'aud-init-001',
      eventId: 'evt-init-000',
      timestamp: '2026-09-05 09:30:00 UTC',
      action: 'REQUEST_TACTICAL_PASS',
      operator: 'OPS-ANALYST-4',
      notes: 'Initial mission baseline validated against historical catalog.',
      priorRouteState: 'NORMAL',
      newRouteState: 'NORMAL'
    }
  ]);

  // Current Scenario
  const currentScenario: Scenario = useMemo(() => {
    return SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
  }, [selectedScenarioId]);

  // Handle Scenario Switch
  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setDeviation(0.0);
    setWindShiftDeg(0);
    setIsSimulated(false);
    setManualRouteOverride(null);
  };

  // Replay Clock Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      const delay = Math.max(800, 3000 / playbackSpeed);
      interval = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= currentScenario.frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, currentScenario.frames.length]);

  // Base Frame from scenario replay pack
  const baseFrame = currentScenario.frames[currentFrameIndex] || currentScenario.frames[0];

  // Dynamically compute frame with Counterfactual adjustments if active
  const effectiveFrame: ScenarioFrame = useMemo(() => {
    if (!isSimulated && deviation === 0.0 && windShiftDeg === 0) {
      if (manualRouteOverride) {
        return {
          ...baseFrame,
          decision: {
            ...baseFrame.decision,
            route_state: manualRouteOverride
          },
          fusedEvent: {
            ...baseFrame.fusedEvent,
            route_state: manualRouteOverride
          }
        };
      }
      return baseFrame;
    }

    // Counterfactual modification
    const baseFRP = baseFrame.fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0);
    const mean = baseFrame.fusedEvent.baseline_frp_mean;
    const std = baseFrame.fusedEvent.baseline_frp_std;

    // Simulated FRP growth proportional to deviation
    const simFRP = baseFRP + deviation * 250;
    const simZ = Number(((simFRP - mean) / Math.max(std, 0.1)).toFixed(2));
    const simCluster = Math.min(8, Math.max(1, Math.round(1 + deviation * 6)));

    // Shift class probabilities toward Class 1 (Industrial) or Class 2
    const p1 = Math.min(0.96, Math.max(0.05, 0.10 + deviation * 0.85));
    const p5 = Math.max(0.01, 1 - p1 - 0.05);
    const simProbs = {
      1: Number(p1.toFixed(2)),
      2: Number((0.03 + deviation * 0.02).toFixed(2)),
      3: 0.01,
      4: 0.01,
      5: Number(p5.toFixed(2))
    };

    // Calculate anomaly score
    const simAnomaly = Math.min(0.98, Math.max(0.1, 0.15 + deviation * 0.82));

    // Arbitrate route
    const calculatedRoute = routeEvent(
      simProbs,
      simAnomaly,
      baseFrame.fusedEvent.is_in_industrial_polygon,
      simZ,
      baseFrame.fusedEvent.sensor_agreement_state,
      baseFrame.fusedEvent.data_quality_score
    );

    const activeRoute = manualRouteOverride || calculatedRoute;

    // Compute risk
    const simRisk = computeRiskScore(
      simProbs,
      simZ,
      simCluster,
      baseFrame.fusedEvent.centroid_drift_velocity_mph,
      0.75
    );

    // Recompute Plume Corridor with shifted wind angle
    const basePlume = baseFrame.tactical?.plumeCorridor;
    const effectiveDir = (basePlume?.windDirectionDeg || 135) + windShiftDeg;
    const simPlume = generatePlumeCorridor(
      [baseFrame.fusedEvent.latitude, baseFrame.fusedEvent.longitude],
      basePlume?.windSpeedMps || 7.0,
      effectiveDir
    );

    return {
      ...baseFrame,
      fusedEvent: {
        ...baseFrame.fusedEvent,
        facility_frp_zscore: simZ,
        frp_z_score: simZ,
        cluster_pixel_count: simCluster,
        route_state: activeRoute,
        detections: [
          {
            ...baseFrame.fusedEvent.detections[0],
            frp_mw: simFRP
          }
        ]
      },
      decision: {
        ...baseFrame.decision,
        class_id: simProbs[1] >= 0.45 ? 1 : baseFrame.decision.class_id,
        class_name: simProbs[1] >= 0.45 ? 'Accidental Industrial Fire / Explosion' : baseFrame.decision.class_name,
        class_probabilities: simProbs,
        anomaly_score: simAnomaly,
        route_state: activeRoute,
        risk_score: simRisk.total,
        explanation: [
          `Counterfactual simulation applied: Operational deviation set to ${deviation.toFixed(2)}.`,
          `Facility FRP shifted to ${simFRP.toFixed(1)} MW (Z = ${simZ}σ relative to ${mean.toFixed(1)} MW normal).`,
          `Downwind plume adjusted by ${windShiftDeg > 0 ? `+${windShiftDeg}°` : `${windShiftDeg}°`} wind deflection.`
        ]
      },
      risk: simRisk,
      tactical: {
        ...baseFrame.tactical,
        plumeCorridor: simPlume,
        affectedAssets: baseFrame.tactical?.affectedAssets || currentScenario.facility.nearbyAssets
      },
      historicalBaselineTimeline: baseFrame.historicalBaselineTimeline.map((pt, i) => {
        if (i === baseFrame.historicalBaselineTimeline.length - 1) {
          return { ...pt, observedFRP: simFRP };
        }
        return pt;
      })
    };
  }, [baseFrame, deviation, windShiftDeg, isSimulated, manualRouteOverride, currentScenario.facility.nearbyAssets]);

  // Handle Deviation Slider
  const handleDeviationChange = (val: number) => {
    setDeviation(val);
    setIsSimulated(true);
  };

  // Handle Wind Shift Slider
  const handleWindShiftChange = (val: number) => {
    setWindShiftDeg(val);
    setIsSimulated(true);
  };

  // Reset Simulation
  const handleResetSimulation = () => {
    setDeviation(0.0);
    setWindShiftDeg(0);
    setIsSimulated(false);
    setManualRouteOverride(null);
  };

  // Reset Scenario
  const handleResetScenario = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    handleResetSimulation();
  };

  // Handle Operator Verification
  const handleVerify = (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL') => {
    const prior = effectiveFrame.decision.route_state;
    const next: RouteState = action === 'CONFIRM_CRITICAL' ? 'CRITICAL' : 'NORMAL';
    setManualRouteOverride(next);

    const newAudit: OperatorAuditEntry = {
      id: `aud-${Date.now()}`,
      eventId: effectiveFrame.fusedEvent.event_id,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      action,
      operator: 'DUTY-SUPERVISOR-1',
      notes: action === 'CONFIRM_CRITICAL'
        ? 'Operator confirmed thermal anomaly escalation. Tactical analysis tasking issued.'
        : 'Operator verified routine operational heat signature. Escalation suppressed.',
      priorRouteState: prior,
      newRouteState: next
    };

    setAuditEntries((prev) => [newAudit, ...prev]);
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col selection:bg-cyan-900 selection:text-cyan-100">
      {/* 1. Header Command Console */}
      <Header
        scenarios={SCENARIOS}
        currentScenario={currentScenario}
        currentFrameIndex={currentFrameIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        routeState={effectiveFrame.decision.route_state}
        isSimulated={isSimulated}
        onSelectScenario={handleSelectScenario}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onReset={handleResetScenario}
        onSpeedChange={setPlaybackSpeed}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
      />

      {/* 2. Main Geospatial Intelligence Console */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3.5 grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        {/* Left Column: Tactical Map + What-If Slider + Baseline Drawer (7 Columns) */}
        <div className="xl:col-span-7 flex flex-col gap-3.5">
          {/* Tactical Geospatial Map */}
          <div className="h-[480px] w-full">
            <TacticalMap
              frame={effectiveFrame}
              facility={currentScenario.facility}
            />
          </div>

          {/* Differentiator: Thermal Digital Twin Counterfactual Slider */}
          <CounterfactualConsole
            deviation={deviation}
            windShiftDeg={windShiftDeg}
            isSimulated={isSimulated}
            onDeviationChange={handleDeviationChange}
            onWindShiftChange={handleWindShiftChange}
            onResetSimulation={handleResetSimulation}
          />

          {/* Baseline, Sensor Fusion & Lifecycle Drawer */}
          <BaselineDrawer
            frame={effectiveFrame}
            facility={currentScenario.facility}
          />
        </div>

        {/* Right Column: Intelligence Sidebar & Evidence Cards (5 Columns) */}
        <div className="xl:col-span-5 flex flex-col">
          <IntelligenceSidebar
            frame={effectiveFrame}
            onVerify={handleVerify}
          />
        </div>
      </main>

      {/* 3. System Footer & Audit Disclosure */}
      <footer className="w-full bg-background-subtle border-t border-border px-4 py-2 text-[11px] font-mono text-zinc-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 font-bold">JVALYX SPACE INTELLIGENCE SYSTEM</span>
          <span className="text-zinc-600">|</span>
          <span>SIH 2026 RESEARCH PROTOTYPE</span>
          <span className="text-zinc-600">|</span>
          <span className="text-emerald-400">● LOCAL OFFLINE REPLAY ENGINE ACTIVE</span>
        </div>

        <div className="text-zinc-400">
          Outputs support operator decision-making and are auditable against policy arbitrator-0.1.0.
        </div>
      </footer>

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditEntries={auditEntries}
      />
    </div>
  );
}

export default App;
