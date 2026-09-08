/**
 * Best-effort map screenshot: composites the visible Leaflet tile <img> elements,
 * the fire canvas and any overlay canvases onto one canvas, then triggers a
 * download. Requires CORS-clean tiles (CARTO / OSM / Esri all send the header).
 * Falls back to a helpful message if the browser taints the canvas.
 */
export async function captureMap(container: HTMLElement | null): Promise<void> {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const out = document.createElement('canvas');
  out.width = rect.width;
  out.height = rect.height;
  const ctx = out.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0b1a24';
  ctx.fillRect(0, 0, out.width, out.height);

  const tiles = Array.from(container.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded'));
  for (const img of tiles) {
    try {
      const b = img.getBoundingClientRect();
      ctx.globalAlpha = Number(img.style.opacity || '1');
      ctx.drawImage(img, b.left - rect.left, b.top - rect.top, b.width, b.height);
    } catch {
      /* skip tainted tile */
    }
  }
  ctx.globalAlpha = 1;

  for (const cnv of Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas'))) {
    if (cnv === out) continue;
    try {
      const b = cnv.getBoundingClientRect();
      ctx.drawImage(cnv, b.left - rect.left, b.top - rect.top, b.width, b.height);
    } catch {
      /* skip */
    }
  }

  try {
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `jvalyx-firms-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
  } catch {
    // Canvas tainted — tell the user how to grab it manually.
    // eslint-disable-next-line no-alert
    alert('Screenshot blocked by tile CORS. Use your OS capture (Win + Shift + S).');
  }
}
