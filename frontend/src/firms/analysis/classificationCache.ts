/**
 * Module-level store of model classifications per detection ID.
 *
 * Filled in bulk by the live monitor right after detections load
 * (POST /api/triage/classify-batch, see state/store.tsx) and per detection when
 * HotspotAnalysis opens one. Map layers, the class filter and the legend counts read from
 * here. Until the model has answered for a detection it is "pending" — shown as a neutral
 * marker, never as a heuristic guess that later flips to a different class.
 */

export interface ClassifiedResult {
  classId: number;
  routeState: string;
}

/**
 * - `pending`: model results are still loading
 * - `ready`: the model has answered for everything it was asked about
 * - `offline`: the backend could not be reached; uncached detections use the heuristic fallback
 */
export type ModelMode = 'pending' | 'ready' | 'offline';

const cache = new Map<string, ClassifiedResult>();
const listeners: (() => void)[] = [];
let mode: ModelMode = 'pending';
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function setClassification(detectionId: string, result: ClassifiedResult): void {
  cache.set(detectionId, result);
  notify();
}

/** Store many results and (optionally) change mode with a single change notification. */
export function setClassificationsBulk(
  entries: Iterable<[string, ClassifiedResult]>,
  nextMode: ModelMode = mode,
): void {
  for (const [id, result] of entries) cache.set(id, result);
  mode = nextMode;
  notify();
}

export function setModelMode(next: ModelMode): void {
  if (mode === next) return;
  mode = next;
  notify();
}

export function getModelMode(): ModelMode {
  return mode;
}

/** Increments on every change; lets React memos depend on cache contents. */
export function getClassificationVersion(): number {
  return version;
}

export function getClassification(detectionId: string): ClassifiedResult | undefined {
  return cache.get(detectionId);
}

export function getAllClassified(): ReadonlyMap<string, ClassifiedResult> {
  return cache;
}

/** Subscribe to any classification update. Returns an unsubscribe fn. */
export function onClassificationChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
