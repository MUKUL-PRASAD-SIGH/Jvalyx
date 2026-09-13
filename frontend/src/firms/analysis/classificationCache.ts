/**
 * Module-level cache that stores the classification result for each detection ID
 * the moment /api/triage/classify returns in HotspotAnalysis.
 *
 * This avoids threading a new Redux action / context through the entire component
 * tree. FireMap reads from this cache whenever it redraws classified icon markers.
 */

export interface ClassifiedResult {
  classId: number;
  routeState: string;
}

const cache = new Map<string, ClassifiedResult>();
const listeners: (() => void)[] = [];

export function setClassification(detectionId: string, result: ClassifiedResult): void {
  cache.set(detectionId, result);
  listeners.forEach((fn) => fn());
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
