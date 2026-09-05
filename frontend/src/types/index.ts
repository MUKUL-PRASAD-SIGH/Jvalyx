export type FireClassId = 1 | 2 | 3 | 4 | 5;

export interface FireClassInfo {
  id: FireClassId;
  name: string;
  description: string;
  color: string;
  defaultRoute: RouteState;
}

export type SensorType = 'VIIRS' | 'MODIS' | 'INSAT' | 'REPLAY';

export type RouteState = 'NORMAL' | 'UNCERTAIN' | 'CRITICAL';

export type SensorAgreementState = 
  | 'full_agreement' 
  | 'temporally_confirmed_spatially_coarse' 
  | 'single_sensor_high_res' 
  | 'disagreement';

export interface Detection {
  detection_id: string;
  sensor: SensorType;
  timestamp: string;
  latitude: number;
  longitude: number;
  frp_mw: number;
  bright_ti4_k: number;
  bright_ti5_k: number;
  scan_km?: number;
  track_km?: number;
  confidence?: 'low' | 'nominal' | 'high';
  cloud_flag?: boolean;
  sun_glint_flag?: boolean;
  quality_score: number;
}

export interface FusedEvent {
  event_id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  detections: Detection[];
  sensor_count: number;
  sensor_agreement_state: SensorAgreementState;
  data_quality_flag: string;
  data_quality_score: number;
  facility_id: string | null;
  facility_name: string;
  facility_type: string;
  lulc_class: string;
  lulc_entropy_500m: number;
  is_in_industrial_polygon: boolean;
  is_mine_polygon: boolean;
  distance_to_industrial_m: number;
  persistence_score: number;
  baseline_frp_mean: number;
  baseline_frp_std: number;
  frp_z_score: number;
  facility_frp_zscore: number;
  cluster_pixel_count: number;
  centroid_drift_velocity_mph: number;
  frp_trend_mw_per_hour: number;
  route_state: RouteState;
  verification_status?: 'unverified' | 'human_confirmed' | 'human_rejected';
}

export interface DecisionOutput {
  event_id: string;
  class_id: FireClassId;
  class_name: string;
  class_probabilities: Record<FireClassId, number>;
  anomaly_score: number; // Isolation forest normalized [0, 1]
  route_state: RouteState;
  risk_score: number; // [0, 100]
  confidence_state: 'low' | 'moderate' | 'high';
  explanation: string[];
  recommended_action: string;
  model_version: string;
  policy_version: string;
}

export interface RiskBreakdown {
  total: number;
  severity: number;
  anomaly: number;
  spread: number;
  exposure: number;
}

export interface CriticalAsset {
  id: string;
  name: string;
  type: 'settlement' | 'tank_farm' | 'pipeline' | 'substation' | 'hospital';
  latitude: number;
  longitude: number;
  distance_m: number;
  population_at_risk?: number;
  criticality_weight: number;
}

export interface PlumeEnvelope {
  centerline: [number, number][];
  cone50: [number, number][]; // 50% probability polygon
  cone90: [number, number][]; // 90% probability polygon
  windSpeedMps: number;
  windDirectionDeg: number;
}

export interface TacticalData {
  segmentationMask?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: [number, number][][];
    burnAreaM2: number;
    smokeAreaM2: number;
  };
  plumeCorridor?: PlumeEnvelope;
  affectedAssets: CriticalAsset[];
  swir_nir_ratio?: number;
  delta_nbr?: number;
  delta_ndvi?: number;
}

export interface FacilityDigitalTwin {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  polygon: [number, number][];
  baselineFRPMean: number;
  baselineFRPStd: number;
  expectedPersistence: number;
  typicalHotspots: number;
  nearbySettlements: string[];
  nearbyAssets: CriticalAsset[];
}

export interface ScenarioFrame {
  timestamp: string;
  frameIndex: number;
  label: string;
  description: string;
  fusedEvent: FusedEvent;
  decision: DecisionOutput;
  risk: RiskBreakdown;
  tactical?: TacticalData;
  historicalBaselineTimeline: {
    day: string;
    mean: number;
    upper1Sigma: number;
    upper3Sigma: number;
    observedFRP: number;
  }[];
}

export interface Scenario {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  initialRouteState: RouteState;
  facility: FacilityDigitalTwin;
  frames: ScenarioFrame[];
}

export interface OperatorAuditEntry {
  id: string;
  eventId: string;
  timestamp: string;
  action: 'CONFIRM_CRITICAL' | 'REJECT_NORMAL' | 'SIMULATE_DEVIATION' | 'REQUEST_TACTICAL_PASS';
  operator: string;
  notes: string;
  priorRouteState: RouteState;
  newRouteState: RouteState;
}
