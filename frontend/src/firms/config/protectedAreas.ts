/**
 * Major fire-relevant protected areas in India (approx. centroid + radius).
 * Mirrors the FIRMS "Protected Areas" overlay at a demo fidelity — swap for a
 * WDPA GeoJSON when available.
 */
export interface ProtectedArea {
  id: string;
  name: string;
  category: 'Tiger Reserve' | 'National Park' | 'Wildlife Sanctuary' | 'Biosphere Reserve';
  lat: number;
  lon: number;
  radiusKm: number;
}

export const PROTECTED_AREAS: ProtectedArea[] = [
  { id: 'similipal', name: 'Similipal', category: 'Biosphere Reserve', lat: 21.62, lon: 86.4, radiusKm: 45 },
  { id: 'kanha', name: 'Kanha', category: 'Tiger Reserve', lat: 22.33, lon: 80.61, radiusKm: 40 },
  { id: 'bandhavgarh', name: 'Bandhavgarh', category: 'Tiger Reserve', lat: 23.7, lon: 81.03, radiusKm: 28 },
  { id: 'pench', name: 'Pench', category: 'Tiger Reserve', lat: 21.67, lon: 79.29, radiusKm: 25 },
  { id: 'nagarhole', name: 'Nagarhole', category: 'National Park', lat: 12.0, lon: 76.13, radiusKm: 26 },
  { id: 'bandipur', name: 'Bandipur', category: 'Tiger Reserve', lat: 11.71, lon: 76.53, radiusKm: 24 },
  { id: 'periyar', name: 'Periyar', category: 'Tiger Reserve', lat: 9.47, lon: 77.24, radiusKm: 24 },
  { id: 'satpura', name: 'Satpura', category: 'Tiger Reserve', lat: 22.5, lon: 78.43, radiusKm: 35 },
  { id: 'kaziranga', name: 'Kaziranga', category: 'National Park', lat: 26.58, lon: 93.17, radiusKm: 22 },
  { id: 'namdapha', name: 'Namdapha', category: 'National Park', lat: 27.5, lon: 96.4, radiusKm: 32 },
  { id: 'ranthambore', name: 'Ranthambore', category: 'Tiger Reserve', lat: 26.02, lon: 76.5, radiusKm: 22 },
  { id: 'gir', name: 'Gir', category: 'National Park', lat: 21.13, lon: 70.8, radiusKm: 26 },
  { id: 'simlipal-core', name: 'Sunabeda', category: 'Wildlife Sanctuary', lat: 20.1, lon: 82.3, radiusKm: 20 },
  { id: 'palamau', name: 'Palamau', category: 'Tiger Reserve', lat: 23.62, lon: 84.05, radiusKm: 24 },
  { id: 'melghat', name: 'Melghat', category: 'Tiger Reserve', lat: 21.45, lon: 77.2, radiusKm: 30 },
];
