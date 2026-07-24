"""Deterministic, template-based coaching from scores and severities.

Pure post-process (PRD FR-FB-1…FR-FB-4): consumes existing scoring outputs and
a YAML message catalog. Does not alter detection, features, or score math.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
import yaml

DEFAULT_COACHING_CONFIG = Path(__file__).resolve().parents[2] / "config" / "coaching.yaml"

# Landmark indices to emphasize for the primary tip (additive overlay).
CRITERION_LANDMARKS = {
    "wrist_height": (0, 5, 9, 13, 17),
    "finger_curvature": tuple(range(5, 21)),
    "thumb_position": (1, 2, 3, 4, 5, 8),
    "wrist_lateral": (0, 5, 9, 17),
    "hand_arch": (0, 5, 9, 13, 17),
}

_SEVERITY_RANK = {"critical": 0, "warning": 1}


@dataclass(frozen=True)
class CoachingTip:
    criterion: str
    severity: str
    direction: str
    problem: str
    fix: str
    priority: int


@dataclass(frozen=True)
class CoachingReport:
    tips: List[CoachingTip]
    primary: Optional[CoachingTip]
    encouragement: Optional[str]


def load_coaching_config(path: Path | str | None = None) -> dict:
    with open(path or DEFAULT_COACHING_CONFIG) as f:
        return yaml.safe_load(f)


def metric_direction(value, ideal: list) -> str:
    """Classify a metric relative to the scoring ideal range."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "unknown"
    try:
        value = float(value)
    except (TypeError, ValueError):
        return "unknown"
    ideal_lo, ideal_hi = ideal
    if value < ideal_lo:
        return "too_low"
    if value > ideal_hi:
        return "too_high"
    return "in_ideal"


def _template_for(
    coaching_config: dict, criterion: str, severity: str, direction: str
) -> dict:
    """Pick problem/fix copy; fall back to generic when direction is unknown."""
    block = coaching_config["criteria"][criterion][severity]
    key = direction if direction in ("too_low", "too_high") else "generic"
    return block.get(key) or block["generic"]


def _lookup_tip(
    coaching_config: dict, criterion: str, severity: str = "warning", direction: str = "generic"
) -> Optional[CoachingTip]:
    """Build a tip from the catalog without re-scoring (session-summary helper)."""
    criteria = coaching_config.get("criteria") or {}
    if criterion not in criteria or severity not in ("warning", "critical"):
        return None
    tmpl = _template_for(coaching_config, criterion, severity, direction)
    return CoachingTip(
        criterion=criterion,
        severity=severity,
        direction=direction if direction in ("too_low", "too_high") else "generic",
        problem=tmpl["problem"],
        fix=tmpl["fix"],
        priority=0,
    )


def tip_for_label(
    coaching_config: dict,
    display_label: str,
    criterion_labels: dict,
    *,
    severity: str = "warning",
    direction: str = "generic",
) -> Optional[CoachingTip]:
    """Resolve a human-facing criterion label (e.g. 'Wrist height') to a tip."""
    reverse = {v: k for k, v in criterion_labels.items()}
    criterion = reverse.get(display_label)
    if criterion is None:
        return None
    return _lookup_tip(coaching_config, criterion, severity=severity, direction=direction)


def generate_coaching(
    scores: dict,
    severities: dict,
    criterion_metrics: dict,
    scoring_config: dict,
    coaching_config: dict,
) -> CoachingReport:
    """Build prioritized coaching tips for non-good criteria."""
    encouragement = coaching_config.get("encouragement")
    criteria_cfg = scoring_config.get("criteria") or {}
    criterion_order = list(criteria_cfg.keys())

    candidates: list[tuple] = []
    for index, criterion in enumerate(criterion_order):
        sev = severities.get(criterion, "unknown")
        if sev not in ("warning", "critical"):
            continue
        cfg = criteria_cfg[criterion]
        metric_key = cfg["metric"]
        value = criterion_metrics.get(metric_key)
        direction = metric_direction(value, cfg["ideal"])
        # Templates only have too_low / too_high / generic; in_ideal uses generic.
        template_dir = direction if direction in ("too_low", "too_high") else "generic"
        tmpl = _template_for(coaching_config, criterion, sev, template_dir)
        tip = CoachingTip(
            criterion=criterion,
            severity=sev,
            direction=template_dir,
            problem=tmpl["problem"],
            fix=tmpl["fix"],
            priority=0,  # filled after sort
        )
        weight = float(cfg.get("weight", 0.0))
        candidates.append((_SEVERITY_RANK[sev], -weight, index, tip))

    candidates.sort(key=lambda row: (row[0], row[1], row[2]))
    tips = [
        CoachingTip(
            criterion=tip.criterion,
            severity=tip.severity,
            direction=tip.direction,
            problem=tip.problem,
            fix=tip.fix,
            priority=i,
        )
        for i, (*_, tip) in enumerate(candidates)
    ]

    if tips:
        return CoachingReport(tips=tips, primary=tips[0], encouragement=None)
    return CoachingReport(tips=[], primary=None, encouragement=encouragement)


def draw_coaching_highlights(
    image_bgr: np.ndarray,
    result,
    tip: CoachingTip,
) -> np.ndarray:
    """Thicken landmark dots for the primary tip's criterion (additive).

    Does not replace whole-hand severity coloring from ``draw_all_overlays``.
    """
    indices = CRITERION_LANDMARKS.get(tip.criterion)
    if not indices:
        return image_bgr

    annotated = image_bgr
    h, w = annotated.shape[:2]
    landmarks = result.hand.landmarks
    # Match analysis severity colors (BGR).
    color = {
        "warning": (0, 165, 255),
        "critical": (60, 60, 231),
    }.get(tip.severity, (255, 255, 255))

    for idx in indices:
        if idx >= len(landmarks):
            continue
        x, y, _ = landmarks[idx]
        cx, cy = int(x * w), int(y * h)
        cv2.circle(annotated, (cx, cy), 8, color, 2, cv2.LINE_AA)
        cv2.circle(annotated, (cx, cy), 3, (255, 255, 255), -1, cv2.LINE_AA)
    return annotated


def annotate_with_coaching(
    image_bgr: np.ndarray,
    results: list,
    scoring_config: dict,
    coaching_config: dict,
    draw_all_overlays,
) -> np.ndarray:
    """Draw base overlays, then primary-tip highlights for each hand."""
    annotated = draw_all_overlays(image_bgr, results)
    for result in results:
        report = generate_coaching(
            result.scores,
            result.severities,
            result.criterion_metrics,
            scoring_config,
            coaching_config,
        )
        if report.primary is not None:
            draw_coaching_highlights(annotated, result, report.primary)
    return annotated
