"""Optional learned severities behind ``SCORER`` (spec §1.2, Phase 8).

``SCORER=yaml`` (default, and any unrecognized value) leaves YAML severities
untouched and never loads joblib. ``SCORER=ml_with_fallback`` replaces each
criterion's severity with the logistic-regression prediction from
``config/models/<criterion>.joblib``; a load failure, a predict exception, or
an ``unknown`` label keeps YAML for that criterion. Scores stay YAML.
"""

from __future__ import annotations

import logging
import os
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import Any, List

from technique_titan.analysis import AnalysisResult

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = REPO_ROOT / "config" / "models"

SCORER_YAML = "yaml"
SCORER_ML = "ml_with_fallback"
_SEVERITIES = frozenset(("good", "warning", "critical"))


def scorer_mode() -> str:
    raw = os.environ.get("SCORER", SCORER_YAML).strip().lower()
    return raw if raw in (SCORER_YAML, SCORER_ML) else SCORER_YAML


def resolve_models_dir(models_dir: Path | str | None = None) -> Path:
    """Only the repo ``config/models`` directory may be loaded (pickle safety)."""
    expected = Path(MODELS_DIR).resolve()
    resolved = Path(models_dir if models_dir is not None else MODELS_DIR).resolve()
    if resolved != expected:
        raise ValueError("models directory must be config/models")
    return resolved


@lru_cache(maxsize=1)
def _bundle() -> Any | None:
    try:
        from technique_titan.ml.predict import load_bundle

        return load_bundle(resolve_models_dir())
    except Exception as exc:
        logger.warning("SCORER=%s: models unavailable (%s); using YAML", SCORER_ML, type(exc).__name__)
        return None


def reset_model_cache() -> None:
    _bundle.cache_clear()


def feature_row(result: AnalysisResult) -> dict:
    """Same columns the batch summary feeds the trainer."""
    row: dict = {"hand": result.label.lower(), "confidence": float(result.hand.confidence)}
    row.update(result.angles_deg)
    row.update(result.criterion_metrics)
    return row


def ml_severities(result: AnalysisResult, bundle: Any) -> dict[str, str]:
    from technique_titan.ml.features import matrix_from_rows

    matrix = matrix_from_rows([feature_row(result)], bundle.feature_names)
    out: dict[str, str] = {}
    for criterion, model in bundle.models.items():
        if result.scores.get(criterion) is None:
            continue
        try:
            label = str(model.predict(matrix)[0]).strip().lower()
        except Exception:
            continue
        if label in _SEVERITIES:
            out[criterion] = label
    return out


def apply_scorer(results: List[AnalysisResult]) -> List[AnalysisResult]:
    if scorer_mode() != SCORER_ML or not results:
        return results
    bundle = _bundle()
    if bundle is None:
        return results
    out: List[AnalysisResult] = []
    for result in results:
        try:
            predicted = ml_severities(result, bundle)
        except Exception:
            predicted = {}
        if predicted:
            result = replace(result, severities={**result.severities, **predicted})
        out.append(result)
    return out
