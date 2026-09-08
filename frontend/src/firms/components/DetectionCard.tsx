import { X, Table2, Crosshair, Sparkles } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { PRODUCTS_BY_ID, colorForFrp } from '../config/products';
import { mapBus } from '../map/mapBus';

export function DetectionCard() {
  const { selectedId, panelMode } = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();
  const d = visible.find((x) => x.id === selectedId);
  if (!d) return null;
  const offsetRight = panelMode ? 'right-[346px]' : 'right-3';

  const product = PRODUCTS_BY_ID[d.productId];
  const ageH = (Date.now() - d.acquiredAt.getTime()) / 3_600_000;

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-white/45">{k}</span>
      <span className="font-mono tabular-nums text-white/90">{v}</span>
    </div>
  );

  return (
    <div className={`absolute ${offsetRight} top-16 z-[1050] w-64 rounded border border-white/15 bg-[#0b0f14]/97 text-xs text-white shadow-2xl backdrop-blur`}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="flex items-center gap-2 font-bold uppercase tracking-wide">
          <span className="h-3 w-3 rounded-sm" style={{ background: colorForFrp(d.frp) }} />
          {product.shortLabel} hotspot
        </span>
        <button type="button" onClick={() => dispatch({ type: 'select', id: null })}>
          <X className="h-3.5 w-3.5 text-white/50" />
        </button>
      </div>
      <div className="px-3 py-2">
        <Row k="Latitude" v={`${d.latitude.toFixed(5)}°`} />
        <Row k="Longitude" v={`${d.longitude.toFixed(5)}°`} />
        <Row k="Acquired (UTC)" v={d.acquiredAt.toISOString().replace('T', ' ').slice(0, 16)} />
        <Row k="Age" v={ageH < 1 ? `${Math.round(ageH * 60)} min` : `${ageH.toFixed(1)} h`} />
        <Row k="FRP" v={`${d.frp.toFixed(1)} MW`} />
        <Row k="Brightness (I-4/T-21)" v={`${d.brightness.toFixed(1)} K`} />
        <Row k="Bright TI-5 / T-31" v={d.brightnessSecondary ? `${d.brightnessSecondary.toFixed(1)} K` : '—'} />
        <Row k="Scan × Track" v={`${d.scan.toFixed(2)} × ${d.track.toFixed(2)} km`} />
        <Row k="Confidence" v={`${d.confidenceLevel} (${d.confidence})`} />
        <Row k="Satellite" v={`${d.satellite} · ${d.instrument}`} />
        <Row k="Day / Night" v={d.daynight === 'D' ? 'Day' : 'Night'} />
        <Row k="Version" v={d.version || '—'} />
      </div>
      <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => mapBus.emit('flyTo', { lat: d.latitude, lon: d.longitude, zoom: 11 })}
          className="flex flex-col items-center gap-1 rounded bg-white/10 py-1.5 text-[9px] uppercase hover:bg-white/15"
        >
          <Crosshair className="h-3.5 w-3.5" /> Zoom
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'openTable', product: d.productId })}
          className="flex flex-col items-center gap-1 rounded bg-white/10 py-1.5 text-[9px] uppercase hover:bg-white/15"
        >
          <Table2 className="h-3.5 w-3.5" /> Table
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'openAnalysis' })}
          className="flex flex-col items-center gap-1 rounded bg-orange-500 py-1.5 text-[9px] font-bold uppercase text-white hover:bg-orange-400"
        >
          <Sparkles className="h-3.5 w-3.5" /> Analyze
        </button>
      </div>
    </div>
  );
}
