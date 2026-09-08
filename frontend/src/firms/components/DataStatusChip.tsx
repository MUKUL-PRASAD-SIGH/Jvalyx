import { useMemo } from 'react';
import { Satellite, RefreshCw, Table2, TriangleAlert } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { FIRE_PRODUCTS } from '../config/products';
import { HAS_MAP_KEY } from '../data/firmsClient';

export function DataStatusChip() {
  const { dataStatus, layers } = useFires();
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

  const frpSum = visible.reduce((s, d) => s + d.frp, 0);
  const tone =
    dataStatus.source === 'live'
      ? 'text-emerald-300'
      : dataStatus.source === 'error'
        ? 'text-rose-300'
        : 'text-amber-300';

  return (
    <div className="absolute bottom-24 left-3 z-[1000] w-56 rounded border border-white/12 bg-[#0b0f14]/95 p-2.5 text-white shadow-lg backdrop-blur">
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
