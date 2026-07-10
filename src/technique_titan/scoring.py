"""Maps raw criterion metrics to 0-100 scores and severity bands.

Thresholds live in config/scoring.yaml (PRD FR-SC-2, FR-SC-4). Each criterion
defines an `ideal` range (scores 100) and a `limit` range (scores 0 at its
edges); the score falls linearly in between.
"""

from __future__ import annotations

import math
from pathlib import Path

import yaml

DEFAULT_CONFIG = Path(__file__).resolve().parents[2] / "config" / "scoring.yaml"


def load_config(path: Path | str | None = None) -> dict:
    with open(path or DEFAULT_CONFIG) as f:
        return yaml.safe_load(f)


def score_metric(value: float, ideal: list, limit: list) -> float:
    """Piecewise-linear score: 100 inside `ideal`, 0 at/beyond `limit` edges."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return float("nan")
    ideal_lo, ideal_hi = ideal
    limit_lo, limit_hi = limit
    if ideal_lo <= value <= ideal_hi:
        return 100.0
    if value < ideal_lo:
        if value <= limit_lo:
            return 0.0
        return 100.0 * (value - limit_lo) / (ideal_lo - limit_lo)
    if value >= limit_hi:
        return 0.0
    return 100.0 * (limit_hi - value) / (limit_hi - ideal_hi)


def severity(score: float, bands: dict) -> str:
    if isinstance(score, float) and math.isnan(score):
        return "unknown"
    if score >= bands["good_min"]:
        return "good"
    if score >= bands["warning_min"]:
        return "warning"
    return "critical"


def score_all(criterion_metrics: dict, config: dict) -> dict:
    """Compute per-criterion scores, severities, and the weighted composite."""
    bands = config["severity_bands"]
    scores: dict = {}
    severities: dict = {}
    weighted_sum = 0.0
    weight_total = 0.0

    for criterion, cfg in config["criteria"].items():
        value = criterion_metrics.get(cfg["metric"])
        s = score_metric(value, cfg["ideal"], cfg["limit"])
        scores[criterion] = round(s, 1) if not math.isnan(s) else None
        severities[criterion] = severity(s, bands)
        if not math.isnan(s):
            weighted_sum += s * cfg["weight"]
            weight_total += cfg["weight"]

    composite = round(weighted_sum / weight_total, 1) if weight_total > 0 else None
    return {"scores": scores, "severities": severities, "composite_score": composite}
