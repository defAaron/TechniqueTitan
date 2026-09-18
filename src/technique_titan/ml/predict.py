"""Load trained per-criterion pipelines and predict severities."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..eval.constants import CRITERIA, SEVERITIES
from .features import FEATURE_NAMES, matrix_from_rows, row_to_vector

try:
    import joblib
except ImportError:  # pragma: no cover
    joblib = None


@dataclass
class ModelBundle:
    models: dict[str, Any]
    feature_names: list[str]
    manifest: dict


def load_bundle(models_dir: Path) -> ModelBundle:
    if joblib is None:
        raise ImportError("scikit-learn/joblib extra required: pip install -e '.[ml]'")
    models_dir = Path(models_dir)
    manifest_path = models_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"model manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    feature_names = list(manifest.get("feature_names") or FEATURE_NAMES)
    models: dict[str, Any] = {}
    for criterion in CRITERIA:
        path = models_dir / f"{criterion}.joblib"
        if not path.is_file():
            raise FileNotFoundError(f"missing model: {path}")
        models[criterion] = joblib.load(path)
    return ModelBundle(models=models, feature_names=feature_names, manifest=manifest)


def predict_severities(row: dict, bundle: ModelBundle) -> dict[str, str]:
    """Predict one severity per criterion for a single feature row."""
    matrix = matrix_from_rows([row], bundle.feature_names)
    return _predict_matrix(matrix, bundle)[0]


def predict_rows(rows: list[dict], bundle: ModelBundle) -> list[dict[str, str]]:
    if not rows:
        return []
    matrix = matrix_from_rows(rows, bundle.feature_names)
    return _predict_matrix(matrix, bundle)


def overlay_ml_predictions(rows: list[dict], bundle: ModelBundle) -> list[dict]:
    """Copy rows and replace ``severity_*`` columns with model predictions."""
    preds = predict_rows(rows, bundle)
    out: list[dict] = []
    for row, pred in zip(rows, preds):
        copy = dict(row)
        for criterion, sev in pred.items():
            copy[f"severity_{criterion}"] = sev
        out.append(copy)
    return out


def _normalize_label(value: object) -> str:
    text = str(value).strip().lower()
    if text in SEVERITIES:
        return text
    return "unknown"


def _predict_matrix(matrix, bundle: ModelBundle) -> list[dict[str, str]]:
    n = len(matrix)
    results = [{name: "unknown" for name in CRITERIA} for _ in range(n)]
    if n == 0:
        return results
    for criterion, model in bundle.models.items():
        labels = model.predict(matrix)
        for i, label in enumerate(labels):
            results[i][criterion] = _normalize_label(label)
    return results


# Imported by train for a stable pickle path if DummyClassifier is not used.
def row_vector(row: dict, feature_names: list[str] | None = None) -> list[float]:
    return row_to_vector(row, feature_names or FEATURE_NAMES)
