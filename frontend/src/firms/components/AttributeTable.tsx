import { useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { FIRE_PRODUCTS, PRODUCTS_BY_ID } from '../config/products';
import type { FireDetection, ProductId } from '../types';
import { cn } from './ui';

const COLUMNS: { key: string; label: string; get: (d: FireDetection) => string | number }[] = [
  { key: 'latitude', label: 'LATITUDE', get: (d) => d.latitude.toFixed(5) },
  { key: 'longitude', label: 'LONGITUDE', get: (d) => d.longitude.toFixed(5) },
  { key: 'brightness', label: 'BRIGHT_TI4', get: (d) => d.brightness.toFixed(2) },
  { key: 'scan', label: 'SCAN', get: (d) => d.scan.toFixed(2) },
  { key: 'track', label: 'TRACK', get: (d) => d.track.toFixed(2) },
  { key: 'acq', label: 'ACQUIRE_TIME', get: () => '' },
  { key: 'satellite', label: 'SATELLITE', get: (d) => d.satellite },
  { key: 'instrument', label: 'INSTRUMENT', get: (d) => d.instrument },
  { key: 'confidence', label: 'CONFIDENCE', get: (d) => d.confidence },
  { key: 'version', label: 'VERSION', get: (d) => d.version },
  { key: 'brightness2', label: 'BRIGHT_TI5', get: (d) => (d.brightnessSecondary ?? 0).toFixed(2) },
  { key: 'frp', label: 'FRP', get: (d) => d.frp.toFixed(2) },
  { key: 'daynight', label: 'DAYNIGHT', get: (d) => d.daynight },
];

function fmtTime(d: FireDetection, tz: 'utc' | 'ist'): string {
  const base = d.acquiredAt.getTime() + (tz === 'ist' ? 5.5 * 3_600_000 : 0);
  return new Date(base).toISOString().replace('T', ' ').slice(0, 19);
}

export function AttributeTable() {
  const { tableOpen, tableProduct, tableTimezone, selectedId } = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();
  const [filter, setFilter] = useState('');
  const [field, setField] = useState('all');

  const rows = useMemo(() => {
    let list = visible.filter((d) => d.productId === tableProduct);
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter((d) => {
        if (field === 'all') {
          return (
            `${d.latitude} ${d.longitude} ${d.satellite} ${d.confidence} ${d.daynight} ${d.frp}`
              .toLowerCase()
              .includes(q)
          );
        }
        if (field === 'confidence') return d.confidence.toLowerCase().includes(q);
        if (field === 'daynight') return d.daynight.toLowerCase() === q;
        if (field === 'satellite') return d.satellite.toLowerCase().includes(q);
        if (field === 'frp') return String(d.frp).includes(q);
        return true;
      });
    }
    return list
      .slice()
      .sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime())
      .slice(0, 2000);
  }, [visible, tableProduct, filter, field]);

  if (!tableOpen) return null;

  const exportCsv = () => {
    const header = COLUMNS.map((c) => c.label).join(',');
    const body = rows
      .map((d) =>
        COLUMNS.map((c) => (c.key === 'acq' ? fmtTime(d, tableTimezone) : c.get(d))).join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `firms-${tableProduct}-india.csv`;
    a.click();
  };

  return (
    <div className="absolute left-1/2 top-24 z-[1150] w-[min(920px,92vw)] -translate-x-1/2 overflow-hidden rounded border border-white/20 bg-[#e9edf2] text-[11px] text-[#1c2733] shadow-2xl">
      <div className="flex items-center justify-between bg-[#5a6675] px-2 py-1.5 text-white">
        <select
          value={tableProduct}
          onChange={(e) => dispatch({ type: 'setTableProduct', id: e.target.value as ProductId })}
          className="rounded bg-white/95 px-2 py-0.5 text-[11px] text-[#1c2733]"
        >
          {FIRE_PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button type="button" onClick={() => dispatch({ type: 'closeTable' })} className="rounded bg-orange-500 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-[#cfd6de] px-2 py-1">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={tableTimezone === 'utc'}
            onChange={() => dispatch({ type: 'setTableTimezone', tz: 'utc' })}
          />
          UTC
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={tableTimezone === 'ist'}
            onChange={() => dispatch({ type: 'setTableTimezone', tz: 'ist' })}
          />
          Local Time GMT+0530 (India Standard Time)
        </label>
        <span className="ml-auto font-semibold">{rows.length.toLocaleString()} rows</span>
      </div>

      <div className="max-h-[46vh] overflow-auto bg-white">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#f5c542] text-[10px] uppercase">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap border border-[#d9c26a] px-2 py-1 text-left">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.id}
                onClick={() => dispatch({ type: 'select', id: d.id })}
                className={cn(
                  'cursor-pointer odd:bg-[#f4f6f8] hover:bg-[#ffe9a8]',
                  selectedId === d.id && 'bg-[#ffd98a]',
                )}
              >
                {COLUMNS.map((c) => (
                  <td key={c.key} className="whitespace-nowrap border border-[#e2e6ea] px-2 py-0.5 tabular-nums">
                    {c.key === 'acq' ? fmtTime(d, tableTimezone) : c.get(d)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-2 py-4 text-center text-[#6b7785]">
                  No detections for this product in the current window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 bg-[#5a6675] px-2 py-1 text-white">
        <span className="font-semibold uppercase">Filter by</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="nothing …"
          className="rounded bg-white px-2 py-0.5 text-[#1c2733]"
        />
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="rounded bg-white px-1 py-0.5 text-[#1c2733]"
        >
          <option value="all">All fields</option>
          <option value="confidence">Confidence</option>
          <option value="satellite">Satellite</option>
          <option value="daynight">Day / Night</option>
          <option value="frp">FRP</option>
        </select>
        <span className="ml-auto text-[10px] text-white/70">
          {PRODUCTS_BY_ID[tableProduct].sensor} · {PRODUCTS_BY_ID[tableProduct].resolution}
        </span>
      </div>
    </div>
  );
}
