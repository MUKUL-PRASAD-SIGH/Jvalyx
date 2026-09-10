# Jvalyx CatBoost Model Artifacts

This folder is the source of truth for the CatBoost artifacts used by the Jvalyx thermal-event pipeline.

## Decision

| Purpose | Artifact |
| --- | --- |
| **Active production inference** | `model_stage2.cbm` |
| Training logs, comparison, and provenance | All other artifacts in this folder |

`model_stage2.cbm` is the final multi-class classifier and is the only model currently selected for inference. Do not substitute another artifact without updating the inference contract and validating the output classes.

## Artifact inventory

| Artifact | Role | Use for inference? |
| --- | --- | --- |
| `model_stage2.cbm` | Stage 2 multi-class classifier | **Yes** |
| `model_stage1.cbm` | Stage 1 binary training artifact | No, logs only |
| `model_stage1b.cbm` | Stage 1B binary artifact with class weights | No, logs only |
| `catboost_model.cbm` | Earlier or generic CatBoost export | No, logs only |
| `catboost_model (1).cbm` | Duplicate or earlier CatBoost export | No, logs only |

## Training snapshots

### Stage 1: Binary classifier

| Setting | Value |
| --- | --- |
| Artifact | `model_stage1.cbm` |
| Iterations | 500 |
| Learning rate | 0.1 |
| Depth | 5 |
| Loss function | Logloss |
| Evaluation metric | Accuracy |
| Task type | GPU |
| Random seed | 42 |
| Early stopping rounds | 50 |
| Best iteration | 1 |
| Best validation score | 1.0 |

### Stage 1B: Weighted binary classifier

| Setting | Value |
| --- | --- |
| Artifact | `model_stage1b.cbm` |
| Iterations | 300 |
| Learning rate | 0.1 |
| Depth | 4 |
| Loss function | Logloss |
| Evaluation metric | Accuracy |
| Task type | GPU |
| Random seed | 42 |
| Early stopping rounds | 30 |
| Best iteration | 0 |
| Best validation score | 1.0 |
| Class weights | `{'0': 0.6908213762956915, '1': 1.810125756627009}` |

### Stage 2: Multi-class classifier

| Setting | Value |
| --- | --- |
| Artifact | `model_stage2.cbm` |
| Iterations | 1200 |
| Learning rate | 0.06 |
| Depth | 6 |
| Loss function | MultiClass |
| Evaluation metric | MultiClass |
| Task type | GPU |
| Random seed | 42 |
| Early stopping rounds | 50 |
| Best iteration | 286 |
| Best validation score | 0.00963640578938656 |
| Class weights | `{'2': 90.42001177478056, '3': 0.44886814337625514, '4': 1.394939876822418}` |

## Input contract

Pass features to `model_stage2.cbm` in this exact order. Feature names, order, types, and missing-value handling must remain aligned with the training data.

| # | Feature | Type |
| ---: | --- | --- |
| 1 | `bright_ti4` | Numeric |
| 2 | `bright_ti5` | Numeric |
| 3 | `temp_ratio` | Numeric |
| 4 | `frp` | Numeric |
| 5 | `scan` | Numeric |
| 6 | `track` | Numeric |
| 7 | `daynight` | Numeric, binary 0/1 |
| 8 | `is_in_industrial_polygon` | Numeric, binary 0/1 |
| 9 | `distance_to_industrial_m` | Numeric |
| 10 | `facility_type` | Categorical |
| 11 | `lulc_class` | Categorical |
| 12 | `lulc_entropy_500m` | Numeric |
| 13 | `persistence_score` | Numeric |
| 14 | `baseline_frp_mean` | Numeric |
| 15 | `baseline_frp_std` | Numeric |
| 16 | `frp_z_score` | Numeric |
| 17 | `centroid_drift_velocity` | Numeric |
| 18 | `cluster_pixel_count` | Numeric |
| 19 | `facility_frp_zscore` | Numeric |
| 20 | `swir_nir_ratio` | Numeric, optional and may be all-NaN for v1 |
| 21 | `delta_nbr` | Numeric, optional and may be all-NaN for v1 |
| 22 | `delta_ndvi` | Numeric, optional and may be all-NaN for v1 |
| 23 | `thermal_plume_spread` | Numeric, optional and may be all-NaN for v1 |
| 24 | `sensor_agreement_state` | Categorical |
| 25 | `sensor_count` | Numeric |
| 26 | `data_quality_flag` | Categorical, or binary if defined that way in preprocessing |

### Categorical features

The CatBoost categorical feature columns are:

- `facility_type`
- `lulc_class`
- `sensor_agreement_state`
- `data_quality_flag`, when represented categorically

Keep categorical values as strings. `data_quality_flag` may instead be encoded as binary when that is how preprocessing defines it.

### Optional v1 features

The following features may be all-NaN for v1 and must still be included in the expected feature positions:

- `swir_nir_ratio`
- `delta_nbr`
- `delta_ndvi`
- `thermal_plume_spread`

## Inference checklist

1. Load `model_stage2.cbm`.
2. Build all 26 features in the documented order.
3. Preserve categorical values as strings and use the training-time missing-value handling.
4. Keep the other artifacts available for logs and comparison only.