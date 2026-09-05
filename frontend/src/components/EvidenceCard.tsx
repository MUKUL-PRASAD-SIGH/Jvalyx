import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricRow {
  label: string;
  value: string | number;
  highlight?: boolean;
  unit?: string;
}

interface EvidenceCardProps {
  title: string;
  badge?: string;
  badgeColor?: string;
  icon: LucideIcon;
  metrics: MetricRow[];
  whyItMatters: string;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  title,
  badge,
  badgeColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30',
  icon: Icon,
  metrics,
  whyItMatters
}) => {
  return (
    <div className="bg-background-card border border-border p-3 shadow-solid-sm select-none hover:border-border-highlight transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-100 uppercase">
            {title}
          </span>
        </div>
        {badge && (
          <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold border uppercase tracking-wider ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-2.5">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-400 tracking-tight">{m.label}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-xs font-mono font-bold font-tabular ${m.highlight ? 'text-amber-300' : 'text-zinc-100'}`}>
                {m.value}
              </span>
              {m.unit && <span className="text-[10px] font-mono text-zinc-400">{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Why It Matters Callout Box */}
      <div className="bg-background border-l-2 border-cyan-500 p-2 text-[11px] font-sans text-zinc-300 leading-snug">
        <span className="font-mono text-[9px] font-bold text-cyan-400 uppercase tracking-wider block mb-0.5">
          WHY IT MATTERS:
        </span>
        {whyItMatters}
      </div>
    </div>
  );
};
