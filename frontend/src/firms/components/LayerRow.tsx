import type { ReactNode } from 'react';
import { CheckBox, InfoDot, OpacityControl, cn } from './ui';

export function LayerRow({
  label,
  sub,
  checked,
  onCheck,
  swatch,
  thumbnail,
  opacity,
  onOpacity,
  info,
  indent,
  radio,
}: {
  label: ReactNode;
  sub?: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  swatch?: string;
  thumbnail?: string;
  opacity?: number;
  onOpacity?: (v: number) => void;
  info?: string;
  indent?: boolean;
  radio?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-white/5 py-1.5 pr-2 text-xs text-white/85',
        indent ? 'pl-6' : 'pl-2.5',
      )}
    >
      {radio ? (
        <button
          type="button"
          onClick={() => onCheck(true)}
          className={cn(
            'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
            checked ? 'border-emerald-400' : 'border-white/30',
          )}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
        </button>
      ) : (
        <CheckBox checked={checked} onChange={onCheck} />
      )}

      {swatch && (
        <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: swatch }} />
      )}
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full border border-white/15 object-cover"
          loading="lazy"
        />
      )}

      <span className="flex-1 leading-tight">
        {label}
        {sub && <span className="block text-[10px] text-white/45">{sub}</span>}
      </span>

      {onOpacity !== undefined && opacity !== undefined && (
        <OpacityControl value={opacity} onChange={onOpacity} />
      )}
      {info && <InfoDot text={info} />}
    </div>
  );
}
