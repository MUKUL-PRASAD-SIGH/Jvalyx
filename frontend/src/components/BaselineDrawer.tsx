import React, { useState } from 'react';
import { 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  ComposedChart 
} from 'recharts';
import type { ScenarioFrame, FacilityDigitalTwin } from '../types';
import { Activity, Radio, ChevronDown, ChevronUp } from 'lucide-react';

interface BaselineDrawerProps {
  frame: ScenarioFrame;
  facility: FacilityDigitalTwin;
}

export const BaselineDrawer: React.FC<BaselineDrawerProps> = ({ frame, facility }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'matrix'>('chart');
  const { fusedEvent } = frame;

  const chartData = frame.historicalBaselineTimeline || [];

  return (
    <div className="w-full bg-background-card border border-border text-zinc-100 font-sans shadow-solid-sm select-none">
      {/* Drawer Toggle Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-background/80 transition-colors border-b border-transparent data-[open=true]:border-border"
        data-open={isOpen}
      >
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-300">
          <Activity className="w-3.5 h-3.5 text-zinc-400" />
          <span>DEEP DIVE TELEMETRY & 90-DAY BASELINE</span>
          <span className="text-zinc-500 font-normal">({facility.name})</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span>{isOpen ? 'COLLAPSE' : 'EXPAND TELEMETRY'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expandable Content */}
      {isOpen && (
        <div className="border-t border-border">
          {/* Subtabs */}
          <div className="flex items-center gap-3 px-4 pt-2 border-b border-border/80 bg-background text-xs font-mono">
            <button
              onClick={() => setActiveTab('chart')}
              className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'chart'
                  ? 'border-zinc-300 text-zinc-100 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3 h-3" />
              90-DAY FRP BASELINE ENVELOPE
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'border-zinc-300 text-zinc-100 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio className="w-3 h-3" />
              MULTI-SENSOR FUSION MATRIX
            </button>
          </div>

          {/* Tab 1: Chart */}
          {activeTab === 'chart' && (
            <div className="p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <XAxis 
                      dataKey="day" 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                    />
                    <YAxis 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                      unit=" MW" 
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090b0e',
                        borderColor: '#273244',
                        borderRadius: '0px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '11px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="upper3Sigma"
                      name="+3σ Bound"
                      stroke="#64748b"
                      strokeDasharray="3 3"
                      fill="#475569"
                      fillOpacity={0.12}
                    />
                    <Line
                      type="monotone"
                      dataKey="mean"
                      name="Historical Mean (μ)"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="observedFRP"
                      name="Observed FRP"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#f43f5e', stroke: '#ffffff' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full md:w-64 bg-background border border-border p-2.5 text-xs font-mono space-y-1">
                <div className="text-[10px] text-zinc-400 font-bold uppercase pb-1 border-b border-border">
                  STATISTICAL TOLERANCE
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Baseline Mean (μ):</span>
                  <span className="font-bold text-zinc-100">{fusedEvent.baseline_frp_mean.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Std Deviation (σ):</span>
                  <span className="font-bold text-zinc-100">±{fusedEvent.baseline_frp_std.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Current FRP:</span>
                  <span className="font-bold text-rose-400 font-tabular">
                    {fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0).toFixed(1)} MW
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-zinc-200">
                  <span>Facility Z-Score:</span>
                  <span className="font-tabular">{fusedEvent.facility_frp_zscore.toFixed(2)}σ</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Fusion Matrix */}
          {activeTab === 'matrix' && (
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border border-border">
                <thead>
                  <tr className="bg-background text-zinc-400 border-b border-border text-[10px] uppercase">
                    <th className="p-2">SENSOR</th>
                    <th className="p-2">TIMESTAMP</th>
                    <th className="p-2">FRP</th>
                    <th className="p-2">TI4/TI5</th>
                    <th className="p-2">CLOUD FLAG</th>
                    <th className="p-2">QUALITY</th>
                    <th className="p-2">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {fusedEvent.detections.map((det, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="p-2 font-bold text-zinc-200">{det.sensor}</td>
                      <td className="p-2 text-zinc-400">{det.timestamp.replace('T', ' ').replace('Z', '')}</td>
                      <td className="p-2 font-bold text-rose-400">{det.frp_mw.toFixed(1)} MW</td>
                      <td className="p-2 text-zinc-300">{det.bright_ti4_k.toFixed(1)} / {det.bright_ti5_k.toFixed(1)} K</td>
                      <td className="p-2">{det.cloud_flag ? 'CLOUD ATTENUATED' : 'CLEAR'}</td>
                      <td className="p-2 font-bold font-tabular">{(det.quality_score * 100).toFixed(0)}%</td>
                      <td className="p-2 uppercase font-bold text-zinc-300">{fusedEvent.sensor_agreement_state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
