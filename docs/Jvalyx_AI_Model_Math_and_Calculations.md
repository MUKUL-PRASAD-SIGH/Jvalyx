# Jvalyx AI Model Mathematics and Required Calculations

**Purpose:** This companion document defines the calculations, mathematical formulation, algorithms, thresholds, and implementation snippets required for the Jvalyx AI pipeline.

**Design principle:** Use deterministic calculations for physics, geospatial logic, temporal baselines, sensor fusion, and risk scoring. Use ML only for pattern-recognition tasks: five-class event triage, anomaly detection, and pixel-level fire/smoke segmentation.

---

## 1. Notation

| Symbol | Meaning |
|---|---|
| \(i\) | A detection or event index |
| \(t\) | Event timestamp |
| \(k\) | Hazard class index, \(k \in \{1,2,3,4,5\}\) |
| \(x_i\) | Feature vector for event \(i\) |
| \(y_i\) | Ground-truth class label for event \(i\) |
| \(F_i\) | Fire Radiative Power (FRP) for event \(i\), in MW |
| \(\mu\), \(\sigma\) | Historical mean and standard deviation |
| \(p_k\) | Predicted probability of class \(k\) |
| \(q\) | Aggregated data-quality score, between 0 and 1 |
| \(a\) | Normalized anomaly score, between 0 and 1 |
| \(R\) | Final interpretable risk score, from 0 to 100 |
| \(u, v\) | Eastward and northward wind components |
| \(N\) | Number of samples or detections in a window |

The five output classes are industrial fire/explosion, wildfire, mining/coal-seam fire, agricultural burning, and persistent flare/routine industrial heat. The system uses CatBoost for multi-class triage, Isolation Forest for independent anomaly evidence, and SegFormer/U-Net for tactical segmentation. [file:1][file:2]

---

## 2. Event Feature Vector

The real-time model input is a mixed numerical and categorical vector. Always compute low-latency radiometric, temporal, spatial, facility, fusion, and quality features first; imagery-only features are delayed until the tactical path is triggered. [file:1][file:2]

\[
\mathbf{x}_i = [\mathbf{x}_{\text{thermal}}, \mathbf{x}_{\text{spatial}}, \mathbf{x}_{\text{temporal}}, \mathbf{x}_{\text{facility}}, \mathbf{x}_{\text{fusion}}, \mathbf{x}_{\text{imagery}}]
\]

Recommended implementation fields:

```python
FEATURES_ALWAYS_ON = [
    "bright_ti4_k", "bright_ti5_k", "temp_ratio", "frp_mw",
    "scan_km", "track_km", "daynight",
    "is_in_industrial_polygon", "distance_to_industrial_m",
    "facility_type", "lulc_class", "lulc_entropy_500m",
    "persistence_score", "baseline_frp_mean", "baseline_frp_std",
    "frp_z_score", "facility_frp_zscore",
    "centroid_drift_velocity_mph", "cluster_pixel_count",
    "sensor_agreement_state", "sensor_count", "data_quality_score"
]

FEATURES_TACTICAL = [
    "swir_nir_ratio", "delta_nbr", "delta_ndvi", "thermal_plume_spread_m2"
]
```

---

## 3. Thermal and Radiometric Features

### 3.1 Temperature contrast ratio

The basic two-band thermal ratio is:

\[
\operatorname{temp\_ratio} = \frac{T_{i,4}}{\max(T_{i,5}, \epsilon)}
\]

where \(T_{i,4}\) is the shortwave infrared brightness temperature, \(T_{i,5}\) is the thermal infrared brightness temperature, and \(\epsilon\) prevents division by zero.

```python
def temperature_ratio(bright_ti4_k: float, bright_ti5_k: float, eps: float = 1e-6) -> float:
    return bright_ti4_k / max(bright_ti5_k, eps)
```

Use it as a feature, not as a direct temperature estimate. Brightness temperature is sensor-derived radiometric information and must not be presented as the physical flame temperature of the source.

### 3.2 Fire Radiative Power trend

For a sequence of \(m\) recent FRP measurements, estimate a trend using a simple least-squares slope:

\[
\hat{\beta}_{F} = \frac{\sum_{j=1}^{m}(t_j-\bar{t})(F_j-\bar{F})}{\sum_{j=1}^{m}(t_j-\bar{t})^2}
\]

A high positive \(\hat{\beta}_{F}\) is stronger evidence of escalation than one isolated high FRP measurement.

```python
import numpy as np

def frp_trend_mw_per_hour(times_hours: np.ndarray, frp: np.ndarray) -> float:
    if len(frp) < 2:
        return 0.0
    return float(np.polyfit(times_hours, frp, 1)[0])
```

### 3.3 Optional blackbody calculation

If calibrated spectral radiance \(L_\lambda\), wavelength \(\lambda\), and sensor calibration are available, Planck’s law is:

\[
L_\lambda(T) = \frac{2hc^2}{\lambda^5}\frac{1}{\exp\left(\frac{hc}{\lambda k_B T}\right)-1}
\]

The inverted brightness-temperature form is:

\[
T_b = \frac{hc}{\lambda k_B \ln\left(1+\frac{2hc^2}{\lambda^5L_\lambda}\right)}
\]

where \(h\) is Planck’s constant, \(c\) is the speed of light, and \(k_B\) is Boltzmann’s constant.

**MVP constraint:** Do not implement this calculation from FIRMS CSV brightness fields alone unless the input is calibrated spectral radiance and the correct sensor spectral-response assumptions are available. Keep `bright_ti4` and `bright_ti5` as ML inputs and state that exact physical flame temperature is outside MVP scope. The existing architecture specifies a dual-band Planck inversion as a deterministic future/advanced component. [file:1][file:2]

---

## 4. Spatial Calculations

### 4.1 Great-circle distance

Use the Haversine equation for fast geographic distance calculations:

\[
\Delta \phi = \phi_2 - \phi_1, \qquad \Delta \lambda = \lambda_2 - \lambda_1
\]

\[
a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)
\]

\[
d = 2r\arctan2(\sqrt{a}, \sqrt{1-a})
\]

where \(r = 6,371,000\) m.

```python
from math import radians, sin, cos, atan2, sqrt

EARTH_RADIUS_M = 6_371_000.0

def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dp / 2)**2 + cos(p1) * cos(p2) * sin(dl / 2)**2
    return 2 * EARTH_RADIUS_M * atan2(sqrt(a), sqrt(1 - a))
```

Use projected coordinate systems, such as a local UTM zone, for accurate area, buffer, and distance operations in GeoPandas/PostGIS.

### 4.2 Point-in-polygon indicator

\[
I_{\text{industrial}}(p) =
\begin{cases}
1, & p \in \mathcal{P}_{\text{industrial}} \\
0, & \text{otherwise}
\end{cases}
\]

```python
from shapely.geometry import Point

def is_in_industrial_polygon(lon, lat, industrial_gdf) -> bool:
    point = Point(lon, lat)
    return bool(industrial_gdf.contains(point).any())
```

### 4.3 Land-use entropy

Within a 500 m buffer, let \(p_c\) be the fraction of pixels or area belonging to land-cover class \(c\). Shannon entropy is:

\[
H_{\text{LULC}} = -\sum_{c=1}^{C} p_c \ln(p_c + \epsilon)
\]

Low entropy suggests homogeneous terrain, such as a large crop field or forest block. Higher entropy suggests a heterogeneous urban/industrial landscape.

```python
import numpy as np

def shannon_entropy(class_counts: dict[str, int], eps: float = 1e-12) -> float:
    values = np.array(list(class_counts.values()), dtype=float)
    p = values / max(values.sum(), eps)
    return float(-(p * np.log(p + eps)).sum())
```

### 4.4 Terrain slope

For elevation raster \(z(x,y)\), the slope magnitude is:

\[
\tan(\theta) = \sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}
\]

\[
\theta = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right)
\]

For a 3 × 3 DEM neighborhood, use Horn’s finite-difference estimate or a raster GIS slope function. Slope is supporting context; it should not dominate industrial/non-industrial classification.

---

## 5. Temporal Baseline Mathematics

### 5.1 Coordinate persistence

For a location/facility cell observed across \(N\) valid satellite overpasses in a lookback window, with \(D\) detections:

\[
P_{\text{coord}} = \frac{D}{N}
\]

A persistent flare can have high \(P_{\text{coord}}\), whereas a one-time explosion should have low prior persistence but potentially high current deviation. The prior project design uses a trailing 90-day persistence score and a high annual persistence rule as evidence for routine flares. [file:1][file:2]

```python
def persistence_score(detection_days: int, valid_overpass_days: int) -> float:
    return detection_days / max(valid_overpass_days, 1)
```

### 5.2 Rolling FRP baseline

For a rolling history \(F_{t-W}, \ldots, F_{t-1}\) across window \(W\):

\[
\mu_t = \frac{1}{N}\sum_{j=1}^{N}F_j
\]

\[
\sigma_t = \sqrt{\frac{1}{N-1}\sum_{j=1}^{N}(F_j-\mu_t)^2}
\]

\[
Z_t = \frac{F_t - \mu_t}{\max(\sigma_t, \epsilon)}
\]

Use two separate baselines:

1. **Coordinate baseline:** catches abnormal behavior at a particular hotspot.
2. **Facility baseline:** aggregates all hotspot FRP inside a facility polygon, catching facility-wide surges even when a single flare location does not appear unusual.

```python
import pandas as pd

def add_rolling_baseline(df: pd.DataFrame, key: str, window: int = 90) -> pd.DataFrame:
    out = df.sort_values([key, "timestamp"]).copy()
    grouped = out.groupby(key, group_keys=False)
    out["baseline_frp_mean"] = grouped["frp_mw"].transform(
        lambda s: s.shift(1).rolling(window, min_periods=10).mean()
    )
    out["baseline_frp_std"] = grouped["frp_mw"].transform(
        lambda s: s.shift(1).rolling(window, min_periods=10).std()
    )
    out["frp_z_score"] = (
        (out["frp_mw"] - out["baseline_frp_mean"])
        / out["baseline_frp_std"].clip(lower=1e-6)
    )
    return out
```

The `shift(1)` is necessary: it prevents the current event from contaminating its own historical baseline.

### 5.3 Robust alternative: median and MAD

FRP distributions can be heavy-tailed. For robust scoring, use median \(m\) and median absolute deviation (MAD):

\[
\operatorname{MAD} = \operatorname{median}_j |F_j - m|
\]

\[
Z_{\text{robust}} = \frac{0.6745(F_t-m)}{\max(\operatorname{MAD}, \epsilon)}
\]

Use robust scores where normality assumptions are weak or routine flare behavior has occasional extreme spikes.

---

## 6. Spatiotemporal Event Dynamics

### 6.1 Cluster size

Construct a graph where each active hotspot is a node. Add an edge when two detections are within \(r\) metres and \(\tau\) minutes. The cluster pixel count is the connected-component size:

\[
C_i = |\mathcal{C}_i|
\]

Recommended MVP settings:

- Use \(r = 1,000\) m for high-resolution hotspot clustering.
- Use a 30–60 minute temporal grouping window.
- Make these configuration values rather than fixed constants.

```python
def are_neighbors(a, b, radius_m=1000, max_minutes=60):
    d = haversine_m(a.lat, a.lon, b.lat, b.lon)
    dt_min = abs((a.timestamp - b.timestamp).total_seconds()) / 60
    return d <= radius_m and dt_min <= max_minutes
```

### 6.2 Centroid drift velocity

For cluster centroids \(\mathbf{c}_{t-1}\) and \(\mathbf{c}_t\):

\[
v_t = \frac{d(\mathbf{c}_t, \mathbf{c}_{t-1})}{\Delta t}
\]

where \(d\) is geodesic or projected-coordinate distance. Store it as m/h for readability.

\[
v_{\text{m/h}} = \frac{d_{\text{metres}}}{\Delta t_{\text{hours}}}
\]

```python
def centroid_drift_mph(prev_lat, prev_lon, curr_lat, curr_lon, elapsed_hours):
    if elapsed_hours <= 0:
        return 0.0
    return haversine_m(prev_lat, prev_lon, curr_lat, curr_lon) / elapsed_hours
```

### 6.3 FRP growth rate

For two valid event measurements:

\[
G_F = \frac{F_t - F_{t-1}}{\max(F_{t-1}, \epsilon)}
\]

\[
G_{F,\text{hour}} = \frac{G_F}{\Delta t_{\text{hours}}}
\]

This feature is useful in the counterfactual demo because judges can see the difference between a stable flare and an escalation.

---

## 7. Sensor Quality and Fusion

The multi-sensor architecture uses VIIRS, MODIS, and INSAT where available, and treats disagreement as a verification signal rather than evidence that the event should be suppressed. [file:2]

### 7.1 Per-detection quality score

Define quality features \(f_j\) such as cloud contamination, low confidence, sun glint, scan geometry, and saturation. A simple interpretable penalty score is:

\[
q_i = \operatorname{clip}\left(1 - \sum_{j=1}^{m}w_j f_{ij}, 0, 1\right)
\]

Example configuration:

| Flag | Symbol | Example penalty |
|---|---:|---:|
| Cloud contamination | \(f_{\text{cloud}}\) | 0.35 |
| Sun glint | \(f_{\text{glint}}\) | 0.25 |
| Low native confidence | \(f_{\text{lowconf}}\) | 0.20 |
| Extreme geometry | \(f_{\text{geometry}}\) | 0.15 |

```python
def quality_score(d: dict) -> float:
    penalties = 0.0
    penalties += 0.35 if d.get("cloud_flag", False) else 0.0
    penalties += 0.25 if d.get("sun_glint_flag", False) else 0.0
    penalties += 0.20 if d.get("confidence") == "low" else 0.0
    penalties += 0.15 if d.get("extreme_geometry", False) else 0.0
    return max(0.0, min(1.0, 1.0 - penalties))
```

### 7.2 Spatial match condition

For detections from sensors \(s_a\) and \(s_b\), set the match radius to a fraction of the coarser footprint:

\[
r_{ab} = \frac{1}{2}\max(\rho_{s_a}, \rho_{s_b}) + m
\]

where \(\rho_s\) is nominal footprint diameter in metres and \(m\) is an uncertainty margin.

\[
\operatorname{spatial\_match}(a,b) = \mathbb{1}[d(a,b) \le r_{ab}]
\]

### 7.3 Temporal match condition

\[
\operatorname{temporal\_match}(a,b) = \mathbb{1}[|t_a-t_b| \le \tau_{ab}]
\]

Use sensor-pair-specific \(\tau_{ab}\): a short window for near-simultaneous polar observations, and a longer “nearest before/after frame” window for geostationary INSAT corroboration.

### 7.4 Agreement score

For a fused event containing \(n\) detections, define pairwise match values \(M_{ij}\in\{0,1\}\), and quality weights \(q_i\):

\[
A = \frac{\sum_{i<j} q_iq_jM_{ij}}{\sum_{i<j}q_iq_j + \epsilon}
\]

\(A\) lies approximately between 0 and 1. Use it alongside an explicit categorical fusion state, not instead of it.

```python
def agreement_score(detections, matches) -> float:
    numerator = denominator = 0.0
    for i in range(len(detections)):
        for j in range(i + 1, len(detections)):
            weight = quality_score(detections[i]) * quality_score(detections[j])
            numerator += weight * float(matches[i][j])
            denominator += weight
    return numerator / max(denominator, 1e-6)
```

### 7.5 Fusion state policy

| Fusion state | Rule | Operational meaning |
|---|---|---|
| `full_agreement` | Two or more independent sensors corroborate | Stronger evidence |
| `temporally_confirmed_spatially_coarse` | Geostationary trend persists, spatial detail is coarse | Time-confidence without fine localization |
| `single_sensor_high_res` | VIIRS/MODIS event without other confirmation yet | Valid but unresolved |
| `disagreement` | Quality-passed sensor had a clear view but did not corroborate | Route to verification; never discard |

---

## 8. CatBoost Multi-Class Classification Math

CatBoost is the primary Stage 1 classifier because the event vector contains numerical and categorical variables such as facility type, land cover, and fusion state. [file:1][file:2]

### 8.1 Additive tree model

For class \(k\), CatBoost learns a raw score:

\[
F_k(\mathbf{x}) = \sum_{m=1}^{M}\eta f_{m,k}(\mathbf{x})
\]

where:

- \(M\) is the number of trees.
- \(\eta\) is the learning rate.
- \(f_{m,k}\) is the contribution of tree \(m\) to class \(k\).

### 8.2 Softmax probabilities

Convert raw class scores to probabilities:

\[
p_k(\mathbf{x}) = \frac{\exp(F_k(\mathbf{x}))}{\sum_{j=1}^{5}\exp(F_j(\mathbf{x}))}
\]

The predicted class is:

\[
\hat{y} = \arg\max_{k}p_k(\mathbf{x})
\]

### 8.3 Weighted multi-class cross-entropy

For one event \(i\), with one-hot class target \(y_{ik}\), the weighted loss is:

\[
\mathcal{L}_i = -w_{y_i}\sum_{k=1}^{5} y_{ik}\ln(p_{ik}+\epsilon)
\]

The total loss is:

\[
\mathcal{L} = \frac{1}{N}\sum_{i=1}^{N}\mathcal{L}_i
\]

Use larger \(w_k\) for rare/high-consequence classes, especially Class 1. Class balancing affects training gradients but does not solve lack of true Class 1 examples; the parallel anomaly path remains required. [file:1][file:2]

A simple inverse-frequency weight is:

\[
w_k = \frac{N}{K\cdot n_k}
\]

where \(n_k\) is the sample count for class \(k\) and \(K=5\).

```python
from catboost import CatBoostClassifier

cat_features = ["facility_type", "lulc_class", "sensor_agreement_state"]

model = CatBoostClassifier(
    loss_function="MultiClass",
    eval_metric="TotalF1:average=Macro",
    auto_class_weights="Balanced",
    iterations=500,
    depth=7,
    learning_rate=0.05,
    l2_leaf_reg=5.0,
    random_seed=42,
    verbose=50
)

model.fit(
    X_train,
    y_train,
    cat_features=cat_features,
    eval_set=(X_valid, y_valid),
    early_stopping_rounds=50
)
```

### 8.4 Probability calibration

Raw model confidence can be overconfident. Apply calibration on a validation set using temperature scaling:

\[
p_k^{(T)} = \frac{\exp(F_k/T)}{\sum_{j=1}^{5}\exp(F_j/T)}
\]

Choose \(T>0\) to minimize negative log-likelihood on the held-out validation data.

**MVP option:** If a calibrated multi-class implementation is not ready, show the CatBoost output as `model score`, not a guaranteed physical probability. Add calibration in the next iteration and report expected calibration error.

---

## 9. Isolation Forest Anomaly Detection

The parallel anomaly detector provides an independent path when rare catastrophic industrial events have too few labeled examples. It is trained predominantly on normal/routine behavior. [file:1][file:2]

### 9.1 Input subspace

Use numerical anomaly features:

\[
\mathbf{z}_i = [Z_{\text{coord}}, Z_{\text{facility}}, P_{\text{coord}}, C_i, v_i, \hat{\beta}_F]
\]

Standardize each continuous feature before fitting:

\[
z'_{ij} = \frac{z_{ij}-\mu_j}{\max(\sigma_j, \epsilon)}
\]

### 9.2 Isolation Forest path length

Isolation Forest randomly partitions samples. Anomalies typically require fewer splits to isolate. The expected path length of a random binary search tree for \(n\) samples is:

\[
c(n)=2H(n-1)-\frac{2(n-1)}{n}
\]

where \(H(n-1)\) is the \((n-1)\)-th harmonic number.

Given expected path length \(E[h(x)]\), anomaly score is:

\[
s(x,n) = 2^{-\frac{E[h(x)]}{c(n)}}
\]

Higher values indicate stronger anomaly evidence.

```python
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

ANOMALY_FEATURES = [
    "frp_z_score", "facility_frp_zscore", "persistence_score",
    "cluster_pixel_count", "centroid_drift_velocity_mph", "frp_trend_mw_per_hour"
]

scaler = RobustScaler().fit(X_normal[ANOMALY_FEATURES])
isolation_forest = IsolationForest(
    n_estimators=300,
    contamination=0.02,
    max_samples="auto",
    random_state=42
)
isolation_forest.fit(scaler.transform(X_normal[ANOMALY_FEATURES]))

def normalized_anomaly_score(row):
    raw = -isolation_forest.decision_function(
        scaler.transform(row[ANOMALY_FEATURES].to_frame().T)
    )[0]
    return float(1 / (1 + np.exp(-raw)))
```

Use the score as evidence, not as an automatic final hazard label.

---

## 10. Segmentation Mathematics

Stage 2 is triggered for critical/verified events and creates pixel-level burn/fire/smoke masks from Sentinel-2 or prepared tactical imagery. The architecture recommends SegFormer or lightweight U-Net because segmentation produces usable irregular boundaries instead of broad detection boxes. [file:1][file:2]

### 10.1 Input tensor

For \(H\times W\) imagery with four bands, form:

\[
\mathbf{X}\in\mathbb{R}^{H\times W\times 4}
\]

Suggested channel order:

\[
[B_{12}, B_{11}, B_8, B_4]
\]

where SWIR bands support heat/burn sensitivity and NIR/red provide vegetation and smoke context.

### 10.2 Spectral indices

Normalized Burn Ratio:

\[
\operatorname{NBR} = \frac{B_8-B_{12}}{B_8+B_{12}+\epsilon}
\]

Difference NBR:

\[
\Delta\operatorname{NBR} = \operatorname{NBR}_{\text{pre}} - \operatorname{NBR}_{\text{post}}
\]

Normalized Difference Vegetation Index:

\[
\operatorname{NDVI} = \frac{B_8-B_4}{B_8+B_4+\epsilon}
\]

Vegetation change:

\[
\Delta\operatorname{NDVI} = \operatorname{NDVI}_{\text{pre}} - \operatorname{NDVI}_{\text{post}}
\]

SWIR/NIR ratio:

\[
\operatorname{SWIR/NIR} = \frac{B_{12}}{B_8+\epsilon}
\]

```python
import numpy as np

def spectral_indices(b12, b8, b4, pre_nbr=None, pre_ndvi=None, eps=1e-6):
    nbr = (b8 - b12) / (b8 + b12 + eps)
    ndvi = (b8 - b4) / (b8 + b4 + eps)
    return {
        "swir_nir_ratio": b12 / (b8 + eps),
        "nbr": nbr,
        "ndvi": ndvi,
        "delta_nbr": None if pre_nbr is None else pre_nbr - nbr,
        "delta_ndvi": None if pre_ndvi is None else pre_ndvi - ndvi
    }
```

### 10.3 Multi-class pixel probabilities

For each pixel \(p\) and mask class \(c\), the segmentation network outputs logits \(z_{p,c}\). Softmax gives:

\[
\hat{p}_{p,c} = \frac{\exp(z_{p,c})}{\sum_{j=1}^{C}\exp(z_{p,j})}
\]

### 10.4 Weighted segmentation loss

A stable loss combines weighted cross-entropy and Dice loss:

\[
\mathcal{L}_{\text{CE}}=-\frac{1}{|\Omega|}\sum_{p\in\Omega}\sum_{c=1}^{C}w_c y_{p,c}\ln(\hat{p}_{p,c}+\epsilon)
\]

\[
\operatorname{Dice}_c=\frac{2\sum_p\hat{p}_{p,c}y_{p,c}+\epsilon}{\sum_p\hat{p}_{p,c}+\sum_py_{p,c}+\epsilon}
\]

\[
\mathcal{L}_{\text{Dice}}=1-\frac{1}{C}\sum_{c=1}^{C}\operatorname{Dice}_c
\]

\[
\mathcal{L}_{\text{seg}}=\lambda\mathcal{L}_{\text{CE}}+(1-\lambda)\mathcal{L}_{\text{Dice}}
\]

Use \(\lambda=0.5\) as a practical initial value. Assign greater class weight to the minority burn/smoke classes than background.

### 10.5 Mask area and plume spread

For a binary mask with \(n\) positive pixels and pixel ground area \(A_{px}\):

\[
A_{\text{mask}}=nA_{px}
\]

If the raster is 20 m × 20 m, then \(A_{px}=400\ \text{m}^2\).

```python
def mask_area_m2(mask: np.ndarray, pixel_size_m: float) -> float:
    return float((mask > 0).sum() * pixel_size_m**2)
```

---

## 11. Plume Probability Corridor

The MVP plume model should represent uncertainty, not claim exact chemical-dispersion prediction. The project architecture explicitly proposes Monte Carlo wind perturbation to render a probability corridor rather than a deterministic line. [file:2]

### 11.1 Wind vector conversion

For wind speed \(v\) and direction \(\theta\), expressed as the direction **toward which** the wind travels:

\[
u=v\sin(\theta), \qquad v_N=v\cos(\theta)
\]

Be careful: meteorological datasets often report the direction **from which** wind originates. Convert before using it for advection.

### 11.2 First-order advection

For a source at \(\mathbf{r}_0\), with wind vector \(\mathbf{w}\), over time \(\Delta t\):

\[
\mathbf{r}(\Delta t)=\mathbf{r}_0+\mathbf{w}\Delta t
\]

### 11.3 Monte Carlo uncertainty

Sample wind speed and direction:

\[
v^{(s)}\sim\mathcal{N}(\mu_v,\sigma_v^2)
\]

\[
\theta^{(s)}\sim\mathcal{N}(\mu_\theta,\sigma_\theta^2)
\]

For each sample \(s=1,\ldots,S\), propagate an endpoint or trajectory. The 50% and 90% regions of endpoint density define the displayed probability corridor.

```python
import numpy as np

def sample_wind(speed_mps, direction_deg, speed_sigma=1.5, dir_sigma=12.0, n=250):
    speed = np.clip(np.random.normal(speed_mps, speed_sigma, n), 0.0, None)
    direction = np.random.normal(direction_deg, dir_sigma, n) % 360
    return speed, direction
```

**MVP limitation:** This is advection visualization, not a validated Gaussian plume, CFD, or toxic dose model. Keep the displayed label as `Downwind probability corridor`.

---

## 12. Consequence and Risk Calculations

The consequence layer combines hazard evidence with nearby population and critical assets to prioritize response. It is deterministic rather than another opaque model. [file:2]

### 12.1 Exposure score

Normalize population and asset exposure using capped transformations:

\[
E_{\text{pop}}=\min\left(1,\frac{\operatorname{Pop}_{90\%}}{P_0}\right)
\]

\[
E_{\text{asset}}=\min\left(1,\frac{\sum_j c_j\mathbb{1}[d_j\le r]}{C_0}\right)
\]

Where:

- \(\operatorname{Pop}_{90\%}\) is the population intersecting the 90% corridor.
- \(c_j\) is asset criticality weight.
- \(d_j\) is distance or spatial relationship to the hazard/corridor.
- \(P_0\) and \(C_0\) are caps selected by policy.

Combine:

\[
E=\operatorname{clip}(0.6E_{\text{pop}}+0.4E_{\text{asset}},0,1)
\]

### 12.2 Severity score from class probabilities

Use class-impact weights, for example:

\[
\mathbf{w}_{\text{class}}=[1.00,0.80,0.55,0.20,0.05]
\]

Then:

\[
S=\sum_{k=1}^{5}w_kp_k
\]

This retains uncertainty: an event with mixed Class 1 and Class 2 probability remains high severity even if one class does not dominate.

### 12.3 Anomaly and spread normalization

Map raw values to \([0,1]\) using a sigmoid:

\[
\sigma(x)=\frac{1}{1+e^{-x}}
\]

\[
A=\sigma\left(\frac{Z_{\text{facility}}-z_0}{s_z}\right)
\]

\[
G=\sigma\left(\alpha\ln(1+C)+\beta\ln(1+v)-b\right)
\]

where \(C\) is cluster size and \(v\) is centroid drift velocity.

### 12.4 Final risk score

A transparent MVP risk score is:

\[
R=100\times\operatorname{clip}(0.35S+0.25A+0.20G+0.20E,0,1)
\]

The weights must be configured, versioned, and tuned using historical review. Do not call them scientifically validated until backtesting has been completed.

```python
import math

def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))

def risk_score(class_probabilities, facility_z, cluster_count, drift_mph, exposure):
    class_weights = {1: 1.00, 2: 0.80, 3: 0.55, 4: 0.20, 5: 0.05}
    severity = sum(class_weights[int(k)] * p for k, p in class_probabilities.items())
    anomaly = sigmoid((facility_z - 3.0) / 1.0)
    spread = sigmoid(0.45 * math.log1p(cluster_count) + 0.002 * drift_mph - 1.2)
    raw = 0.35 * severity + 0.25 * anomaly + 0.20 * spread + 0.20 * exposure
    return round(100 * max(0.0, min(1.0, raw)), 1)
```

---

## 13. Arbitration Logic

The final routing layer should be rule-based and versioned for safety, explainability, and demonstration clarity. It receives classifier probabilities, anomaly evidence, fusion state, quality, and facility anomaly metrics. [file:2]

### 13.1 Critical routing condition

Define a critical indicator:

\[
C_{\text{critical}} =
\mathbb{1}\left[p_1\ge\tau_1\ \lor\ p_2\ge\tau_2\ \lor\left(I_{\text{industrial}}=1\land Z_{\text{facility}}\ge\tau_Z\right)\right]
\]

### 13.2 Uncertain routing condition

\[
C_{\text{uncertain}} =
\mathbb{1}\left[a\ge\tau_a\ \lor\ A<\tau_A\ \lor\max_k p_k<\tau_p\ \lor\text{fusion} = \text{disagreement}\right]
\]

### 13.3 Deterministic routing

\[
\operatorname{route}(x)=
\begin{cases}
\text{CRITICAL}, & C_{\text{critical}}=1 \\
\text{UNCERTAIN}, & C_{\text{uncertain}}=1 \\
\text{NORMAL}, & \text{otherwise}
\end{cases}
\]

```python
def route_event(probs, anomaly_score, event, cfg):
    p1, p2 = probs[1], probs[2]
    is_industrial = bool(event["is_in_industrial_polygon"])
    facility_z = float(event["facility_frp_zscore"])
    fusion = event["sensor_agreement_state"]
    quality = float(event["data_quality_score"])

    critical = (
        p1 >= cfg.class1_threshold
        or p2 >= cfg.class2_threshold
        or (is_industrial and facility_z >= cfg.facility_z_threshold)
    )
    uncertain = (
        anomaly_score >= cfg.anomaly_threshold
        or fusion == "disagreement"
        or quality < cfg.min_quality
        or max(probs.values()) < cfg.min_model_confidence
    )

    if critical:
        return "CRITICAL"
    if uncertain:
        return "UNCERTAIN"
    return "NORMAL"
```

Recommended demo-starting values:

```yaml
policy_version: arbitrator-0.1.0
class1_threshold: 0.45
class2_threshold: 0.55
facility_z_threshold: 4.0
anomaly_threshold: 0.75
min_quality: 0.45
min_model_confidence: 0.55
```

These are configurable policy parameters, not universal operational thresholds.

---

## 14. Training Labels and Loss Controls

### 14.1 Weak-label precedence

Use rule precedence during distant supervision:

\[
\text{mine intersection} \Rightarrow \text{Class 3}
\]

before testing persistence for Class 5. This prevents persistent coal-seam fires from being mislabeled as routine flares. [file:1][file:2]

Suggested labeling logic:

```python
def weak_label(row):
    if row["is_mine_polygon"]:
        return 3
    if row["is_industrial_polygon"] and row["manual_incident_match"]:
        return 1
    if row["lulc_class"] == "tree_cover" and row["frp_mw"] >= row["wildfire_frp_threshold"]:
        return 2
    if row["lulc_class"] == "cropland" and row["is_harvest_window"]:
        return 4
    if row["annual_persistence"] > 0.70:
        return 5
    return None
```

### 14.2 Circularity protection

If a labeling rule uses a feature, then random train-test splits can let the model learn the same rule and inflate performance. The existing plan requires a human-verified held-out set and spatial/temporal validation to measure the real generalization gap. [file:1][file:2]

Implement three splits:

1. **Training:** weak labels plus verified labels.
2. **Validation:** held-out spatial grid cells for hyperparameter selection.
3. **Final test:** human-verified examples, never used to create or tune labels.

### 14.3 Spatial-block split

For projected coordinates \((x,y)\), assign a grid ID:

\[
g_x=\left\lfloor\frac{x}{L}\right\rfloor,\qquad g_y=\left\lfloor\frac{y}{L}\right\rfloor
\]

\[
\operatorname{grid\_id}=(g_x,g_y)
\]

Hold out entire grid IDs so the model cannot memorize a known flare coordinate.

---

## 15. Evaluation Mathematics

Accuracy is not enough because Class 5 can dominate the dataset. Measure class-specific performance, macro metrics, calibration, segmentation overlap, and safety-routing failure rate. [file:1][file:2]

### 15.1 Per-class precision and recall

\[
\operatorname{Precision}_k=\frac{TP_k}{TP_k+FP_k}
\]

\[
\operatorname{Recall}_k=\frac{TP_k}{TP_k+FN_k}
\]

\[
F1_k=2\frac{\operatorname{Precision}_k\operatorname{Recall}_k}{\operatorname{Precision}_k+\operatorname{Recall}_k}
\]

### 15.2 Macro F1

\[
\operatorname{MacroF1}=\frac{1}{5}\sum_{k=1}^{5}F1_k
\]

### 15.3 Critical-event recall

For Class 1, report:

\[
\operatorname{Recall}_{1}=\frac{TP_1}{TP_1+FN_1}
\]

Also report the arbitration safety metric:

\[
\operatorname{CriticalEscapeRate}=\frac{\#(y=1\land\operatorname{route}=\text{NORMAL})}{\#(y=1)}
\]

Target this rate toward zero. A known Class 1 event routed to `NORMAL` is the most important failure to investigate. [file:2]

### 15.4 Expected calibration error

Split predictions into confidence bins \(B_m\):

\[
\operatorname{ECE}=\sum_{m=1}^{M}\frac{|B_m|}{N}\left|\operatorname{acc}(B_m)-\operatorname{conf}(B_m)\right|
\]

### 15.5 Segmentation IoU and Dice

\[
\operatorname{IoU}=\frac{|\hat{Y}\cap Y|}{|\hat{Y}\cup Y|}
\]

\[
\operatorname{Dice}=\frac{2|\hat{Y}\cap Y|}{|\hat{Y}|+|Y|}
\]

### 15.6 Plume corridor coverage

If known observed plume points/regions are available, evaluate what fraction falls inside the predicted 90% corridor:

\[
\operatorname{Coverage}_{90}=\frac{\#\{p_{\text{observed}}\in\mathcal{C}_{90}\}}{\#\{p_{\text{observed}}\}}
\]

Do not evaluate or claim this metric if there is no credible plume ground truth.

---

## 16. Worked Demonstration Example

Assume a facility event produces:

| Signal | Value |
|---|---:|
| Class 1 probability \(p_1\) | 0.58 |
| Class 2 probability \(p_2\) | 0.17 |
| Class 5 probability \(p_5\) | 0.16 |
| Facility FRP z-score | 5.1 |
| Coordinate FRP z-score | 4.4 |
| Cluster size | 6 pixels |
| Centroid drift | 900 m/h |
| Anomaly score \(a\) | 0.89 |
| Sensor state | `full_agreement` |
| Exposure score \(E\) | 0.62 |

The class severity component is:

\[
S=(1.00)(0.58)+(0.80)(0.17)+(0.55)(0.04)+(0.20)(0.05)+(0.05)(0.16)=0.756
\]

The facility anomaly is high because \(Z_{\text{facility}}=5.1\), well above a starting escalation threshold such as 4.0. Because \(p_1\ge0.45\) and the facility is anomalous, the route is `CRITICAL` even before risk aggregation.

The dashboard should visibly explain the event as:

> “Escalated because facility-wide thermal output is 5.1 standard deviations above its prior baseline, six linked hotspots indicate expansion, and multiple sensors corroborate the detection.”

---

## 17. Required Configuration File

Keep all policy values versioned in one file:

```yaml
model_version: triage-0.1.0
anomaly_model_version: iforest-0.1.0
policy_version: arbitrator-0.1.0

baseline:
  coordinate_window_days: 90
  minimum_history_points: 10
  epsilon: 1.0e-6

fusion:
  spatial_margin_m: 250
  polar_temporal_window_minutes: 30
  geostationary_window_minutes: 45

arbitration:
  class1_threshold: 0.45
  class2_threshold: 0.55
  facility_z_threshold: 4.0
  anomaly_threshold: 0.75
  min_quality: 0.45
  min_model_confidence: 0.55

risk:
  severity_weight: 0.35
  anomaly_weight: 0.25
  spread_weight: 0.20
  exposure_weight: 0.20

plume:
  monte_carlo_samples: 250
  speed_sigma_mps: 1.5
  direction_sigma_deg: 12.0
```

---

## 18. Minimum Mathematical Scope for MVP

Implement these calculations first:

- [ ] Haversine/projection-aware distance.
- [ ] Point-in-polygon industrial and mining lookup.
- [ ] 90-day coordinate and facility FRP baselines.
- [ ] Standard and robust FRP z-scores.
- [ ] Persistence ratio.
- [ ] Cluster size, centroid movement, and FRP trend.
- [ ] Quality score and categorical fusion state.
- [ ] CatBoost multi-class probabilities.
- [ ] Isolation Forest anomaly score.
- [ ] Deterministic routing rules.
- [ ] Transparent risk score.
- [ ] NBR, NDVI, delta NBR, delta NDVI, and SWIR/NIR calculations.
- [ ] Segmentation Dice/IoU metrics.
- [ ] Monte Carlo downwind corridor for visualization.

Defer these until the MVP is stable:

- Full physical dual-band temperature inversion from calibrated radiance.
- Validated Gaussian plume concentration/dose calculations.
- Real-time full-resolution multi-sensor fusion across the country.
- Fully automated online retraining.

---

## 19. Presentation Guidance

Use the equations to prove engineering rigor, but explain each in one operational sentence:

- **Z-score:** “How abnormal is this event compared with this facility’s own normal history?”
- **Persistence:** “Does this location burn routinely, or is this new?”
- **Cluster growth:** “Is the heat isolated or spreading?”
- **Fusion agreement:** “Do independent sensors support the event?”
- **Anomaly score:** “Does the overall behavior look unlike normal operations?”
- **Risk score:** “How severe is it, how fast is it changing, and who may be exposed?”
- **Probability corridor:** “Where could smoke or plume movement plausibly go given wind uncertainty?”

This combination of transparent deterministic calculations, independent anomaly detection, multi-class classification, and tactical segmentation is consistent with the supplied project architecture and its stated emphasis on confidence-aware routing rather than a single opaque model decision. [file:1][file:2]
