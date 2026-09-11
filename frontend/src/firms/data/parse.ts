import type { FireDetection, ProductId } from '../types';
import { normalizeConfidence } from '../config/products';

/** Parse an HHMM (or HMM / HHMMSS) acquisition-time token into hours+minutes. */
function parseAcqTime(raw: string): { h: number; m: number } {
  const digits = raw.replace(/\D/g, '').padStart(4, '0');
  return { h: Number(digits.slice(0, 2)), m: Number(digits.slice(2, 4)) };
}

function toUtcDate(acqDate: string, acqTime: string): Date {
  const [y, mo, d] = acqDate.split('-').map(Number);
  const { h, m } = parseAcqTime(acqTime);
  return new Date(Date.UTC(y, (mo || 1) - 1, d || 1, h, m));
}

/** Split a CSV line respecting simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a FIRMS country/archive CSV (VIIRS or MODIS column layout) into
 * normalized detections. `productId` tags every row; `sourceHint` disambiguates
 * MODIS Aqua vs Terra from the `satellite` column when needed.
 */
export function parseFirmsCsv(csv: string, productId: ProductId): FireDetection[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const cLat = idx('latitude');
  const cLon = idx('longitude');
  const cBright = idx('bright_ti4') !== -1 ? idx('bright_ti4') : idx('brightness');
  const cBright2 = idx('bright_ti5') !== -1 ? idx('bright_ti5') : idx('bright_t31');
  const cScan = idx('scan');
  const cTrack = idx('track');
  const cDate = idx('acq_date');
  const cTime = idx('acq_time');
  const cSat = idx('satellite');
  const cInst = idx('instrument');
  const cConf = idx('confidence');
  const cVer = idx('version');
  const cFrp = idx('frp');
  const cDn = idx('daynight');

  const rows: FireDetection[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length < 4) continue;
    const lat = Number(cells[cLat]);
    const lon = Number(cells[cLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const acqDate = cells[cDate]?.trim() || '';
    const acqTime = cells[cTime]?.trim() || '0000';
    const acquiredAt = acqDate ? toUtcDate(acqDate, acqTime) : new Date();
    const confidenceRaw = (cConf !== -1 ? cells[cConf] : 'n')?.trim() || 'n';

    rows.push({
      id: `${productId}-${lat.toFixed(4)}-${lon.toFixed(4)}-${acqDate}-${acqTime}`,
      latitude: lat,
      longitude: lon,
      brightness: cBright !== -1 ? Number(cells[cBright]) || 0 : 0,
      brightnessSecondary: cBright2 !== -1 ? Number(cells[cBright2]) || null : null,
      scan: cScan !== -1 ? Number(cells[cScan]) || 0 : 0,
      track: cTrack !== -1 ? Number(cells[cTrack]) || 0 : 0,
      frp: cFrp !== -1 ? Number(cells[cFrp]) || 0 : 0,
      acquiredAt,
      satellite: (cSat !== -1 ? cells[cSat] : '')?.trim() || '',
      instrument: (cInst !== -1 ? cells[cInst] : productId.split('_')[0])?.trim() || '',
      confidence: confidenceRaw,
      confidenceLevel: normalizeConfidence(confidenceRaw),
      version: (cVer !== -1 ? cells[cVer] : '')?.trim() || '',
      daynight: (cDn !== -1 ? cells[cDn] : 'D')?.trim().toUpperCase() === 'N' ? 'N' : 'D',
      productId,
    });
  }
  return rows;
}
