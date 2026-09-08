import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function CheckBox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'grid h-4 w-4 shrink-0 place-items-center border transition-colors',
        checked ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300' : 'border-white/30 bg-black/30 text-transparent',
        disabled && 'opacity-40',
      )}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2 6.5 4.7 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function OpacityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="group relative flex items-center" title={`Opacity ${Math.round(value * 100)}%`}>
      <span
        className="grid h-4 w-4 place-items-center rounded-full border border-white/40 text-white/70"
        aria-hidden
      >
        <span
          className="block h-3 w-3 rounded-full"
          style={{ background: `conic-gradient(#e5e7eb ${value * 360}deg, transparent 0)` }}
        />
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute left-5 top-1/2 hidden w-20 -translate-y-1/2 accent-emerald-400 group-hover:block"
      />
    </label>
  );
}

export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="grid h-4 w-4 place-items-center rounded-full border border-white/30 text-white/60"
    >
      <Info className="h-2.5 w-2.5" />
    </span>
  );
}

export function GroupHeader({
  label,
  count,
  open,
  onToggle,
  action,
}: {
  label: string;
  count?: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between bg-sky-500/15 px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-sky-200"
    >
      <span>
        {label} {count && <span className="font-normal text-sky-300/80">({count})</span>}
      </span>
      <span className="flex items-center gap-2 text-sky-300">
        {action}
        {open ? '−' : '+'}
      </span>
    </button>
  );
}

export function Pill({
  active,
  onClick,
  children,
  tone = 'blue',
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'blue' | 'green';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors',
        active
          ? tone === 'green'
            ? 'bg-emerald-500 text-emerald-950'
            : 'bg-sky-500 text-white'
          : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/90',
      )}
    >
      {children}
    </button>
  );
}
