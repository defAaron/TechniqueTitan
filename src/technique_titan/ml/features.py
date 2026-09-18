"""Tabular feature vectors from batch / companion CSV rows."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable

import numpy as np

from ..eval.labels import load_csv_rows

# Frozen column order for train / predict. Scores, severities, and labels stay out of X.
NUMERIC_FEATURES = (
    "confidence",
    "wrist_height_delta",
    "wrist_knuckle_tilt",
    "mean_finger_curvature",
    "index_pip",
    "index_dip",
    "middle_pip",
    "middle_dip",
    "ring_pip",
    "ring_dip",
    "pinky_pip",
    "pinky_dip",
    "thumb_index_angle",
    "thumb_mcp_abduction",
    "thumb_lateral_offset",
    "wrist_lateral_deviation_deg",
    "wrist_lateral_deviation",
    "hand_arch_ratio",
    "mcp_dome_spread",
    "knuckle_bridge",
)

# Two-sided YAML bands are not linearly separable on the raw metric alone.
# Distance-from-ideal terms let multinomial logistic regression represent
# good-in-the-middle / warning / critical without leaving the linear model.
DERIVED_FEATURES = (
    "wrist_height_delta_outside_ideal",
    "wrist_height_delta_outside_ideal_sq",
    "wrist_height_delta_abs_center_dev",
    "mean_finger_curvature_outside_ideal",
    "mean_finger_curvature_outside_ideal_sq",
    "mean_finger_curvature_abs_center_dev",
    "thumb_index_angle_outside_ideal",
    "thumb_index_angle_outside_ideal_sq",
    "thumb_index_angle_abs_center_dev",
    "wrist_lateral_deviation_deg_outside_ideal",
    "wrist_lateral_deviation_deg_outside_ideal_sq",
    "wrist_lateral_deviation_deg_abs_center_dev",
    "hand_arch_ratio_outside_ideal",
    "hand_arch_ratio_outside_ideal_sq",
    "hand_arch_ratio_abs_center_dev",
)

ONEHOT_FEATURES = ("hand_left", "hand_right")
FEATURE_NAMES = NUMERIC_FEATURES + DERIVED_FEATURES + ONEHOT_FEATURES

_CRITERIA_CFG = None


def _criteria_cfg() -> dict:
    global _CRITERIA_CFG
    if _CRITERIA_CFG is None:
        from ..scoring import load_config

        _CRITERIA_CFG = load_config()["criteria"]
    return _CRITERIA_CFG


def as_float(value: object, default: float = float("nan")) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        result = float(value)
        return default if math.isnan(result) else result
    try:
        result = float(str(value).strip())
    except (TypeError, ValueError):
        return default
    return default if math.isnan(result) else result


def derived_from_row(row: dict) -> dict[str, float]:
    """Monotonic / quadratic transforms of each scored metric vs YAML ideal."""
    out: dict[str, float] = {}
    for cfg in _criteria_cfg().values():
        metric = cfg["metric"]
        value = as_float(row.get(metric))
        ideal_lo, ideal_hi = float(cfg["ideal"][0]), float(cfg["ideal"][1])
        center = (ideal_lo + ideal_hi) / 2.0
        if math.isnan(value):
            out[f"{metric}_outside_ideal"] = float("nan")
            out[f"{metric}_outside_ideal_sq"] = float("nan")
            out[f"{metric}_abs_center_dev"] = float("nan")
            continue
        outside = max(0.0, ideal_lo - value) + max(0.0, value - ideal_hi)
        out[f"{metric}_outside_ideal"] = outside
        out[f"{metric}_outside_ideal_sq"] = outside * outside
        out[f"{metric}_abs_center_dev"] = abs(value - center)
    return out


def row_to_vector(row: dict, feature_names: Iterable[str] = FEATURE_NAMES) -> list[float]:
    """Map one CSV row to a dense vector in ``feature_names`` order."""
    hand = str(row.get("hand") or "").strip().lower()
    lookup = derived_from_row(row)
    lookup["hand_left"] = 1.0 if hand == "left" else 0.0
    lookup["hand_right"] = 1.0 if hand == "right" else 0.0
    values: list[float] = []
    for name in feature_names:
        if name in lookup:
            values.append(lookup[name])
        else:
            values.append(as_float(row.get(name)))
    return values


def matrix_from_rows(
    rows: list[dict],
    feature_names: Iterable[str] = FEATURE_NAMES,
) -> np.ndarray:
    names = tuple(feature_names)
    if not rows:
        return np.empty((0, len(names)), dtype=float)
    return np.asarray([row_to_vector(row, names) for row in rows], dtype=float)


def _row_key(row: dict) -> tuple[str, str]:
    source = str(row.get("source") or "").strip().replace("\\", "/")
    hand = str(row.get("hand") or "").strip().lower()
    return source, hand


def load_merged_feature_rows(
    summary_path: Path | None,
    synthetic_path: Path | None,
) -> list[dict]:
    """Load real batch rows first, then companion rows; skip duplicate (source, hand)."""
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for path in (summary_path, synthetic_path):
        if path is None or not Path(path).is_file():
            continue
        for row in load_csv_rows(path):
            key = _row_key(row)
            if not key[0] or key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows
