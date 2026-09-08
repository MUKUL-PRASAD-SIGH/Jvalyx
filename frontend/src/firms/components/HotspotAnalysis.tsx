import { useMemo } from 'react';
import { X, ShieldAlert, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { triageHotspot } from '../analysis/triage';
import { FIRE_CLASSES } from '../../data/scenarios';
import type { FireClassId, RouteState } from '../../types';
import { cn } from './ui';

const ROUTE_STYLE: Record<RouteState, { bg: string; icon: typeof ShieldAlert; label: string }> = {
  CRITICAL: { bg: 'bg-rose-950/60 border-rose-500 text-rose-200', icon: ShieldAlert, label: 'Critical' },
  UNCERTAIN: { bg: 'bg-amber-950/60 border-amber-500 text-amber-200', icon: AlertTriangle, label: 'Uncertain — verify' },
  NORMAL: { bg: 'bg-cyan-950/60 border-cyan-500 text-cyan-200', icon: CheckCircle2, label: 'Normal / routine' },
};

export function HotspotAnalysis() {
  const { analysisOpen, selectedId } = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();
  const detection = visible.find((d) => d.id === selectedId);

  const triage = useMemo(() => (detection ? triageHotspot(detection) : null), [detection]);

  if (!analysisOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[1500] bg-black/50"
        onClick={() => dispatch({ type: 'closeAnalysis' })}
      />
      <aside className="fixed right-0 top-0 z-[1501] flex h-full w-[420px] max-w-[92vw] flex-col bg-[#0b0f14] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#7a0c28] to-[#a11540] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Flame className="h-4 w-4" /> Jvalyx Hotspot Triage
          </span>
          <button type="button" onClick={() => dispatch({ type: 'closeAnalysis' })}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {!triage ? (
          <div className="p-6 text-sm text-white/50">Select a fire detection on the map to analyse it.</div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
            <RouteBanner route={triage.routeState} />

            <Section title="Classification (heuristic context lens)">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-3 w-3"
                  style={{ background: FIRE_CLASSES[triage.classId as FireClassId]?.color ?? '#f43f5e' }}
                />
                <span className="font-bold uppercase tracking-wide">{triage.className}</span>
              </div>
              <div className="space-y-1">
                {([1, 2, 3, 4, 5] as FireClassId[]).map((c) => {
                  const p = triage.classProbabilities[c] ?? 0;
                  return (
                    <div key={c} className="flex items-center gap-2">
                      <span className="w-6 text-white/50">C{c}</span>
                      <div className="h-2 flex-1 overflow-hidden bg-white/10">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.round(p * 100)}%`,
                            background: FIRE_CLASSES[c]?.color ?? '#888',
                            opacity: c === triage.classId ? 1 : 0.45,
                          }}
                        />
                      </div>
                      <span className="w-9 text-right tabular-nums">{Math.round(p * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Composite risk">
              <div className="flex items-end gap-3">
                <span
                  className={cn(
                    'font-mono text-3xl font-black',
                    triage.risk.total >= 70 ? 'text-rose-400' : triage.risk.total >= 40 ? 'text-amber-400' : 'text-cyan-400',
                  )}
                >
                  {triage.risk.total}
                </span>
                <span className="pb-1 text-white/40">/ 100</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
                {(['severity', 'anomaly', 'spread', 'exposure'] as const).map((k) => (
                  <div key={k} className="rounded bg-white/5 p-1">
                    <div className="uppercase text-white/40">{k}</div>
                    <div className="font-mono">{(triage.risk[k] as number).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Evidence">
              <ul className="space-y-1.5">
                {triage.explanation.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-orange-400">▹</span>
                    <span className="text-white/80">{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Detection">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                <Field k="FRP" v={`${triage.detection.frp.toFixed(1)} MW`} />
                <Field k="Anomaly" v={triage.anomalyScore.toFixed(2)} />
                <Field k="Brightness" v={`${triage.detection.brightness.toFixed(0)} K`} />
                <Field k="Confidence" v={triage.detection.confidenceLevel} />
                <Field k="Facility z" v={triage.context.facilityZ ? `${triage.context.facilityZ}σ` : 'n/a'} />
                <Field k="Biome" v={triage.context.biome} />
              </dl>
            </Section>

            <p className="rounded border border-white/10 bg-white/5 p-2 text-[10px] leading-relaxed text-white/45">
              {triage.disclaimer}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

function RouteBanner({ route }: { route: RouteState }) {
  const s = ROUTE_STYLE[route];
  return (
    <div className={cn('flex items-center gap-2 border p-2.5 text-sm font-bold uppercase tracking-wide', s.bg)}>
      <s.icon className="h-4 w-4" />
      Route: {s.label}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.03] p-3">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">{title}</h3>
      {children}
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/40">{k}</dt>
      <dd className="text-white/85">{v}</dd>
    </div>
  );
}
