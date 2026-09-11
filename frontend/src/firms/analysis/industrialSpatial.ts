import industrialData from '../../data/india_industrial_polygons_tagged.json';
import { haversine_m } from '../../utils/math';

export interface IndustrialPolygonMatch {
  id?: string;
  name?: string;
  coal_industrial_zone?: string;
  area_sqkm?: number;
  industrial?: string;
  centroid_lat?: number;
  centroid_lon?: number;
}

interface IndexedRing {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  coords: [number, number][]; // [lon, lat]
  props: IndustrialPolygonMatch;
}

const INDEXED_RINGS: IndexedRing[] = [];
const CENTROIDS: { lat: number; lon: number; props: IndustrialPolygonMatch }[] = [];

// Pre-index rings on module load
try {
  const features = (industrialData as any).features || [];
  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const props = (feat.properties || {}) as IndustrialPolygonMatch;
    const gtype = geom.type;
    const coords = geom.coordinates;

    if (props.centroid_lat != null && props.centroid_lon != null) {
      CENTROIDS.push({
        lat: props.centroid_lat,
        lon: props.centroid_lon,
        props,
      });
    }

    const rings: [number, number][][] = [];
    if (gtype === 'Polygon' && coords) {
      rings.push(coords[0]);
    } else if (gtype === 'MultiPolygon' && coords) {
      for (const poly of coords) {
        if (poly && poly[0]) rings.push(poly[0]);
      }
    }

    for (const ring of rings) {
      if (ring.length < 3) continue;
      let minLon = Infinity;
      let maxLon = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      INDEXED_RINGS.push({
        minLon,
        minLat,
        maxLon,
        maxLat,
        coords: ring,
        props,
      });
    }
  }
} catch (e) {
  console.warn('Failed to pre-index industrial polygons:', e);
}

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  const n = ring.length;
  let inside = false;
  if (n < 3) return false;

  let p1x = ring[0][0];
  let p1y = ring[0][1];

  for (let i = 1; i <= n; i++) {
    const p2x = ring[i % n][0];
    const p2y = ring[i % n][1];

    if (y > Math.min(p1y, p2y)) {
      if (y <= Math.max(p1y, p2y)) {
        if (x <= Math.max(p1x, p2x)) {
          let xinters = p1x;
          if (p1y !== p2y) {
            xinters = ((y - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
          }
          if (p1x === p2x || x <= xinters) {
            inside = !inside;
          }
        }
      }
    }
    p1x = p2x;
    p1y = p2y;
  }
  return inside;
}

/**
 * Determine if (lat, lon) falls inside any curated industrial/coal polygon.
 * Runs in < 0.05 ms using bounding-box prefiltering + ray-casting.
 */
export function matchIndustrialPolygon(lat: number, lon: number): IndustrialPolygonMatch | null {
  for (const ring of INDEXED_RINGS) {
    if (lon >= ring.minLon && lon <= ring.maxLon && lat >= ring.minLat && lat <= ring.maxLat) {
      if (pointInRing(lon, lat, ring.coords)) {
        return ring.props;
      }
    }
  }
  return null;
}

/**
 * Approximate distance in meters to nearest industrial facility/polygon centroid.
 */
export function distanceToNearestIndustrialM(lat: number, lon: number): { distanceM: number; match: IndustrialPolygonMatch | null } {
  const directMatch = matchIndustrialPolygon(lat, lon);
  if (directMatch) {
    return { distanceM: 0, match: directMatch };
  }

  let minDistance = Infinity;
  let bestProps: IndustrialPolygonMatch | null = null;

  for (const c of CENTROIDS) {
    const d = haversine_m(lat, lon, c.lat, c.lon);
    if (d < minDistance) {
      minDistance = d;
      bestProps = c.props;
    }
  }

  return { distanceM: minDistance, match: bestProps };
}
