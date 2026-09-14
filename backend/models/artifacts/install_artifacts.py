"""Install Colab-trained model artifacts into backend/models/artifacts/ after validating them.

The notebook ``notebooks/jvalyx_colab_training.ipynb`` writes ``catboost_model.cbm``,
``isolation_forest.joblib`` and ``training_report.json`` to ``MyDrive/jvalyx/artifacts``
and zips them as ``MyDrive/jvalyx/jvalyx_artifacts.zip``. Point this script at either:

    python backend/models/artifacts/install_artifacts.py --from "C:/Users/<you>/Downloads/jvalyx_artifacts.zip"
    python backend/models/artifacts/install_artifacts.py --from "G:/My Drive/jvalyx/artifacts"

Each file is checked against the contract ``backend/pipeline/inference.py`` enforces before
anything is replaced; the current artifacts are backed up to
``data/training/artifact_backups/<timestamp>/`` (gitignored) first.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

ARTIFACT_DIR = Path(__file__).resolve().parent
REPO_ROOT = ARTIFACT_DIR.parents[2]
BACKUP_ROOT = REPO_ROOT / "data" / "training" / "artifact_backups"
FILES = ("catboost_model.cbm", "isolation_forest.joblib", "training_report.json")

sys.path.insert(0, str(REPO_ROOT))
from backend.pipeline.inference import CATEGORICAL_INDICES, FEATURE_NAMES  # noqa: E402


def validate_catboost(path: Path) -> None:
    from catboost import CatBoostClassifier

    model = CatBoostClassifier()
    model.load_model(str(path))
    if tuple(model.feature_names_) != FEATURE_NAMES:
        raise ValueError(f"CatBoost features {model.feature_names_} != backend contract {FEATURE_NAMES}")
    if [int(c) for c in model.classes_] != [1, 2, 3, 4, 5]:
        raise ValueError(f"CatBoost classes must be 1-5, got {list(model.classes_)}")
    if tuple(model.get_cat_feature_indices()) != CATEGORICAL_INDICES:
        raise ValueError(f"CatBoost categorical indices {model.get_cat_feature_indices()} != {CATEGORICAL_INDICES}")
    print(f"  catboost_model.cbm OK ({path.stat().st_size / 1e6:.1f} MB)")


def validate_iforest(path: Path) -> None:
    import joblib

    data = joblib.load(path)
    missing = {"model", "features", "version"} - set(data)
    if missing:
        raise ValueError(f"isolation_forest.joblib is missing keys: {missing}")
    fitted = list(getattr(data["model"], "feature_names_in_", []))
    if fitted != list(data["features"]):
        raise ValueError(f"Isolation Forest fit order {fitted} != declared features {data['features']}")
    unknown = set(fitted) - set(FEATURE_NAMES)
    if unknown:
        raise ValueError(f"Isolation Forest uses features the backend never computes: {unknown}")
    print(f"  isolation_forest.joblib OK (version {data['version']}, features {fitted})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="source", required=True, help="Downloaded zip or artifacts folder")
    args = parser.parse_args()

    source = Path(args.source).expanduser()
    with tempfile.TemporaryDirectory() as tmp:
        if source.suffix.lower() == ".zip":
            with zipfile.ZipFile(source) as zf:
                zf.extractall(tmp)
            folder = Path(tmp)
        else:
            folder = source
        if not folder.is_dir():
            sys.exit(f"Not a folder or zip: {source}")

        found = {name: next(folder.rglob(name), None) for name in FILES}
        if found["catboost_model.cbm"] is None and found["isolation_forest.joblib"] is None:
            sys.exit(f"No model files found in {source}")

        print("Validating...")
        if found["catboost_model.cbm"]:
            validate_catboost(found["catboost_model.cbm"])
        if found["isolation_forest.joblib"]:
            validate_iforest(found["isolation_forest.joblib"])

        backup = BACKUP_ROOT / datetime.now().strftime("%Y%m%d-%H%M%S")
        backup.mkdir(parents=True, exist_ok=True)
        for name, path in found.items():
            if path is None:
                continue
            current = ARTIFACT_DIR / name
            if current.exists():
                shutil.copy2(current, backup / name)
            shutil.copy2(path, current)
            print(f"  installed {name}")
        print(f"Previous artifacts backed up to {backup}")
    print("Done. Restart the backend so it reloads the models, then run: python -m pytest backend/tests -q")


if __name__ == "__main__":
    main()
