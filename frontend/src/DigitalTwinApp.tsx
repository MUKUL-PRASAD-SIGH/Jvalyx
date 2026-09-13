import { useEffect, useMemo, useState } from 'react';
import { SCENARIOS } from './data/scenarios';
import type { FacilityDigitalTwin } from './types';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { IntelligenceSidebar } from './components/IntelligenceSidebar';
import { CounterfactualConsole } from './components/CounterfactualConsole';
import { BaselineDrawer } from './components/BaselineDrawer';
import { AuditLogModal } from './components/AuditLogModal';
import { useBackendReplay } from './hooks/useBackendReplay';
import { useLocalReplay } from './hooks/useLocalReplay';

/**
 * Incident Digital Twin / Tactical Replay.
 *
 * The FastAPI backend is the source of truth: it owns the replay clock, arbitration,
 * risk, the counterfactual recompute and the audit log, and streams frames over
 * `/ws/events`. If it is unreachable the view degrades to the bundled scenario pack with
 * client-side math, and says so in the header.
 */
export function DigitalTwinApp() {
  const facilityFallbacks = useMemo(
    () =>
      SCENARIOS.reduce<Record<string, FacilityDigitalTwin>>((acc, s) => {
        acc[s.id] = s.facility;
        return acc;
      }, {}),
    [],
  );

  const backend = useBackendReplay(true, facilityFallbacks);
  const offline = backend.status === 'offline';
  const local = useLocalReplay(offline);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Backend audit rows only change on operator action, so refresh when the log opens.
  useEffect(() => {
    if (isAuditModalOpen && backend.status === 'online') void backend.actions.refreshAudit();
  }, [isAuditModalOpen, backend.status, backend.actions]);

  const usingBackend = backend.status === 'online' && backend.frame !== null;

  // Scenario list for the picker: backend catalog when live, bundled pack when not.
  const scenarioOptions: { id: string; name: string; category: string; frameCount?: number }[] = usingBackend
    ? backend.scenarios.map((s) => ({
        id: s.scenario_id,
        name: s.title,
        category: s.mode,
        frameCount: s.frame_count,
      }))
    : local.scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        frameCount: s.frames.length,
      }));

  const frame = usingBackend ? backend.frame! : local.frame;
  const facility =
    (usingBackend ? backend.facility : local.scenario.facility) ?? local.scenario.facility;
  const scenarioId = usingBackend ? (backend.scenarioId ?? '') : local.scenario.id;
  const frameIndex = usingBackend ? (backend.replayStatus?.frame_index ?? 0) : local.frameIndex;
  const frameCount = usingBackend
    ? (backend.replayStatus?.frame_count ?? 1)
    : local.frameCount;
  const isPlaying = usingBackend ? backend.isPlaying : local.isPlaying;
  const speed = usingBackend ? (backend.replayStatus?.speed ?? 1) : local.playbackSpeed;
  const deviation = usingBackend ? backend.deviation : local.deviation;
  const isSimulated = usingBackend ? backend.isSimulated : local.isSimulated;
  const auditEntries = usingBackend ? backend.auditEntries : local.auditEntries;
  const dataMode = usingBackend
    ? ((backend.event?.mode ?? 'HISTORICAL REPLAY') as 'LIVE DATA' | 'HISTORICAL REPLAY' | 'DEMO SIMULATION MODE')
    : isSimulated
      ? ('DEMO SIMULATION MODE' as const)
      : ('HISTORICAL REPLAY' as const);

  const actions = usingBackend
    ? {
        selectScenario: (id: string) => void backend.actions.selectScenario(id),
        togglePlay: () => void backend.actions.togglePlay(),
        reset: () => void backend.actions.reset(),
        setSpeed: (s: number) => void backend.actions.setSpeed(s),
        step: (delta: 1 | -1) => void backend.actions.step(delta),
        jump: (checkpoint: string) => void backend.actions.jump(checkpoint),
        simulate: (value: number) => void backend.actions.simulate(value),
        resetSimulation: () => void backend.actions.resetSimulation(),
        verify: (action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL') =>
          void backend.actions.verify(action),
      }
    : {
        ...local.actions,
        jump: undefined,
      };

  const handleTogglePlay = () => {
    if (frameIndex >= frameCount - 1 && !isPlaying) {
      actions.reset();
      setTimeout(() => actions.togglePlay(), 120);
    } else {
      actions.togglePlay();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-zinc-100 selection:bg-cyan-900 selection:text-cyan-100">
      <Header
        scenarios={scenarioOptions}
        currentScenarioId={scenarioId}
        dataMode={dataMode}
        currentFrameIndex={frameIndex}
        frameCount={frameCount}
        isPlaying={isPlaying}
        playbackSpeed={speed}
        routeState={frame.decision.route_state}
        connection={{
          status: backend.status,
          socketOpen: backend.socketOpen,
          modelVersion: frame.decision.model_version,
          policyVersion: frame.decision.policy_version,
          error: backend.error,
        }}
        checkpoints={usingBackend ? backend.checkpoints : []}
        onSelectScenario={actions.selectScenario}
        onTogglePlay={handleTogglePlay}
        onReset={actions.reset}
        onSpeedChange={actions.setSpeed}
        onStep={actions.step}
        onJump={actions.jump}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
      />

      <main className="mx-auto grid w-full max-w-[1720px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        {/* Left: map + what-if strip + expandable baseline drawer */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="h-[520px] w-full">
            <TacticalMap frame={frame} facility={facility} />
          </div>

          <CounterfactualConsole
            deviation={deviation}
            isSimulated={isSimulated}
            onDeviationChange={actions.simulate}
            onResetSimulation={actions.resetSimulation}
          />

          <BaselineDrawer frame={frame} facility={facility} />
        </div>

        {/* Right: intelligence summary & operator actions */}
        <div className="flex flex-col lg:col-span-5">
          <IntelligenceSidebar frame={frame} facility={facility} onVerify={actions.verify} />
        </div>
      </main>

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditEntries={auditEntries}
      />
    </div>
  );
}

export default DigitalTwinApp;
