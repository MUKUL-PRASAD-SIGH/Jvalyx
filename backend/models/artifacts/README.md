# Jvalyx CatBoost Model Artifacts

This folder is the source of truth for the CatBoost artifacts used by the Jvalyx thermal-event pipeline.

## Decision

| Purpose | Artifact |
| --- | --- |
| **Active production inference** | `catboost_model.cbm` |
| Training logs, comparison, and provenance | All other artifacts in this folder |

`catboost_model.cbm` is the selected multi-class classifier for production inference. It is the only trained artifact that supports the complete 5-class thermal incident taxonomy (`[1, 2, 3, 4, 5]`) with 339 converged decision trees.

> [!IMPORTANT]
> **Prior recommendation note:** `model_stage2.cbm` was previously documented as the active inference model, but empirical testing confirmed it was trained exclusively on a subset of classes (`[2, 3, 4]`). It is incapable of predicting Class 1 (Accidental Industrial Fire / Explosion) or Class 5 (Persistent Flare / Routine Heat), and expects 16 features rather than the complete multi-class feature set.

---

## Artifact inventory

| Artifact | Classes Supported | Tree Count | Features | Role | Use for inference? |
| --- | :---: | :---: | :---: | --- | :---: |
| `catboost_model.cbm` | **`[1, 2, 3, 4, 5]`** | **339** | **12** | Full multi-class incident triage classifier | **Yes (Production)** |
| `model_stage2.cbm` | `[2, 3, 4]` | 287 | 16 | Stage 2 branch classifier (Wildfire, Mining, Agriculture only) | No (Class-restricted) |
| `model_stage1.cbm` | `[0, 1]` | 2 | 16 | Binary classifier (Early-stopped at iter 1; industrial threshold only) | No, logs only |
| `model_stage1b.cbm` | `[0, 1]` | 1 | 7 | Weighted binary stump (Early-stopped at iter 0) | No, logs only |

---

## Taxonomy alignment & benchmark summary

Evaluated against 20 benchmark signatures spanning industrial disasters, wildfires, coal-seam fires, crop burning, flares, and non-target background:

| Class | Meaning | `catboost_model.cbm` | `model_stage2.cbm` |
| :---: | --- | :---: | :---: |
| **1** | Accidental Industrial Fire / Explosion | **Supported (100% confidence)** | Unsupported (Forces Class 2) |
| **2** | Wildfire or Forest Fire | **Supported (100% confidence)** | Misclassifies as Class 3 |
| **3** | Uncontrolled Mining / Coal-Seam Fire | **Supported (100% confidence)** | Supported |
| **4** | Agricultural / Stubble Burning | **Supported (100% confidence)** | Supported |
| **5** | Persistent Flare / Routine Heat | **Supported (94.6% confidence)** | Unsupported (Forces Class 2) |

*(Note: Class 0 / background noise is filtered by the arbitration layer and quality scoring in `backend/pipeline/`, not by the multi-class model itself).*

---

## Training snapshots

### Production: Full multi-class classifier (`catboost_model.cbm`)

| Setting | Value |
| --- | --- |
| Artifact | `catboost_model.cbm` |
| Target classes | `[1, 2, 3, 4, 5]` |
| Iterations | 1200 (Best iteration: 339 trees retained) |
| Learning rate | 0.06 |
| Depth | 6 |
| Loss function | MultiClass |
| Evaluation metric | MultiClass |
| Task type | GPU |
| Random seed | 42 |
| Early stopping rounds | 50 |
| Class weights | `{'1': 18.35510332, '2': 11.29599229, '3': 0.2803810234, '4': 0.8713353266, '5': 7.005092155}` |

### Stage 2: Branch classifier (`model_stage2.cbm`)

| Setting | Value |
| --- | --- |
| Artifact | `model_stage2.cbm` |
| Target classes | `[2, 3, 4]` |
| Iterations | 1200 (Best iteration: 286) |
| Learning rate | 0.06 |
| Depth | 6 |
| Loss function | MultiClass |
| Best validation score | 0.0096364 |
| Class weights | `{'2': 90.42001177, '3': 0.44886814, '4': 1.39493988}` |

### Stage 1: Binary classifier (`model_stage1.cbm`)

| Setting | Value |
| --- | --- |
| Artifact | `model_stage1.cbm` |
| Target classes | `[0, 1]` |
| Iterations | 500 (Best iteration: 1 — 2 trees) |
| Learning rate | 0.1 |
| Depth | 5 |
| Loss function | Logloss |

### Stage 1B: Weighted binary classifier (`model_stage1b.cbm`)

| Setting | Value |
| --- | --- |
| Artifact | `model_stage1b.cbm` |
| Target classes | `[0, 1]` |
| Iterations | 300 (Best iteration: 0 — 1 tree stump) |
| Learning rate | 0.1 |
| Depth | 4 |
| Loss function | Logloss |
| Class weights | `{'0': 0.69082138, '1': 1.81012576}` |

---

## Input contract (`catboost_model.cbm`)

Pass features to `catboost_model.cbm` in this exact order. Feature names, order, and categorical string encodings must align with the training schema:

| # | Feature | Type | Description / Units |
| ---: | --- | --- | --- |
| 1 | `bright_ti4` | Numeric | VIIRS Band I-4 brightness temperature (Kelvin) |
| 2 | `bright_ti5` | Numeric | VIIRS Band I-5 brightness temperature (Kelvin) |
| 3 | `temp_ratio` | Numeric | Ratio of `bright_ti4 / bright_ti5` |
| 4 | `frp` | Numeric | Fire Radiative Power (MW) |
| 5 | `scan` | Numeric | Pixel scan dimension (km) |
| 6 | `track` | Numeric | Pixel track dimension (km) |
| 7 | `daynight` | Numeric | Overpass flag: `1` = Day, `0` = Night |
| 8 | `is_in_industrial_polygon` | Numeric | Binary: `1` if within mapped facility boundary, `0` otherwise |
| 9 | `distance_to_industrial_m` | Numeric | Euclidean distance to nearest industrial facility (meters) |
| 10 | `facility_type` | Categorical | Specific facility classification string (e.g. `'chemical'`, `'refinery'`, `'none'`) |
| 11 | `lulc_class` | Categorical | Land-use land-cover code string (`'10'`, `'20'`, `'30'`, `'40'`, `'50'`, `'60'`) |
| 12 | `lulc_entropy_500m` | Numeric | Shannon entropy of land-cover classes within a 500m radius |

### Categorical features

The CatBoost categorical feature columns are:
- `facility_type` (index 9)
- `lulc_class` (index 10)

Keep both values as standard strings (e.g. `facility_type="general_industrial"`, `lulc_class="50"`).

---

## Inference checklist

1. Load `catboost_model.cbm` using `CatBoostClassifier().load_model(...)`.
2. Construct the 12 input features in the documented order.
3. Pass categorical values as strings without manual label encoding.
4. Use `predict_proba` to produce class probability distributions across classes 1 through 5.
5. Retain other artifacts (`model_stage1*`, `model_stage2`) for ablation, logs, and provenance.

---

## Measured vocabulary and behaviour

The sections above describe the intended contract. The following was **probed directly
from `catboost_model.cbm`** while wiring it into `backend/pipeline/inference.py`, by
sweeping candidate categorical values across numeric regimes and comparing predictions
against an unseen-category control.

### Categorical values the artifact actually learned

| Feature | Trained values | Notes |
| --- | --- | --- |
| `lulc_class` | `'10'`, `'20'`, `'30'`, `'50'`, `'60'`, `'80'` | ESA WorldCover codes. **`'40'` (cropland) is *not* trained** — it lands in the unknown-category bucket, so agricultural scenes have no dedicated land-cover signal despite Class 4 existing. |
| `facility_type` | `'general_industrial'` only | Every other string (`'refinery'`, `'chemical'`, `'none'`, free text) produces byte-identical predictions, so the column carries essentially no signal. |

`backend/pipeline/inference.py` maps feed/replay labels onto this vocabulary
(`industrial_developed` → `'50'`, `tree_cover` → `'10'`, …) and flags out-of-vocabulary
land cover on each prediction via `lulc_in_vocabulary`.

### Behavioural caveats

Predictions are driven almost entirely by `lulc_class`, `is_in_industrial_polygon` and
`distance_to_industrial_m`; FRP and brightness temperature move the output very little.
Confidence saturates at ~1.0 on essentially every input, which is consistent with the
perfect validation scores recorded above and points at a near-deterministic label
function in the training data rather than a calibrated classifier.

Against the four curated replay scenarios the artifact currently produces:

| Scenario | Expected | `catboost_model.cbm` |
| --- | --- | --- |
| `industrial_escalation` (Mangalore, frames 0→3) | Class 5 routine → Class 1 escalation | Class 1 at ~1.00 on **every** frame, including the routine baseline |
| `persistent_flare` (Jamnagar routine flaring) | Class 5, `NORMAL` | Class 1 at ~1.00, routed `CRITICAL` — a false alarm |
| `wildfire` (Similipal forest fire) | Class 2 | Class 3 (mining / coal-seam) at ~1.00 |
| `sensor_disagreement` (Korba) | `UNCERTAIN` via the fusion rule | Class 1; still `UNCERTAIN` (the arbitration rule fires on disagreement regardless) |

Retraining should prioritise: a cropland category, radiometric features that actually
influence the split, and probability calibration. Until then, `JVALYX_INFERENCE=stub`
pins the hand-authored path for scripted demos.
