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
import { 
  BUNDLED_FIRMS_INDIA, 
  processFIRMSHotspot, 
  fetchLiveFIRMS,
  type FIRMSRecord 
} from './services/firms';

export function App() {
  // Scenario & Replay Clock State
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('industrial_escalation');
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // NASA FIRMS Live Mode State
  const [isFirmsMode, setIsFirmsMode] = useState<boolean>(false);
  const [firmsHotspots, setFirmsHotspots] = useState<FIRMSRecord[]>(BUNDLED_FIRMS_INDIA);
  const [selectedHotspotIndex, setSelectedHotspotIndex] = useState<number>(0);

  // Counterfactual Simulation State (Signature Differentiator)
  const [deviation, setDeviation] = useState<number>(0.0);
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
      operator: 'OPS-DUTY-1',
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
    setIsFirmsMode(false);
    setSelectedScenarioId(scenarioId);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setDeviation(0.0);
    setIsSimulated(false);
    setManualRouteOverride(null);
  };

  // Replay Clock Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && !isFirmsMode) {
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
  }, [isPlaying, playbackSpeed, currentScenario.frames.length, isFirmsMode]);

  // Handle FIRMS Toggle
  const handleToggleFirmsMode = () => {
    setIsFirmsMode((prev) => !prev);
    setIsPlaying(false);
    setDeviation(0.0);
    setIsSimulated(false);
    setManualRouteOverride(null);
  };

  // Handle Custom Key Fetch
  const handleFetchCustomFirmsKey = async (key: string) => {
    try {
      const records = await fetchLiveFIRMS(key);
      if (records.length > 0) {
        setFirmsHotspots(records);
        setSelectedHotspotIndex(0);
        setIsFirmsMode(true);
        alert(`Successfully fetched ${records.length} live active fire hotspots from NASA FIRMS!`);
      } else {
        alert('NASA FIRMS returned 0 active hotspots for the specified region.');
      }
    } catch (err: unknown) {
      alert(`NASA FIRMS Fetch Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Base Frame from scenario replay pack OR NASA FIRMS active record
  const baseFrame: ScenarioFrame = useMemo(() => {
    if (isFirmsMode && firmsHotspots.length > 0) {
      const record = firmsHotspots[selectedHotspotIndex] || firmsHotspots[0];
      return processFIRMSHotspot(record, selectedHotspotIndex);
    }
    return currentScenario.frames[currentFrameIndex] || currentScenario.frames[0];
  }, [isFirmsMode, firmsHotspots, selectedHotspotIndex, currentScenario, currentFrameIndex]);

  // Dynamically compute frame with Counterfactual adjustments if active
  const effectiveFrame: ScenarioFrame = useMemo(() => {
    if (!isSimulated && deviation === 0.0) {
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

    const simFRP = baseFRP + deviation * 250;
    const simZ = Number(((simFRP - mean) / Math.max(std, 0.1)).toFixed(2));
    const simCluster = Math.min(8, Math.max(1, Math.round(1 + deviation * 6)));

    const p1 = Math.min(0.96, Math.max(0.05, 0.10 + deviation * 0.85));
    const p5 = Math.max(0.01, 1 - p1 - 0.05);
    const simProbs = {
      1: Number(p1.toFixed(2)),
      2: Number((0.03 + deviation * 0.02).toFixed(2)),
      3: 0.01,
      4: 0.01,
      5: Number(p5.toFixed(2))
    };

    const simAnomaly = Math.min(0.98, Math.max(0.1, 0.15 + deviation * 0.82));

    const calculatedRoute = routeEvent(
      simProbs,
      simAnomaly,
      baseFrame.fusedEvent.is_in_industrial_polygon,
      simZ,
      baseFrame.fusedEvent.sensor_agreement_state,
      baseFrame.fusedEvent.data_quality_score
    );

    const activeRoute = manualRouteOverride || calculatedRoute;

    const simRisk = computeRiskScore(
      simProbs,
      simZ,
      simCluster,
      baseFrame.fusedEvent.centroid_drift_velocity_mph,
      0.75
    );

    const basePlume = baseFrame.tactical?.plumeCorridor;
    const simPlume = generatePlumeCorridor(
      [baseFrame.fusedEvent.latitude, baseFrame.fusedEvent.longitude],
      basePlume?.windSpeedMps || 7.0,
      basePlume?.windDirectionDeg || 135
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
          `What-If Simulation: Operational deviation set to ${deviation.toFixed(2)}.`,
          `FRP shifted to ${simFRP.toFixed(1)} MW (Z = ${simZ}σ relative to normal baseline).`
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
  }, [baseFrame, deviation, isSimulated, manualRouteOverride, currentScenario.facility.nearbyAssets]);

  const handleDeviationChange = (val: number) => {
    setDeviation(val);
    setIsSimulated(true);
  };

  const handleResetSimulation = () => {
    setDeviation(0.0);
    setIsSimulated(false);
    setManualRouteOverride(null);
  };

  const handleResetScenario = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    handleResetSimulation();
  };

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
      {/* 1. Header Command Bar */}
      <Header
        scenarios={SCENARIOS}
        currentScenario={currentScenario}
        currentFrameIndex={currentFrameIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        routeState={effectiveFrame.decision.route_state}
        isSimulated={isSimulated}
        isFirmsMode={isFirmsMode}
        onSelectScenario={handleSelectScenario}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onReset={handleResetScenario}
        onSpeedChange={setPlaybackSpeed}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onToggleFirmsMode={handleToggleFirmsMode}
        onFetchCustomFirmsKey={handleFetchCustomFirmsKey}
      />

      {/* 2. Streamlined Two-Panel Layout */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Map + Sleek What-If Strip + Expandable Baseline Drawer */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Tactical Geospatial Map */}
          <div className="h-[520px] w-full">
            <TacticalMap
              frame={effectiveFrame}
              facility={currentScenario.facility}
              firmsHotspots={isFirmsMode ? firmsHotspots : undefined}
              selectedHotspotIndex={isFirmsMode ? selectedHotspotIndex : undefined}
              onSelectHotspot={(idx) => {
                setSelectedHotspotIndex(idx);
                setDeviation(0.0);
                setIsSimulated(false);
                setManualRouteOverride(null);
              }}
            />
          </div>

          {/* Compact What-If Simulator Strip */}
          <CounterfactualConsole
            deviation={deviation}
            isSimulated={isSimulated}
            onDeviationChange={handleDeviationChange}
            onResetSimulation={handleResetSimulation}
          />

          {/* Expandable Deep-Dive Baseline Drawer */}
          <BaselineDrawer
            frame={effectiveFrame}
            facility={currentScenario.facility}
          />
        </div>

        {/* Right Column (5 cols): Focused Intelligence Summary & Operator Actions */}
        <div className="lg:col-span-5 flex flex-col">
          <IntelligenceSidebar
            frame={effectiveFrame}
            onVerify={handleVerify}
          />
        </div>
      </main>

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
