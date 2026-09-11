import argparse
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import IsolationForest
import joblib

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, help="Path to training CSV", default=None)
    parser.add_argument("--out", type=str, help="Path to save joblib", default="isolation_forest.joblib")
    args = parser.parse_args()

    numeric_features = [
        "bright_ti4",
        "bright_ti5",
        "temp_ratio",
        "frp",
        "distance_to_industrial_m"
    ]
    
    if args.csv:
        print(f"Loading data from {args.csv}")
        df = pd.read_csv(args.csv, usecols=numeric_features)
        # pandas' usecols keeps the CSV's own column order, not this list's order —
        # reindex explicitly so the fitted model's feature order always matches
        # `numeric_features` (and the "features" list saved into the artifact below).
        df = df[numeric_features]
        df = df.dropna()
    else:
        print("No CSV provided, generating simulated data...")
        np.random.seed(42)
        n_samples = 5000
        data = {
            "bright_ti4": np.random.normal(310, 15, n_samples),
            "bright_ti5": np.random.normal(295, 10, n_samples),
            "frp": np.random.exponential(15, n_samples),
            "distance_to_industrial_m": np.random.exponential(5000, n_samples),
        }
        data["temp_ratio"] = data["bright_ti4"] / np.clip(data["bright_ti5"], 1, None)
        df = pd.DataFrame(data)[numeric_features]
        
    print(f"Dataset shape: {df.shape}")
    print(f"Initializing IsolationForest with features: {numeric_features}")
    clf = IsolationForest(
        n_estimators=200, 
        max_samples='auto', 
        contamination=0.01, 
        random_state=42,
        n_jobs=-1
    )
    
    print("Fitting model...")
    clf.fit(df)
    
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Saving artifact to {out_path}...")
    joblib.dump({
        "model": clf,
        "features": numeric_features,
        "version": "iforest-1.0.0"
    }, out_path)
    print("Done!")

if __name__ == "__main__":
    main()
