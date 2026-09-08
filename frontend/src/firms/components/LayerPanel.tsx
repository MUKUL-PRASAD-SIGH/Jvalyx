import { useState } from 'react';
import { Menu, GraduationCap, X, Copy } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { FIRE_PRODUCTS } from '../config/products';
import { GIBS_DYNAMIC_IMAGERY } from '../config/gibs';
import { BASEMAPS } from '../config/basemaps';
import type { ColorMode } from '../types';
import { GroupHeader, cn } from './ui';
import { LayerRow } from './LayerRow';
import { TimeControls } from './TimeControls';

function PanelShell({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'basic' | 'advanced';
  children: React.ReactNode;
}) {
  const dispatch = useFiresDispatch();
  return (
    <div className="flex max-h-[calc(100vh-8rem)] w-[330px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0b0f14] shadow-2xl">
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          tone === 'basic' ? 'bg-[#12303a] text-teal-200' : 'bg-[#0f2233] text-emerald-300',
        )}
      >
        <button type="button" onClick={() => dispatch({ type: 'setPanelMode', mode: 'menu' })}>
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-sm font-black uppercase tracking-widest">{title}</span>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          <button type="button" onClick={() => dispatch({ type: 'setPanelMode', mode: null })}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function ColorModeTabs() {
  const { layers } = useFires();
  const dispatch = useFiresDispatch();
  const tabs: { id: ColorMode; label: string }[] = [
    { id: 'confidence', label: 'Simple' },
    { id: 'time', label: 'Time Based' },
    { id: 'frp', label: 'FRP' },
  ];
  return (
    <div className="flex items-stretch border-b border-white/10 text-[11px] font-bold uppercase">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dispatch({ type: 'setColorMode', mode: t.id })}
          className={cn(
            'flex-1 py-1.5 transition-colors',
            layers.colorMode === t.id ? 'bg-emerald-500 text-emerald-950' : 'text-white/55 hover:text-white/85',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function FiresGroup({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const { layers } = useFires();
  const dispatch = useFiresDispatch();
  const [open, setOpen] = useState(defaultOpen);
  const on = FIRE_PRODUCTS.filter((p) => layers.products[p.id]).length;

  return (
    <section>
      <GroupHeader
        label="Fires / Hotspots"
        count={`${on}/${FIRE_PRODUCTS.length}`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        action={<Copy className="h-3 w-3" />}
      />
      {open && (
        <>
          <ColorModeTabs />
          {FIRE_PRODUCTS.map((p) => (
            <LayerRow
              key={p.id}
              label={p.label}
              swatch={p.color}
              checked={layers.products[p.id]}
              onCheck={(v) => dispatch({ type: 'toggleProduct', id: p.id, on: v })}
              info={`${p.sensor} · ${p.platform} · ${p.resolution}`}
              indent
            />
          ))}
          <div className="flex items-center gap-2 px-2.5 py-2">
            <span className="text-[10px] uppercase text-white/45">Fire opacity</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={layers.fireOpacity}
              onChange={(e) => dispatch({ type: 'setFireOpacity', value: Number(e.target.value) })}
              className="flex-1 accent-emerald-400"
            />
          </div>
        </>
      )}
    </section>
  );
}

function DynamicImageryGroup() {
  const { layers, timeRange } = useFires();
  const dispatch = useFiresDispatch();
  const [open, setOpen] = useState(false);
  const on = GIBS_DYNAMIC_IMAGERY.filter((l) => layers.gibs[l.id]?.on).length;

  return (
    <section>
      <GroupHeader
        label="Dynamic Imagery"
        count={`${on}/${GIBS_DYNAMIC_IMAGERY.length}`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        action={<Copy className="h-3 w-3" />}
      />
      {open && (
        <>
          <div className="px-2.5 py-1 text-[10px] text-white/40">
            NASA GIBS true-color · {timeRange.end.toISOString().slice(0, 10)}
          </div>
          {GIBS_DYNAMIC_IMAGERY.map((l) => {
            const s = layers.gibs[l.id] ?? { on: false, opacity: 1 };
            return (
              <LayerRow
                key={l.id}
                label={l.label}
                checked={s.on}
                onCheck={(v) => dispatch({ type: 'toggleGibs', id: l.id, on: v })}
                opacity={s.opacity}
                onOpacity={(v) => dispatch({ type: 'setGibsOpacity', id: l.id, value: v })}
                info="NASA GIBS WMTS · daily corrected reflectance"
                indent
              />
            );
          })}
        </>
      )}
    </section>
  );
}

function BackgroundsGroup() {
  const { layers } = useFires();
  const dispatch = useFiresDispatch();
  const [open, setOpen] = useState(true);
  return (
    <section>
      <GroupHeader
        label="Static Backgrounds"
        count={`1/${BASEMAPS.length}`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open &&
        BASEMAPS.map((b) => (
          <LayerRow
            key={b.id}
            label={b.label}
            thumbnail={b.thumbnail}
            checked={layers.basemapId === b.id}
            onCheck={() => dispatch({ type: 'setBasemap', id: b.id })}
            radio
            info={b.attribution.replace(/<[^>]+>/g, '')}
            indent
          />
        ))}
    </section>
  );
}

function ReferenceGroup() {
  const { layers } = useFires();
  const dispatch = useFiresDispatch();
  const [open, setOpen] = useState(true);
  return (
    <section>
      <GroupHeader label="Reference & Overlays" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <>
          <LayerRow
            label="Protected Areas"
            thumbnail=""
            swatch="#2dd4bf"
            checked={layers.overlays.protectedAreas}
            onCheck={(v) => dispatch({ type: 'toggleOverlay', key: 'protectedAreas', on: v })}
            info="Major Indian tiger reserves, national parks & biosphere reserves"
            indent
          />
          <LayerRow
            label="Place & Boundary Labels"
            checked={layers.overlays.labels}
            onCheck={(v) => dispatch({ type: 'toggleOverlay', key: 'labels', on: v })}
            info="Esri reference labels (shown over imagery basemaps)"
            indent
          />
        </>
      )}
    </section>
  );
}

export function BasicModePanel() {
  return (
    <PanelShell title="Basic Mode" tone="basic">
      <TimeControls variant="basic" />
      <FiresGroup />
      <DynamicImageryGroup />
      <ReferenceGroup />
      <BackgroundsGroup />
    </PanelShell>
  );
}

export function AdvancedModePanel() {
  const [daily, setDaily] = useState(true);
  const [polarOpen, setPolarOpen] = useState(true);
  const { layers } = useFires();
  const dispatch = useFiresDispatch();
  const on = FIRE_PRODUCTS.filter((p) => layers.products[p.id]).length;

  return (
    <PanelShell title="Advanced Mode" tone="advanced">
      <TimeControls variant="advanced" />
      <div className="flex gap-1 border-b border-white/10 p-2 text-[11px] font-bold uppercase">
        <button
          type="button"
          onClick={() => setDaily(true)}
          className={cn('flex-1 rounded-full py-1', daily ? 'bg-emerald-500 text-emerald-950' : 'bg-white/10 text-white/55')}
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setDaily(false)}
          className={cn('flex-1 rounded-full py-1', !daily ? 'bg-emerald-500 text-emerald-950' : 'bg-white/10 text-white/55')}
        >
          Sub-Daily
        </button>
      </div>

      <section>
        <GroupHeader
          label="Polar Orbiting"
          count={`${on}/${FIRE_PRODUCTS.length}`}
          open={polarOpen}
          onToggle={() => setPolarOpen((v) => !v)}
        />
        {polarOpen && (
          <>
            <ColorModeTabs />
            {FIRE_PRODUCTS.map((p) => (
              <LayerRow
                key={p.id}
                label={
                  <span>
                    {p.label}{' '}
                    <span className="text-[10px] text-white/40">{p.platform}</span>
                  </span>
                }
                swatch={p.color}
                checked={layers.products[p.id]}
                onCheck={(v) => dispatch({ type: 'toggleProduct', id: p.id, on: v })}
                info={`${p.sensor} · ${p.resolution} · NRT`}
                indent
              />
            ))}
          </>
        )}
      </section>

      <DisabledGroup label="Geostationary" badge="BETA" count="0/7" />
      <DisabledGroup label="NRT and Standard (for research)" count="0/8" />
      <DisabledGroup label="Satellite Swath Outlines & Orbit Tracks" count="0/17" />

      <DynamicImageryGroup />
      <ReferenceGroup />
      <BackgroundsGroup />
    </PanelShell>
  );
}

function DisabledGroup({ label, count, badge }: { label: string; count: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-2.5 py-2 text-[11px] font-bold uppercase text-white/35">
      <span className="flex items-center gap-2">
        {label}
        {badge && <span className="rounded bg-fuchsia-500/30 px-1 text-[9px] text-fuchsia-200">{badge}</span>}
        <span className="font-normal">({count})</span>
      </span>
      <span>+</span>
    </div>
  );
}
