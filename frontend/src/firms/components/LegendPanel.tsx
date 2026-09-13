import { useFires } from '../state/store';
import { CONFIDENCE_RAMP, FRP_RAMP, TIME_RAMP } from '../config/products';
import { FIRE_CLASS_LEGEND, FIRE_CLASS_PNG } from '../analysis/iconMap';

export function LegendPanel() {
  const { layers, panelMode, tableOpen } = useFires();
  const mode = layers.colorMode;
  if (tableOpen) return null;
  const offset = panelMode ? 'right-[346px]' : 'right-3';

  const rows =
    mode === 'frp'
      ? FRP_RAMP.map((b) => ({ color: b.color, label: `${b.label} MW` }))
      : mode === 'confidence'
        ? Object.values(CONFIDENCE_RAMP).map((c) => ({ color: c.color, label: c.label }))
        : TIME_RAMP.map((b) => ({ color: b.color, label: b.label }));

  const title =
    mode === 'frp' ? 'Fire Radiative Power' : mode === 'confidence' ? 'Detection Confidence' : 'Time Since Detection';

  return (
    <div className={`absolute bottom-16 ${offset} z-[1000] w-44 rounded border border-white/12 bg-[#0b0f14]/95 p-2.5 text-white shadow-lg backdrop-blur space-y-2`}>
      {/* Color scale */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/60">{title}</div>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-[11px]">
              <span className="h-3 w-3 rounded-sm border border-white/20" style={{ background: r.color }} />
              {r.label}
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[9px] leading-tight text-white/40">
          Larger squares = coarser footprint (MODIS 1 km).
        </div>
      </div>

      {/* Fire class icon legend */}
      <div className="border-t border-white/10 pt-2">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/60">Fire Class</div>
        <div className="space-y-1">
          {FIRE_CLASS_LEGEND.map((fc) => {
            const emoji = { industrial: '🏢', wildfire: '🌲', mining: '⛏️', agricultural: '🌾', flare: '💥' }[fc.key];
            return (
              <div key={fc.key} className="flex items-center gap-2 text-[11px]">
                <img
                  src={FIRE_CLASS_PNG[fc.key]}
                  width={16}
                  height={16}
                  style={{ display: 'block', flexShrink: 0 }}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    if (el.nextElementSibling) (el.nextElementSibling as HTMLElement).style.display = 'inline';
                  }}
                />
                <span style={{ display: 'none', fontSize: '13px', lineHeight: 1 }}>{emoji}</span>
                <span className="text-white/70">{fc.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[9px] leading-tight text-white/40">
          Active in Classified view or when selected.
        </div>
      </div>
    </div>
  );
}
