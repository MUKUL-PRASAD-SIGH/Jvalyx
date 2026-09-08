import { useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react';
import { useFires, useFiresDispatch, useVisibleDetections } from '../state/store';
import { cn } from './ui';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function TimelineScrubber() {
  const { timeRange, playing, playhead } = useFires();
  const dispatch = useFiresDispatch();
  const visible = useVisibleDetections();

  const days = useMemo(() => {
    const end = new Date(timeRange.end);
    end.setUTCHours(0, 0, 0, 0);
    const out: Date[] = [];
    for (let i = 44; i >= 0; i -= 1) out.push(new Date(end.getTime() - i * DAY_MS));
    out.push(new Date(end.getTime() + DAY_MS));
    return out;
  }, [timeRange.end]);

  const startMs = timeRange.start.getTime();
  const endMs = timeRange.end.getTime();

  const setEnd = (day: Date) => {
    const end = new Date(day);
    end.setUTCHours(23, 59, 59, 0);
    const hours = timeRange.window === '24h' ? 24 : timeRange.window === '48h' ? 48 : 24 * 7;
    dispatch({ type: 'setCustomRange', start: new Date(end.getTime() - hours * 3_600_000), end });
  };

  const shift = (dir: -1 | 1) => {
    const step = (timeRange.window === '24h' ? 1 : timeRange.window === '48h' ? 2 : 7) * DAY_MS;
    const end = new Date(endMs + dir * step);
    const hours = timeRange.window === '24h' ? 24 : timeRange.window === '48h' ? 48 : 24 * 7;
    dispatch({ type: 'setCustomRange', start: new Date(end.getTime() - hours * 3_600_000), end });
  };

  // group consecutive days by month for the labels row
  const monthSpans: { label: string; count: number }[] = [];
  days.forEach((d) => {
    const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.label === label) last.count += 1;
    else monthSpans.push({ label, count: 1 });
  });

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1100] border-t border-white/10 bg-[#0b0f14]/97 text-white backdrop-blur">
      <div className="flex items-stretch">
        <div className="flex items-center gap-1 border-r border-white/10 px-2">
          <button type="button" onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded hover:bg-white/10">
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'setPlaying', playing: !playing })}
            className="grid h-7 w-7 place-items-center rounded bg-orange-500 text-white hover:bg-orange-400"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded hover:bg-white/10">
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-x-auto">
          <div className="flex text-[9px] uppercase text-white/40">
            {monthSpans.map((m) => (
              <div
                key={m.label}
                className="border-r border-white/10 px-1 py-0.5"
                style={{ width: `${(m.count / days.length) * 100}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>
          <div className="flex">
            {days.map((d) => {
              const ms = d.getTime();
              const inRange = ms >= startMs - DAY_MS && ms <= endMs;
              const isEnd = new Date(endMs).toISOString().slice(0, 10) === d.toISOString().slice(0, 10);
              const future = ms > Date.now();
              return (
                <button
                  key={ms}
                  type="button"
                  disabled={future}
                  onClick={() => setEnd(d)}
                  className={cn(
                    'flex-1 border-r border-white/5 py-1.5 text-center text-[10px] tabular-nums transition-colors',
                    future && 'opacity-25',
                    isEnd
                      ? 'bg-sky-400 font-bold text-sky-950'
                      : inRange
                        ? 'bg-sky-500/25 text-sky-100'
                        : 'text-white/50 hover:bg-white/10',
                  )}
                >
                  {d.getUTCDate()}
                </button>
              );
            })}
          </div>
          {playing && playhead !== null && (
            <div
              className="pointer-events-none absolute bottom-0 top-4 w-0.5 bg-orange-400"
              style={{ left: `${playhead * 100}%` }}
            />
          )}
        </div>

        <div className="flex items-center gap-2 border-l border-white/10 px-3 text-[11px]">
          <div className="text-right">
            <div className="font-semibold tabular-nums text-sky-300">
              {timeRange.end.toISOString().slice(0, 10)}
            </div>
            <div className="text-[9px] uppercase text-white/40">{visible.length.toLocaleString()} detections</div>
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'setTimeWindow',
                window: timeRange.window === '24h' ? '48h' : timeRange.window === '48h' ? '7d' : '24h',
              })
            }
            className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-bold uppercase hover:bg-white/15"
          >
            {timeRange.window === '24h' ? 'Day' : timeRange.window === '48h' ? '2 Days' : timeRange.window === '7d' ? 'Week' : 'Custom'}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
