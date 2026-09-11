import { Calendar } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { Pill } from './ui';

export function TimeControls({ variant = 'basic' }: { variant?: 'basic' | 'advanced' }) {
  const { timeRange } = useFires();
  const dispatch = useFiresDispatch();
  const dateLabel = timeRange.end.toISOString().slice(0, 10);
  const windowLabel =
    timeRange.window === '24h'
      ? 'DAY'
      : timeRange.window === '48h'
        ? '2 DAYS'
        : timeRange.window === '7d'
          ? 'WEEK'
          : 'CUSTOM';

  const onCustomDate = (value: string) => {
    if (!value) return;
    const end = new Date(`${value}T23:59:59Z`);
    const hours =
      timeRange.window === '24h' ? 24 : timeRange.window === '48h' ? 48 : 24 * 7;
    dispatch({
      type: 'setCustomRange',
      start: new Date(end.getTime() - hours * 3_600_000),
      end,
    });
  };

  return (
    <div className="space-y-2 border-b border-white/10 bg-black/20 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {variant === 'basic' && (
          <Pill active={false} onClick={() => dispatch({ type: 'setTimeWindow', window: '24h' })}>
            Today
          </Pill>
        )}
        <Pill active={timeRange.window === '24h'} onClick={() => dispatch({ type: 'setTimeWindow', window: '24h' })}>
          24 hrs
        </Pill>
        {variant === 'advanced' && (
          <Pill active={timeRange.window === '48h'} onClick={() => dispatch({ type: 'setTimeWindow', window: '48h' })}>
            48 hrs
          </Pill>
        )}
        <Pill active={timeRange.window === '7d'} onClick={() => dispatch({ type: 'setTimeWindow', window: '7d' })}>
          7 days
        </Pill>
        <label className="flex cursor-pointer items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-white/70 hover:bg-white/15">
          <Calendar className="h-3.5 w-3.5" />
          <input
            type="date"
            value={dateLabel}
            onChange={(e) => onCustomDate(e.target.value)}
            className="w-0 bg-transparent text-[11px] outline-none [color-scheme:dark] focus:w-28"
          />
        </label>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-300">
        <Calendar className="h-3.5 w-3.5" />
        {dateLabel}
        <span className="ml-auto rounded bg-sky-500/20 px-2 py-0.5">{windowLabel}</span>
      </div>
    </div>
  );
}
