export interface FIRMSRecord {
  latitude: number;
  longitude: number;
  bright_ti4: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: string;
  bright_ti5: number;
  frp: number;
  daynight: string;
}

// Known industrial and critical installations in India for automatic spatial matching
export const KNOWN_FACILITIES = [
  {
    id: 'fac-jam-01',
    name: 'Jamnagar Refinery & Petrochemical Complex',
    type: 'Petrochemical Refining',
    lat: 22.378,
    lon: 69.865,
    radius_m: 3500,
    baseline_frp_mean: 48.0,
    baseline_frp_std: 9.5
  },
  {
    id: 'fac-mrpl-01',
    name: 'MRPL Mangalore Petrochemicals',
    type: 'Petrochemical Refining & Storage',
    lat: 12.978,
    lon: 74.838,
    radius_m: 2500,
    baseline_frp_mean: 38.4,
    baseline_frp_std: 7.2
  },
  {
    id: 'fac-pan-01',
    name: 'IOCL Panipat Refinery & Naphtha Cracker',
    type: 'Petrochemical Refining',
    lat: 29.475,
    lon: 76.885,
    radius_m: 3000,
    baseline_frp_mean: 42.0,
    baseline_frp_std: 8.0
  },
  {
    id: 'fac-kor-01',
    name: 'Korba Super Thermal Power & Coal Storage',
    type: 'Coal-Fired Power & Coal Yard',
    lat: 22.355,
    lon: 82.720,
    radius_m: 2800,
    baseline_frp_mean: 22.0,
    baseline_frp_std: 5.5
  },
  {
    id: 'fac-vis-01',
    name: 'HPCL Visakhapatnam Refinery',
    type: 'Petrochemical Refining',
    lat: 17.705,
    lon: 83.255,
    radius_m: 2200,
    baseline_frp_mean: 35.0,
    baseline_frp_std: 6.5
  }
];
