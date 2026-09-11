import type { Scenario, FireClassInfo } from '../types';
import { generatePlumeCorridor } from '../utils/math';

export const FIRE_CLASSES: Record<number, FireClassInfo> = {
  1: {
    id: 1,
    name: 'Accidental Industrial Fire / Explosion',
    description: 'Catastrophic facility fire, petrochemical storage blaze, or explosion',
    color: '#f43f5e',
    defaultRoute: 'CRITICAL'
  },
  2: {
    id: 2,
    name: 'Wildfire or Forest Fire',
    description: 'Uncontrolled vegetation fire exhibiting spatial spread and perimeter drift',
    color: '#f97316',
    defaultRoute: 'CRITICAL'
  },
  3: {
    id: 3,
    name: 'Uncontrolled Mining / Coal-Seam Fire',
    description: 'Subsurface or open-pit coal seam fire intersecting mining lease boundaries',
    color: '#a855f7',
    defaultRoute: 'UNCERTAIN'
  },
  4: {
    id: 4,
    name: 'Agricultural / Stubble Burning',
    description: 'Seasonal crop residue burning over agricultural cropland parcels',
    color: '#eab308',
    defaultRoute: 'NORMAL'
  },
  5: {
    id: 5,
    name: 'Persistent Flare / Routine Heat',
    description: 'Normal gas flaring or kiln operation consistent with historical baselines',
    color: '#38bdf8',
    defaultRoute: 'NORMAL'
  }
};

export const SCENARIOS: Scenario[] = [
  // ==========================================
  // SCENARIO 1: INDUSTRIAL ESCALATION (Signature Demo)
  // ==========================================
  {
    id: 'industrial_escalation',
    name: 'Mangalore Refinery — Thermal Escalation',
    subtitle: 'Routine Gas Flare transitioning into Crude Tank Farm Surge',
    category: 'Class 1 Escalation',
    initialRouteState: 'NORMAL',
    facility: {
      id: 'fac-mrpl-01',
      name: 'MRPL Petrochemical Complex',
      type: 'Petrochemical Refining & Storage',
      coordinates: [12.978, 74.838],
      polygon: [
        [12.986, 74.830],
        [12.986, 74.848],
        [12.970, 74.848],
        [12.970, 74.830],
        [12.986, 74.830]
      ],
      baselineFRPMean: 38.4,
      baselineFRPStd: 7.2,
      expectedPersistence: 0.92,
      typicalHotspots: 1,
      nearbySettlements: ['Kulai Settlement', 'Baikampady Township', 'Hosabettu'],
      nearbyAssets: [
        {
          id: 'ast-01',
          name: 'Crude Oil Storage Tank Farm 4',
          type: 'tank_farm',
          latitude: 12.979,
          longitude: 74.842,
          distance_m: 420,
          criticality_weight: 0.95
        },
        {
          id: 'ast-02',
          name: 'National Highway 66 Corridor',
          type: 'pipeline',
          latitude: 12.974,
          longitude: 74.831,
          distance_m: 850,
          criticality_weight: 0.70
        },
        {
          id: 'ast-03',
          name: 'Baikampady Residential Sector',
          type: 'settlement',
          latitude: 12.969,
          longitude: 74.845,
          distance_m: 1250,
          population_at_risk: 14500,
          criticality_weight: 0.90
        }
      ]
    },
    frames: [
      // Frame 0: Routine operations
      {
        timestamp: '2026-09-05T10:15:00Z',
        frameIndex: 0,
        label: 'T+00m: Baseline Operational Flaring',
        description: 'Single thermal source at the primary flare stack. Radiation within normal historical distribution.',
        fusedEvent: {
          event_id: 'evt-esc-001',
          created_at: '2026-09-05T10:15:00Z',
          latitude: 12.978,
          longitude: 74.838,
          detections: [
            {
              detection_id: 'det-viirs-01',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:14:22Z',
              latitude: 12.9782,
              longitude: 74.8379,
              frp_mw: 41.2,
              bright_ti4_k: 342.5,
              bright_ti5_k: 295.1,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'high',
              quality_score: 0.95
            }
          ],
          sensor_count: 1,
          sensor_agreement_state: 'single_sensor',
          data_quality_flag: 'NOMINAL',
          data_quality_score: 0.95,
          facility_id: 'fac-mrpl-01',
          facility_name: 'MRPL Petrochemical Complex',
          facility_type: 'Petrochemical Refining',
          lulc_class: 'industrial_developed',
          lulc_entropy_500m: 1.84,
          is_in_industrial_polygon: true,
          is_mine_polygon: false,
          distance_to_industrial_m: 0,
          persistence_score: 0.91,
          baseline_frp_mean: 38.4,
          baseline_frp_std: 7.2,
          frp_z_score: 0.39,
          facility_frp_zscore: 0.39,
          cluster_pixel_count: 1,
          centroid_drift_velocity_mph: 0.0,
          frp_trend_mw_per_hour: 1.2,
          route_state: 'NORMAL'
        },
        decision: {
          event_id: 'evt-esc-001',
          class_id: 5,
          class_name: 'Persistent Flare / Routine Heat',
          class_probabilities: { 1: 0.05, 2: 0.02, 3: 0.01, 4: 0.02, 5: 0.90 },
          anomaly_score: 0.12,
          route_state: 'NORMAL',
          risk_score: 18,
          confidence_state: 'high',
          explanation: [
            'Hotspot matches persistent flare location with nominal FRP (Z = 0.39).',
            'Single pixel detection within designated facility boundary.',
            'Radiation power within historical ±1σ operational limits.'
          ],
          recommended_action: 'Routine tracking against 90-day baseline. No operator escalation.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 18, severity: 0.12, anomaly: 0.05, spread: 0.08, exposure: 0.20 },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 37.8, upper1Sigma: 45.0, upper3Sigma: 59.4, observedFRP: 36.2 },
          { day: 'Day -60', mean: 38.1, upper1Sigma: 45.3, upper3Sigma: 59.7, observedFRP: 40.1 },
          { day: 'Day -40', mean: 38.3, upper1Sigma: 45.5, upper3Sigma: 59.9, observedFRP: 39.5 },
          { day: 'Day -20', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 37.8 },
          { day: 'Current', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 41.2 }
        ]
      },

      // Frame 1: Surge onset
      {
        timestamp: '2026-09-05T10:35:00Z',
        frameIndex: 1,
        label: 'T+20m: Multi-Pixel Surge Detected (Cloud Attenuated)',
        description: 'Facility FRP surges under coastal cloud attenuation. Ambiguous thermal signal (quality 0.42, P(industrial)=0.40) routes to human verification before automated critical escalation.',
        fusedEvent: {
          event_id: 'evt-esc-001',
          created_at: '2026-09-05T10:35:00Z',
          latitude: 12.9785,
          longitude: 74.8395,
          detections: [
            {
              detection_id: 'det-viirs-02a',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:34:10Z',
              latitude: 12.9782,
              longitude: 74.8380,
              frp_mw: 62.4,
              bright_ti4_k: 368.1,
              bright_ti5_k: 298.4,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'nominal',
              cloud_flag: true,
              quality_score: 0.42
            },
            {
              detection_id: 'det-viirs-02b',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:34:10Z',
              latitude: 12.9788,
              longitude: 74.8410,
              frp_mw: 49.8,
              bright_ti4_k: 361.0,
              bright_ti5_k: 297.8,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'nominal',
              cloud_flag: true,
              quality_score: 0.42
            },
            {
              detection_id: 'det-modis-01',
              sensor: 'MODIS',
              timestamp: '2026-09-05T10:33:45Z',
              latitude: 12.9790,
              longitude: 74.8398,
              frp_mw: 98.0,
              bright_ti4_k: 350.2,
              bright_ti5_k: 299.1,
              scan_km: 1.0,
              track_km: 1.0,
              confidence: 'nominal',
              cloud_flag: true,
              quality_score: 0.42
            }
          ],
          sensor_count: 2,
          sensor_agreement_state: 'multi_sensor_cross_confirmed',
          data_quality_flag: 'DEGRADED',
          data_quality_score: 0.42,
          facility_id: 'fac-mrpl-01',
          facility_name: 'MRPL Petrochemical Complex',
          facility_type: 'Petrochemical Refining',
          lulc_class: 'industrial_developed',
          lulc_entropy_500m: 1.84,
          is_in_industrial_polygon: true,
          is_mine_polygon: false,
          distance_to_industrial_m: 0,
          persistence_score: 0.91,
          baseline_frp_mean: 38.4,
          baseline_frp_std: 7.2,
          frp_z_score: 10.22,
          facility_frp_zscore: 10.22,
          cluster_pixel_count: 3,
          centroid_drift_velocity_mph: 240.0,
          frp_trend_mw_per_hour: 212.4,
          route_state: 'UNCERTAIN'
        },
        decision: {
          event_id: 'evt-esc-001',
          class_id: 5,
          class_name: 'Persistent Flare / Routine Heat',
          class_probabilities: { 1: 0.40, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.45 },
          anomaly_score: 0.72,
          route_state: 'UNCERTAIN',
          risk_score: 54,
          confidence_state: 'medium',
          explanation: [
            'Thermal surge observed under partial coastal cloud attenuation (data quality 0.42).',
            'Class probabilities ambiguous: P(industrial)=0.40, P(routine flare)=0.45 — below autonomous threshold.',
            'Deterministic policy routes to UNCERTAIN for operator verification before emergency escalation.'
          ],
          recommended_action: 'OPERATOR VERIFICATION REQUIRED: Ambiguous flare surge under cloud cover. Verify on-site cameras before activating full evacuation.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 84, severity: 0.85, anomaly: 0.91, spread: 0.68, exposure: 0.78 },
        tactical: {
          segmentationMask: {
            type: 'Polygon',
            coordinates: [
              [
                [12.9775, 74.8375],
                [12.9805, 74.8385],
                [12.9798, 74.8430],
                [12.9765, 74.8420],
                [12.9775, 74.8375]
              ]
            ],
            burnAreaM2: 28400,
            smokeAreaM2: 84000
          },
          plumeCorridor: generatePlumeCorridor([12.9785, 74.8395], 6.5, 135),
          affectedAssets: [
            {
              id: 'ast-01',
              name: 'Crude Oil Storage Tank Farm 4',
              type: 'tank_farm',
              latitude: 12.979,
              longitude: 74.842,
              distance_m: 180,
              criticality_weight: 0.95
            },
            {
              id: 'ast-03',
              name: 'Baikampady Residential Sector',
              type: 'settlement',
              latitude: 12.969,
              longitude: 74.845,
              distance_m: 1100,
              population_at_risk: 14500,
              criticality_weight: 0.90
            }
          ],
          swir_nir_ratio: 1.48,
          delta_nbr: 0.42,
          delta_ndvi: -0.31
        },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 37.8, upper1Sigma: 45.0, upper3Sigma: 59.4, observedFRP: 36.2 },
          { day: 'Day -60', mean: 38.1, upper1Sigma: 45.3, upper3Sigma: 59.7, observedFRP: 40.1 },
          { day: 'Day -40', mean: 38.3, upper1Sigma: 45.5, upper3Sigma: 59.9, observedFRP: 39.5 },
          { day: 'Day -20', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 37.8 },
          { day: 'Current', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 112.2 }
        ]
      },

      // Frame 2: Full Emergency Escalation
      {
        timestamp: '2026-09-05T10:55:00Z',
        frameIndex: 2,
        label: 'T+40m: Full Petrochemical Emergency',
        description: 'Severe escalation: 290 MW thermal release. Heavy smoke plume pushing south-southeast toward residential zones.',
        fusedEvent: {
          event_id: 'evt-esc-001',
          created_at: '2026-09-05T10:55:00Z',
          latitude: 12.9792,
          longitude: 74.8415,
          detections: [
            {
              detection_id: 'det-viirs-03a',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:54:10Z',
              latitude: 12.9785,
              longitude: 74.8385,
              frp_mw: 95.0,
              bright_ti4_k: 375.0,
              bright_ti5_k: 308.2,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'high',
              quality_score: 0.95
            },
            {
              detection_id: 'det-viirs-03b',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:54:10Z',
              latitude: 12.9795,
              longitude: 74.8425,
              frp_mw: 115.0,
              bright_ti4_k: 380.5,
              bright_ti5_k: 312.0,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'high',
              quality_score: 0.95
            },
            {
              detection_id: 'det-viirs-03c',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T10:54:10Z',
              latitude: 12.9802,
              longitude: 74.8440,
              frp_mw: 80.0,
              bright_ti4_k: 369.0,
              bright_ti5_k: 304.5,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'high',
              quality_score: 0.95
            },
            {
              detection_id: 'det-modis-02',
              sensor: 'MODIS',
              timestamp: '2026-09-05T10:53:15Z',
              latitude: 12.9790,
              longitude: 74.8410,
              frp_mw: 285.0,
              bright_ti4_k: 362.4,
              bright_ti5_k: 305.2,
              scan_km: 1.0,
              track_km: 1.0,
              confidence: 'high',
              quality_score: 0.90
            }
          ],
          sensor_count: 2,
          sensor_agreement_state: 'multi_sensor_cross_confirmed',
          data_quality_flag: 'NOMINAL',
          data_quality_score: 0.95,
          facility_id: 'fac-mrpl-01',
          facility_name: 'MRPL Petrochemical Complex',
          facility_type: 'Petrochemical Refining',
          lulc_class: 'industrial_developed',
          lulc_entropy_500m: 1.84,
          is_in_industrial_polygon: true,
          is_mine_polygon: false,
          distance_to_industrial_m: 0,
          persistence_score: 0.91,
          baseline_frp_mean: 38.4,
          baseline_frp_std: 7.2,
          frp_z_score: 34.94,
          facility_frp_zscore: 34.94,
          cluster_pixel_count: 6,
          centroid_drift_velocity_mph: 310.0,
          frp_trend_mw_per_hour: 440.0,
          route_state: 'CRITICAL'
        },
        decision: {
          event_id: 'evt-esc-001',
          class_id: 1,
          class_name: 'Accidental Industrial Fire / Explosion',
          class_probabilities: { 1: 0.95, 2: 0.03, 3: 0.01, 4: 0.00, 5: 0.01 },
          anomaly_score: 0.98,
          route_state: 'CRITICAL',
          risk_score: 96,
          confidence_state: 'high',
          explanation: [
            'Facility FRP is 34.9σ above baseline (290 MW vs 38.4 MW normal).',
            '6 linked thermal pixels indicate active multi-tank fire involvement.',
            'Downwind smoke/thermal plume intersecting Baikampady Township corridor.',
            'Isolation Forest anomaly score at maximum percentile (0.98).'
          ],
          recommended_action: 'CRITICAL EMERGENCY: Issue regional downwind shelter/evacuation advisory. Dispatch industrial firefighting units.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 96, severity: 0.96, anomaly: 0.98, spread: 0.88, exposure: 0.94 },
        tactical: {
          segmentationMask: {
            type: 'Polygon',
            coordinates: [
              [
                [12.9760, 74.8360],
                [12.9825, 74.8380],
                [12.9820, 74.8465],
                [12.9750, 74.8445],
                [12.9760, 74.8360]
              ]
            ],
            burnAreaM2: 78200,
            smokeAreaM2: 245000
          },
          plumeCorridor: generatePlumeCorridor([12.9792, 74.8415], 8.2, 142),
          affectedAssets: [
            {
              id: 'ast-01',
              name: 'Crude Oil Storage Tank Farm 4',
              type: 'tank_farm',
              latitude: 12.979,
              longitude: 74.842,
              distance_m: 50,
              criticality_weight: 1.0
            },
            {
              id: 'ast-03',
              name: 'Baikampady Residential Sector',
              type: 'settlement',
              latitude: 12.969,
              longitude: 74.845,
              distance_m: 950,
              population_at_risk: 14500,
              criticality_weight: 0.95
            },
            {
              id: 'ast-02',
              name: 'National Highway 66 Corridor',
              type: 'pipeline',
              latitude: 12.974,
              longitude: 74.831,
              distance_m: 620,
              criticality_weight: 0.75
            }
          ],
          swir_nir_ratio: 2.15,
          delta_nbr: 0.68,
          delta_ndvi: -0.52
        },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 37.8, upper1Sigma: 45.0, upper3Sigma: 59.4, observedFRP: 36.2 },
          { day: 'Day -60', mean: 38.1, upper1Sigma: 45.3, upper3Sigma: 59.7, observedFRP: 40.1 },
          { day: 'Day -40', mean: 38.3, upper1Sigma: 45.5, upper3Sigma: 59.9, observedFRP: 39.5 },
          { day: 'Day -20', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 37.8 },
          { day: 'Current', mean: 38.4, upper1Sigma: 45.6, upper3Sigma: 60.0, observedFRP: 290.0 }
        ]
      }
    ]
  },

  // ==========================================
  // SCENARIO 2: PERSISTENT FLARE (Class 5 - Routine)
  // ==========================================
  {
    id: 'persistent_flare',
    name: 'Jamnagar Refinery — Routine Gas Flaring',
    subtitle: 'High-persistence thermal baseline with zero abnormal growth',
    category: 'Class 5 Routine',
    initialRouteState: 'NORMAL',
    facility: {
      id: 'fac-ril-01',
      name: 'Jamnagar Refining Hub',
      type: 'Mega Petrochemical Complex',
      coordinates: [22.378, 69.865],
      polygon: [
        [22.392, 69.850],
        [22.392, 69.880],
        [22.365, 69.880],
        [22.365, 69.850],
        [22.392, 69.850]
      ],
      baselineFRPMean: 48.0,
      baselineFRPStd: 9.5,
      expectedPersistence: 0.96,
      typicalHotspots: 2,
      nearbySettlements: ['Moti Khavdi', 'Sikka Port Township'],
      nearbyAssets: [
        {
          id: 'ast-ril-01',
          name: 'Cracker Unit Flare Stack A',
          type: 'substation',
          latitude: 22.378,
          longitude: 69.865,
          distance_m: 50,
          criticality_weight: 0.50
        }
      ]
    },
    frames: [
      {
        timestamp: '2026-09-05T08:00:00Z',
        frameIndex: 0,
        label: 'T+00m: Routine Overpass Observation',
        description: 'Consistent thermal hotspot at elevated flare stack. Low variance, zero perimeter expansion.',
        fusedEvent: {
          event_id: 'evt-flr-001',
          created_at: '2026-09-05T08:00:00Z',
          latitude: 22.378,
          longitude: 69.865,
          detections: [
            {
              detection_id: 'det-viirs-flr',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T07:58:30Z',
              latitude: 22.3781,
              longitude: 69.8652,
              frp_mw: 46.5,
              bright_ti4_k: 348.0,
              bright_ti5_k: 298.0,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'high',
              quality_score: 0.98
            }
          ],
          sensor_count: 1,
          sensor_agreement_state: 'single_sensor',
          data_quality_flag: 'NOMINAL',
          data_quality_score: 0.98,
          facility_id: 'fac-ril-01',
          facility_name: 'Jamnagar Refining Hub',
          facility_type: 'Petrochemical Complex',
          lulc_class: 'industrial_developed',
          lulc_entropy_500m: 1.45,
          is_in_industrial_polygon: true,
          is_mine_polygon: false,
          distance_to_industrial_m: 0,
          persistence_score: 0.95,
          baseline_frp_mean: 48.0,
          baseline_frp_std: 9.5,
          frp_z_score: -0.16,
          facility_frp_zscore: -0.16,
          cluster_pixel_count: 1,
          centroid_drift_velocity_mph: 0.0,
          frp_trend_mw_per_hour: 0.2,
          route_state: 'NORMAL'
        },
        decision: {
          event_id: 'evt-flr-001',
          class_id: 5,
          class_name: 'Persistent Flare / Routine Heat',
          class_probabilities: { 1: 0.02, 2: 0.01, 3: 0.01, 4: 0.01, 5: 0.95 },
          anomaly_score: 0.08,
          route_state: 'NORMAL',
          risk_score: 14,
          confidence_state: 'high',
          explanation: [
            'Coordinate persistence is 0.95 across trailing 90-day window.',
            'Observed FRP (46.5 MW) matches historical mean (48.0 MW, Z = -0.16).',
            'Zero spatial expansion and static centroid position.'
          ],
          recommended_action: 'Routine tracking. No tactical dispatch required.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 14, severity: 0.08, anomaly: 0.04, spread: 0.05, exposure: 0.15 },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 47.5, upper1Sigma: 57.0, upper3Sigma: 76.0, observedFRP: 46.0 },
          { day: 'Day -60', mean: 47.9, upper1Sigma: 57.4, upper3Sigma: 76.4, observedFRP: 51.0 },
          { day: 'Day -40', mean: 48.0, upper1Sigma: 57.5, upper3Sigma: 76.5, observedFRP: 45.8 },
          { day: 'Day -20', mean: 48.0, upper1Sigma: 57.5, upper3Sigma: 76.5, observedFRP: 47.2 },
          { day: 'Current', mean: 48.0, upper1Sigma: 57.5, upper3Sigma: 76.5, observedFRP: 46.5 }
        ]
      }
    ]
  },

  // ==========================================
  // SCENARIO 3: WILDFIRE PERIMETER SPREAD (Class 2)
  // ==========================================
  {
    id: 'wildfire',
    name: 'Similipal Biosphere — Forest Fire Perimeter',
    subtitle: 'High drift velocity across dense tree-cover canopy',
    category: 'Class 2 Wildfire',
    initialRouteState: 'CRITICAL',
    facility: {
      id: 'fac-sim-01',
      name: 'Similipal Biosphere Forest Sector',
      type: 'National Protected Biosphere',
      coordinates: [21.850, 86.340],
      polygon: [
        [21.870, 86.320],
        [21.870, 86.365],
        [21.830, 86.365],
        [21.830, 86.320],
        [21.870, 86.320]
      ],
      baselineFRPMean: 4.2,
      baselineFRPStd: 2.1,
      expectedPersistence: 0.04,
      typicalHotspots: 0,
      nearbySettlements: ['Baripada Outskirts', 'Udala Tribal Hamlet'],
      nearbyAssets: [
        {
          id: 'ast-for-01',
          name: 'Similipal Core Reserve Boundary',
          type: 'substation',
          latitude: 21.845,
          longitude: 86.352,
          distance_m: 600,
          criticality_weight: 0.85
        }
      ]
    },
    frames: [
      {
        timestamp: '2026-09-05T13:40:00Z',
        frameIndex: 0,
        label: 'T+00m: Forest Fire Rapid Spread',
        description: 'Multi-pixel cluster spreading eastward with 1,250 m/h drift velocity over dense canopy.',
        fusedEvent: {
          event_id: 'evt-wld-001',
          created_at: '2026-09-05T13:40:00Z',
          latitude: 21.852,
          longitude: 86.342,
          detections: [
            {
              detection_id: 'det-v-wld1',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T13:38:10Z',
              latitude: 21.8520,
              longitude: 86.3420,
              frp_mw: 110.0,
              bright_ti4_k: 362.0,
              bright_ti5_k: 299.5,
              quality_score: 0.94
            },
            {
              detection_id: 'det-v-wld2',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T13:38:10Z',
              latitude: 21.8545,
              longitude: 86.3480,
              frp_mw: 95.0,
              bright_ti4_k: 358.0,
              bright_ti5_k: 298.0,
              quality_score: 0.94
            }
          ],
          sensor_count: 2,
          sensor_agreement_state: 'multi_sensor_cross_confirmed',
          data_quality_flag: 'NOMINAL',
          data_quality_score: 0.94,
          facility_id: null,
          facility_name: 'Similipal Biosphere Reserve',
          facility_type: 'Deciduous Forest Canopy',
          lulc_class: 'tree_cover',
          lulc_entropy_500m: 0.32,
          is_in_industrial_polygon: false,
          is_mine_polygon: false,
          distance_to_industrial_m: 35000,
          persistence_score: 0.03,
          baseline_frp_mean: 4.2,
          baseline_frp_std: 2.1,
          frp_z_score: 22.4,
          facility_frp_zscore: 0.0,
          cluster_pixel_count: 12,
          centroid_drift_velocity_mph: 1250.0,
          frp_trend_mw_per_hour: 180.0,
          route_state: 'CRITICAL'
        },
        decision: {
          event_id: 'evt-wld-001',
          class_id: 2,
          class_name: 'Wildfire or Forest Fire',
          class_probabilities: { 1: 0.04, 2: 0.89, 3: 0.02, 4: 0.04, 5: 0.01 },
          anomaly_score: 0.91,
          route_state: 'CRITICAL',
          risk_score: 87,
          confidence_state: 'high',
          explanation: [
            'LULC classified as dense tree_cover with low spatial entropy (0.32).',
            'Significant cluster perimeter: 12 connected thermal pixels active.',
            'High centroid drift velocity of 1,250 m/h indicates wind-driven spread.',
            'Zero historical coordinate persistence (new outbreak).'
          ],
          recommended_action: 'Dispatch state forestry wildfire rapid-response teams. Issue perimeter containment orders.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 87, severity: 0.82, anomaly: 0.88, spread: 0.95, exposure: 0.65 },
        tactical: {
          segmentationMask: {
            type: 'Polygon',
            coordinates: [
              [
                [21.848, 86.335],
                [21.858, 86.339],
                [21.856, 86.355],
                [21.846, 86.350],
                [21.848, 86.335]
              ]
            ],
            burnAreaM2: 320000,
            smokeAreaM2: 890000
          },
          plumeCorridor: generatePlumeCorridor([21.852, 86.342], 9.4, 75),
          affectedAssets: [
            {
              id: 'ast-for-01',
              name: 'Similipal Core Reserve Boundary',
              type: 'substation',
              latitude: 21.845,
              longitude: 86.352,
              distance_m: 600,
              criticality_weight: 0.85
            },
            {
              id: 'ast-for-02',
              name: 'Udala Tribal Settlement',
              type: 'settlement',
              latitude: 21.838,
              longitude: 86.368,
              distance_m: 2400,
              population_at_risk: 3200,
              criticality_weight: 0.70
            }
          ],
          swir_nir_ratio: 1.85,
          delta_nbr: 0.74,
          delta_ndvi: -0.62
        },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 4.2, upper1Sigma: 6.3, upper3Sigma: 10.5, observedFRP: 0.0 },
          { day: 'Day -60', mean: 4.2, upper1Sigma: 6.3, upper3Sigma: 10.5, observedFRP: 0.0 },
          { day: 'Day -40', mean: 4.2, upper1Sigma: 6.3, upper3Sigma: 10.5, observedFRP: 0.0 },
          { day: 'Day -20', mean: 4.2, upper1Sigma: 6.3, upper3Sigma: 10.5, observedFRP: 0.0 },
          { day: 'Current', mean: 4.2, upper1Sigma: 6.3, upper3Sigma: 10.5, observedFRP: 205.0 }
        ]
      }
    ]
  },

  // ==========================================
  // SCENARIO 4: SENSOR DISAGREEMENT (Operator Verification Demo)
  // ==========================================
  {
    id: 'sensor_disagreement',
    name: 'Korba Industrial Belt — Sensor Disagreement',
    subtitle: 'Cloud edge obstruction triggering verification routing instead of suppression',
    category: 'Verification Required',
    initialRouteState: 'UNCERTAIN',
    facility: {
      id: 'fac-korba-01',
      name: 'Korba Super Thermal Power & Coal Yard',
      type: 'Thermal Power & Coal Storage',
      coordinates: [22.355, 82.720],
      polygon: [
        [22.368, 82.705],
        [22.368, 82.735],
        [22.342, 82.735],
        [22.342, 82.705],
        [22.368, 82.705]
      ],
      baselineFRPMean: 22.0,
      baselineFRPStd: 5.5,
      expectedPersistence: 0.65,
      typicalHotspots: 1,
      nearbySettlements: ['Korba East Colony', 'Gevra Township'],
      nearbyAssets: [
        {
          id: 'ast-kor-01',
          name: 'Coal Washery Conveyor Belt 2',
          type: 'substation',
          latitude: 22.358,
          longitude: 82.724,
          distance_m: 350,
          criticality_weight: 0.80
        }
      ]
    },
    frames: [
      {
        timestamp: '2026-09-05T16:10:00Z',
        frameIndex: 0,
        label: 'T+00m: Conflicted Multi-Sensor Observation',
        description: 'VIIRS flags 68 MW anomaly, but has cloud obstruction. MODIS does not detect anomaly. Safety rule routes to UNCERTAIN.',
        fusedEvent: {
          event_id: 'evt-dis-001',
          created_at: '2026-09-05T16:10:00Z',
          latitude: 22.355,
          longitude: 82.720,
          detections: [
            {
              detection_id: 'det-viirs-cld',
              sensor: 'VIIRS',
              timestamp: '2026-09-05T16:08:20Z',
              latitude: 22.3552,
              longitude: 82.7204,
              frp_mw: 68.4,
              bright_ti4_k: 338.0,
              bright_ti5_k: 288.0,
              scan_km: 0.38,
              track_km: 0.38,
              confidence: 'low',
              cloud_flag: true,
              quality_score: 0.45
            }
          ],
          sensor_count: 1,
          sensor_agreement_state: 'disagreement',
          data_quality_flag: 'CLOUD_OBSTRUCTED',
          data_quality_score: 0.45,
          facility_id: 'fac-korba-01',
          facility_name: 'Korba Super Thermal Power',
          facility_type: 'Thermal Power Complex',
          lulc_class: 'industrial_developed',
          lulc_entropy_500m: 1.62,
          is_in_industrial_polygon: true,
          is_mine_polygon: false,
          distance_to_industrial_m: 0,
          persistence_score: 0.62,
          baseline_frp_mean: 22.0,
          baseline_frp_std: 5.5,
          frp_z_score: 4.43,
          facility_frp_zscore: 4.43,
          cluster_pixel_count: 1,
          centroid_drift_velocity_mph: 0.0,
          frp_trend_mw_per_hour: 4.5,
          route_state: 'UNCERTAIN',
          verification_status: 'unverified'
        },
        decision: {
          event_id: 'evt-dis-001',
          class_id: 1,
          class_name: 'Accidental Industrial Fire / Explosion',
          class_probabilities: { 1: 0.42, 2: 0.08, 3: 0.18, 4: 0.02, 5: 0.30 },
          anomaly_score: 0.76,
          route_state: 'UNCERTAIN',
          risk_score: 62,
          confidence_state: 'low',
          explanation: [
            'SAFETY ARBITRATION RULE TRIGGERED: Disagreement between sensors must NEVER be suppressed.',
            'VIIRS detects 68.4 MW anomaly, but detection suffers from cloud attenuation (q = 0.45).',
            'Concurrent MODIS pass had clear sky coverage without thermal trigger.',
            'Event routed to UNCERTAIN queue awaiting operator review or Sentinel-2 high-res tasking.'
          ],
          recommended_action: 'OPERATOR VERIFICATION REQUIRED: Inspect optical cloud overlay or task next satellite overpass.',
          model_version: 'triage-0.1.0',
          policy_version: 'arbitrator-0.1.0'
        },
        risk: { total: 62, severity: 0.58, anomaly: 0.76, spread: 0.35, exposure: 0.50 },
        historicalBaselineTimeline: [
          { day: 'Day -80', mean: 21.5, upper1Sigma: 27.0, upper3Sigma: 38.0, observedFRP: 20.2 },
          { day: 'Day -60', mean: 22.0, upper1Sigma: 27.5, upper3Sigma: 38.5, observedFRP: 24.1 },
          { day: 'Day -40', mean: 22.0, upper1Sigma: 27.5, upper3Sigma: 38.5, observedFRP: 21.0 },
          { day: 'Day -20', mean: 22.0, upper1Sigma: 27.5, upper3Sigma: 38.5, observedFRP: 23.5 },
          { day: 'Current', mean: 22.0, upper1Sigma: 27.5, upper3Sigma: 38.5, observedFRP: 68.4 }
        ]
      }
    ]
  }
];
