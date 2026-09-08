/**
 * Client for the Jvalyx backend (FastAPI).
 *
 * This file is the ONLY frontend wiring to the backend so far. `App.tsx` still runs the
 * bundled scenario pack + client-side math; plugging this client in (and keeping the
 * local pack as an offline fallback) is the remaining integration step.
 *
 * Backend contract note — a few field vocabularies differ from `types/index.ts`:
 *   - sensor agreement: backend uses `agreement | single_sensor | disagreement | unknown`
 *   - confidence state: backend uses `low | medium | high` (not `moderate`)
 *   - detection quality lives under `raw_quality`, not a top-level `quality_score`
 * Reconcile these when wiring, or add a mapping layer here.
 */

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000';

export type BackendRouteState = 'NORMAL' | 'UNCERTAIN' | 'CRITICAL';
export type BackendMode = 'LIVE DATA' | 'HISTORICAL REPLAY' | 'DEMO SIMULATION MODE';

export interface BackendEvidenceCard {
  category: 'thermal' | 'context' | 'temporal' | 'decision';
  title: string;
  metrics: Record<string, string>;
  why_it_matters: string;
}

export interface BackendRiskBreakdown {
  total: number;
  severity: number;
  anomaly: number;
  spread: number;
  exposure: number;
}

export interface BackendEventIntelligence {
  event_id: string;
  scenario_id: string;
  frame_index: number;
  checkpoint: string | null;
  label: string;
  description: string;
  timestamp: string;
  mode: BackendMode;
  route_state: BackendRouteState;
  fused_event: Record<string, unknown>;
  features: Record<string, number>;
  decision: {
    class_id: number;
    class_name: string;
    class_probabilities: Record<string, number>;
    anomaly_score: number;
    route_state: BackendRouteState;
    risk_score: number;
    confidence_state: 'low' | 'medium' | 'high';
    explanation: string[];
    recommended_action: string;
    model_version: string;
    policy_version: string;
  };
  risk: BackendRiskBreakdown;
  evidence: BackendEvidenceCard[];
  tactical: Record<string, unknown> | null;
  historical_baseline_timeline: Array<Record<string, number | string>>;
  verification_status: 'unverified' | 'human_confirmed' | 'human_rejected';
  simulated: boolean;
  deviation: number;
}

export interface BackendScenarioSummary {
  scenario_id: string;
  title: string;
  description: string;
  mode: BackendMode;
  frame_count: number;
  checkpoints: string[];
  facility: Record<string, unknown> | null;
}

export interface BackendReplayStatus {
  scenario_id: string | null;
  scenario_title: string | null;
  mode: BackendMode;
  replay_status: 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED';
  speed: number;
  frame_index: number;
  frame_count: number;
  clients: number;
  model_version: string;
  policy_version: string;
}

export interface BackendAuditEntry {
  id: string;
  event_id: string;
  timestamp: string;
  action: string;
  operator: string;
  notes: string;
  prior_route_state: BackendRouteState | null;
  new_route_state: BackendRouteState | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Jvalyx API ${response.status} on ${path}: ${detail}`);
  }
  return (await response.json()) as T;
}

export const jvalyxApi = {
  baseUrl: BASE_URL,

  health: () => request<{ status: string; model_version: string; policy_version: string }>('/health'),
  config: () => request<Record<string, unknown>>('/config'),

  listScenarios: () => request<BackendScenarioSummary[]>('/scenarios'),
  startScenario: (id: string) => request<BackendReplayStatus>(`/scenarios/${id}/start`, { method: 'POST' }),
  resetScenario: (id: string) => request<BackendReplayStatus>(`/scenarios/${id}/reset`, { method: 'POST' }),

  pause: () => request<BackendReplayStatus>('/replay/pause', { method: 'POST' }),
  resume: () => request<BackendReplayStatus>('/replay/resume', { method: 'POST' }),
  setSpeed: (speed: number) =>
    request<BackendReplayStatus>('/replay/speed', { method: 'POST', body: JSON.stringify({ speed }) }),
  jump: (checkpoint: string) =>
    request<BackendReplayStatus>('/replay/jump', { method: 'POST', body: JSON.stringify({ checkpoint }) }),
  replayStatus: () => request<BackendReplayStatus>('/replay/status'),

  listEvents: () => request<BackendEventIntelligence[]>('/events'),
  getEvent: (id: string) => request<BackendEventIntelligence>(`/events/${id}`),
  simulate: (id: string, deviation: number) =>
    request<BackendEventIntelligence>(`/events/${id}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ deviation }),
    }),
  verify: (id: string, decision: 'confirm' | 'reject', operator?: string, notes?: string) =>
    request<BackendEventIntelligence>(`/events/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ decision, operator, notes }),
    }),
  audit: () => request<BackendAuditEntry[]>('/audit'),
};

export type JvalyxSocketMessage =
  | { type: 'snapshot'; status: BackendReplayStatus; events: BackendEventIntelligence[] }
  | {
      type: 'event_update';
      timestamp: string;
      event_id: string;
      frame_index: number;
      checkpoint: string | null;
      changed: string[];
      payload: Record<string, unknown>;
    }
  | { type: 'replay_status'; reason: string; status: BackendReplayStatus };

/** Opens the live event stream. Returns a close function. */
export function connectEventStream(
  onMessage: (message: JvalyxSocketMessage) => void,
  onStatusChange?: (open: boolean) => void,
): () => void {
  const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/events`;
  const socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => onStatusChange?.(true));
  socket.addEventListener('close', () => onStatusChange?.(false));
  socket.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data) as JvalyxSocketMessage);
    } catch {
      /* ignore malformed frames */
    }
  });

  return () => socket.close();
}
