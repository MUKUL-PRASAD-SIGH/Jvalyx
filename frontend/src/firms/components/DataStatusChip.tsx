import { useMemo } from 'react';
import { Satellite, RefreshCw, Table2, TriangleAlert, Flame } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { FIRE_PRODUCTS } from '../config/products';
import { HAS_MAP_KEY } from '../data/firmsClient';
import { computeClassBreakdown } from '../analysis/fastClassifier';

export function DataStatusChip() {
  const { dataStatus, layers, mapView, enabledClasses, modelStatus } = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();

  const perProduct = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of visible) counts.set(d.productId, (counts.get(d.productId) ?? 0) + 1);
    return FIRE_PRODUCTS.filter((p) => layers.products[p.id]).map((p) => ({
      p,
      n: counts.get(p.id) ?? 0,
    }));
  }, [visible, layers.products]);

  const classBreakdown = useMemo(() => {
    if (mapView !== 'classified') return [];
    return computeClassBreakdown(visible);
  }, [visible, mapView]);

  const frpSum = visible.reduce((s, d) => s + d.frp, 0);
  const tone =
    dataStatus.source === 'live'
      ? 'text-emerald-300'
      : dataStatus.source === 'error'
        ? 'text-rose-300'
        : 'text-amber-300';

  return (
    <div className="absolute bottom-24 left-3 z-[1000] w-56 rounded border border-white/12 bg-[#0b0f14]/95 p-2.5 text-white shadow-lg backdrop-blur">
      {mapView === 'classified' ? (
        <>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-400">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span>AI Classification · NRT</span>
            </div>
            <div className="flex gap-1.5 text-[9px] font-mono text-white/50">
              <button
                type="button"
                onClick={() => dispatch({ type: 'setAllClasses', on: true })}
                className="hover:text-emerald-300 hover:underline"
              >
                All
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'setAllClasses', on: false })}
                className="hover:text-rose-300 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          <div
            className={`mb-1 text-[9px] font-mono ${
              modelStatus.state === 'offline' ? 'text-amber-300/90' : 'text-white/55'
            }`}
          >
            {modelStatus.state === 'classifying'
              ? `Model classifying… ${modelStatus.done.toLocaleString()} / ${modelStatus.total.toLocaleString()}`
              : modelStatus.state === 'offline'
                ? 'Model offline — heuristic icons shown'
                : modelStatus.state === 'ready'
                  ? 'All fires classified by the model'
                  : 'Waiting for fire data…'}
          </div>

          <div className="space-y-1 text-[11px]">
            {classBreakdown.map((item) => {
              const isOn = Boolean(enabledClasses[item.id]);
              return (
                <div
                  key={item.id}
                  onClick={() => dispatch({ type: 'toggleClass', classId: item.id })}
                  className={`flex items-center justify-between cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-white/10 ${
                    isOn ? '' : 'opacity-40 line-through'
                  }`}
                  title="Click to toggle this class on the map"
                >
                  <span className="flex items-center gap-1.5 select-none">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => {}}
                      className="h-3 w-3 rounded accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                    <span className="text-[13px] leading-none">{item.emoji}</span>
                    <span className="text-white/85">{item.label}</span>
                  </span>
                  <span className="tabular-nums font-mono text-white/70">{item.count.toLocaleString()}</span>
                </div>
              );
            })}
            <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-white/50">
              <span>Total Active</span>
              <span className="tabular-nums font-mono">{visible.length.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Total FRP</span>
              <span className="tabular-nums font-mono">{Math.round(frpSum).toLocaleString()} MW</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
            <Satellite className={`h-3.5 w-3.5 ${tone}`} />
            <span className={tone}>
              {dataStatus.source === 'live'
                ? 'NASA FIRMS · Live NRT'
                : dataStatus.source === 'bundled'
                  ? 'India dataset'
                  : dataStatus.source === 'synthetic'
                    ? 'Synthetic India data'
                    : dataStatus.source === 'loading'
                      ? 'Loading…'
                      : 'Feed error'}
            </span>
          </div>

          {(dataStatus.source === 'synthetic' || dataStatus.source === 'error') && (
            <div className="mb-1.5 flex items-start gap-1 text-[9px] leading-tight text-amber-200/80">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {HAS_MAP_KEY
                ? 'Live feed unavailable — representative data shown.'
                : 'No MAP_KEY / dataset — representative data shown.'}
            </div>
          )}

          <div className="space-y-0.5 text-[11px]">
            {perProduct.map(({ p, n }) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                  {p.shortLabel}
                </span>
                <span className="tabular-nums text-white/70">{n.toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-white/50">
              <span>Total FRP</span>
              <span className="tabular-nums">{Math.round(frpSum).toLocaleString()} MW</span>
            </div>
          </div>
        </>
      )}

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={() => dispatch({ type: 'reload' })}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-white/10 py-1 text-[10px] uppercase hover:bg-white/15"
        >
          <RefreshCw className="h-3 w-3" /> Reload
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'openTable' })}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-white/10 py-1 text-[10px] uppercase hover:bg-white/15"
        >
          <Table2 className="h-3 w-3" /> Table
        </button>
      </div>
    </div>
  );
}
