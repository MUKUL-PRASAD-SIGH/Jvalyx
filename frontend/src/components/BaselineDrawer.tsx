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
import { Activity, Radio, GitBranch } from 'lucide-react';

interface BaselineDrawerProps {
  frame: ScenarioFrame;
  facility: FacilityDigitalTwin;
}

export const BaselineDrawer: React.FC<BaselineDrawerProps> = ({ frame, facility }) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'matrix' | 'lifecycle'>('chart');
  const { fusedEvent } = frame;

  // Prepare chart data
  const chartData = frame.historicalBaselineTimeline || [];

  return (
    <div className="w-full bg-background-card border border-border text-zinc-100 font-sans shadow-solid-sm select-none">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5 text-xs font-mono">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1 border transition-colors flex items-center gap-1.5 ${
              activeTab === 'chart'
                ? 'bg-background-card border-cyan-500 text-cyan-300 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            FRP BASELINE & ENVELOPE (Z-SCORE)
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1 border transition-colors flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-background-card border-cyan-500 text-cyan-300 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            MULTI-SENSOR FUSION MATRIX
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`px-3 py-1 border transition-colors flex items-center gap-1.5 ${
              activeTab === 'lifecycle'
                ? 'bg-background-card border-cyan-500 text-cyan-300 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            EVENT LIFECYCLE PIPELINE
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-400">
          FACILITY TWIN: <span className="text-zinc-200 font-bold">{facility.name}</span>
        </div>
      </div>

      {/* Tab 1: FRP Baseline Chart */}
      {activeTab === 'chart' && (
        <div className="p-4 flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-1 w-full h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                  name="+3σ Operational Bound"
                  stroke="#38bdf8"
                  strokeDasharray="3 3"
                  fill="#0284c7"
                  fillOpacity={0.08}
                />
                <Line
                  type="monotone"
                  dataKey="mean"
                  name="Historical Mean (μ)"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="observedFRP"
                  name="Observed Event FRP"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f43f5e', stroke: '#ffffff' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Telemetry Summary Stats on the right */}
          <div className="w-full lg:w-72 bg-background border border-border p-3 text-xs font-mono">
            <div className="text-[10px] text-zinc-400 font-bold uppercase mb-2 border-b border-border pb-1">
              BASELINE STATISTICS (90-DAY LOOKBACK)
            </div>
            <div className="space-y-1.5 text-zinc-300">
              <div className="flex justify-between">
                <span>Facility Normal FRP (μ):</span>
                <span className="font-bold text-zinc-100 font-tabular">{fusedEvent.baseline_frp_mean.toFixed(1)} MW</span>
              </div>
              <div className="flex justify-between">
                <span>Normal Deviation (σ):</span>
                <span className="font-bold text-zinc-100 font-tabular">±{fusedEvent.baseline_frp_std.toFixed(1)} MW</span>
              </div>
              <div className="flex justify-between">
                <span>Current Observation:</span>
                <span className="font-bold text-rose-400 font-tabular">
                  {fusedEvent.detections.reduce((a, b) => a + b.frp_mw, 0).toFixed(1)} MW
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-amber-300 font-bold">
                <span>Standard Z-Score:</span>
                <span className="font-tabular">{fusedEvent.facility_frp_zscore.toFixed(2)}σ</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Multi-Sensor Fusion Matrix */}
      {activeTab === 'matrix' && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border border-border">
            <thead>
              <tr className="bg-background text-zinc-400 border-b border-border text-[10px] uppercase">
                <th className="p-2">SENSOR</th>
                <th className="p-2">ACQUISITION TIME</th>
                <th className="p-2">NOMINAL FOOTPRINT</th>
                <th className="p-2">FRP (MW)</th>
                <th className="p-2">TI4/TI5 (K)</th>
                <th className="p-2">CLOUD / GLINT</th>
                <th className="p-2">QUALITY SCORE</th>
                <th className="p-2">FUSION STATE</th>
              </tr>
            </thead>
            <tbody>
              {fusedEvent.detections.map((det, idx) => (
                <tr key={idx} className="border-b border-border/60 hover:bg-background/40">
                  <td className="p-2 font-bold text-cyan-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-cyan-400 inline-block"></span>
                    {det.sensor}
                  </td>
                  <td className="p-2 text-zinc-300">{det.timestamp.replace('T', ' ').replace('Z', '')}</td>
                  <td className="p-2 text-zinc-400">
                    {det.sensor === 'VIIRS' ? '375 m' : det.sensor === 'MODIS' ? '1,000 m' : '4,000 m'}
                  </td>
                  <td className="p-2 font-bold text-rose-400 font-tabular">{det.frp_mw.toFixed(1)} MW</td>
                  <td className="p-2 text-zinc-300 font-tabular">{det.bright_ti4_k.toFixed(1)} / {det.bright_ti5_k.toFixed(1)}</td>
                  <td className="p-2">
                    {det.cloud_flag ? (
                      <span className="text-amber-400 font-bold">CLOUD OBSTRUCTED</span>
                    ) : (
                      <span className="text-zinc-500">CLEAR</span>
                    )}
                  </td>
                  <td className="p-2 font-tabular font-bold text-zinc-200">
                    {(det.quality_score * 100).toFixed(0)}%
                  </td>
                  <td className="p-2 uppercase font-bold text-[11px] text-amber-300">
                    {fusedEvent.sensor_agreement_state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Event Lifecycle Stepper */}
      {activeTab === 'lifecycle' && (
        <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs font-mono">
          {[
            { step: '01', name: 'INGESTION', desc: 'Deduplicated raw VIIRS / MODIS records' },
            { step: '02', name: 'SCHEMAS', desc: 'Normalized canonical detection model' },
            { step: '03', name: 'FUSION', desc: 'Footprint-scaled spatial-temporal matching' },
            { step: '04', name: 'ENRICHMENT', desc: 'Point-in-polygon & 90d baseline shift(1)' },
            { step: '05', name: 'INFERENCE', desc: 'CatBoost MultiClass & Isolation Forest' },
            { step: '06', name: 'ARBITRATION', desc: 'Deterministic NORMAL / UNCERTAIN / CRITICAL' }
          ].map((item, idx) => (
            <div key={idx} className="bg-background border border-border p-2.5 flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-cyan-400 font-bold mb-1">{item.step}</div>
                <div className="font-bold text-zinc-100 text-[11px] mb-1">{item.name}</div>
              </div>
              <div className="text-[10px] text-zinc-400 leading-tight">{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
