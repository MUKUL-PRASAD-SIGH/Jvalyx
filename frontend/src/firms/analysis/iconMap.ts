/**
 * Fire class PNG icon paths and route ring colors.
 * Drop PNG files in frontend/public/icons/ — they are served at /icons/<name>.png
 */

export type FireClassKey = 'industrial' | 'wildfire' | 'mining' | 'agricultural' | 'flare';

/** Maps classId (1-5) → icon key */
export const CLASS_ID_TO_KEY: Record<number, FireClassKey> = {
  1: 'industrial',
  2: 'wildfire',
  3: 'mining',
  4: 'agricultural',
  5: 'flare',
};

export const ROUTE_RING_COLOR: Record<string, string> = {
  CRITICAL: '#ff3b3b',
  UNCERTAIN: '#f5c542',
  NORMAL:   '#22d3ee',
};

/** Public URL for each PNG (served from frontend/public/icons/) */
export const FIRE_CLASS_PNG: Record<FireClassKey, string> = {
  industrial:   '/icons/industrial.png',
  wildfire:     '/icons/wildfire.png',
  mining:       '/icons/mining.png',
  agricultural: '/icons/agricultural.png',
  flare:        '/icons/flare.png',
};

/**
 * Build divIcon HTML for a classified fire marker.
 * Uses <img> so the PNG renders exactly — no emoji font issues.
 * @param classId   1–5
 * @param routeState  CRITICAL | UNCERTAIN | NORMAL
 * @param size      icon width/height in px (zoom-aware)
 */
export function buildClassifiedMarkerHtml(
  classId: number,
  routeState: string,
  size: number,
): string {
  const key = CLASS_ID_TO_KEY[classId] ?? 'industrial';
  const src = FIRE_CLASS_PNG[key];
  const glow = routeState === 'CRITICAL'
    ? `filter:drop-shadow(0 0 3px #ff3b3b);`
    : routeState === 'UNCERTAIN'
      ? `filter:drop-shadow(0 0 2px #f5c542);`
      : `filter:drop-shadow(0 0 1.5px #22d3ee);`;
  return `<div style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
    <img
      src="${src}"
      style="width:${size}px !important;height:${size}px !important;max-width:${size}px !important;max-height:${size}px !important;object-fit:contain;display:block;${glow}cursor:pointer;"
      onerror="this.style.display='none'"
    />
  </div>`;
}

/** Label list for legend panels */
export const FIRE_CLASS_LEGEND: { key: FireClassKey; label: string }[] = [
  { key: 'industrial',   label: 'Industrial Fire' },
  { key: 'wildfire',     label: 'Wildfire / Forest' },
  { key: 'mining',       label: 'Mining / Coal-Seam' },
  { key: 'agricultural', label: 'Stubble Burning' },
  { key: 'flare',        label: 'Flare / Routine Heat' },
];

/** @deprecated — no longer needed, kept for any leftover imports */
export const EMOJI_FONT = '';
export const FIRE_CLASS_EMOJI: Record<FireClassKey, string> = {
  industrial: '', wildfire: '', mining: '', agricultural: '', flare: '',
};
