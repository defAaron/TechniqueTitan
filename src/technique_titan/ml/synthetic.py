"""Generate companion feature rows for f-prefixed paths in labels.csv."""

from __future__ import annotations

import argparse
import csv
import math
import random
import sys
from pathlib import Path

from ..eval.constants import CRITERIA
from ..eval.labels import load_labels
from ..eval.paths import find_repo_root
from ..scoring import load_config, score_all, score_metric, severity as severity_from_score

SYNTHETIC_FOLDERS = ("fexcellent", "fgood", "fwarning", "fcritical")

_JOINT_KEYS = (
    "index_pip",
    "index_dip",
    "middle_pip",
    "middle_dip",
    "ring_pip",
    "ring_dip",
    "pinky_pip",
    "pinky_dip",
)

_FOLDER_COUNTS = (
    ("fexcellent", 22),
    ("fgood", 20),
    ("fwarning", 20),
    ("fcritical", 20),
)


def is_synthetic_source(filename: str) -> bool:
    first = Path(str(filename).replace("\\", "/")).parts[0] if filename else ""
    return first in SYNTHETIC_FOLDERS


def _hand_for(index: int) -> str:
    return ("both", "left", "right")[(index - 1) % 3]


def _all_good() -> dict[str, str]:
    return {name: "good" for name in CRITERIA}


def _excellent_severities(index: int) -> dict[str, str]:
    sevs = _all_good()
    if index % 7 == 0:
        sevs[CRITERIA[(index // 7) % len(CRITERIA)]] = "warning"
    return sevs


def _good_severities(index: int) -> dict[str, str]:
    sevs = _all_good()
    sevs[CRITERIA[index % len(CRITERIA)]] = "warning"
    if index % 5 == 0:
        sevs[CRITERIA[(index + 2) % len(CRITERIA)]] = "warning"
    return sevs


def _warning_severities(index: int) -> dict[str, str]:
    sevs = _all_good()
    sevs["wrist_height"] = "warning"
    sevs[CRITERIA[index % len(CRITERIA)]] = "warning"
    if index % 4 == 0:
        sevs["hand_arch"] = "critical"
    elif index % 3 == 0:
        sevs["wrist_lateral"] = "warning"
    return sevs


def _critical_severities(index: int) -> dict[str, str]:
    sevs = {name: "warning" for name in CRITERIA}
    sevs[CRITERIA[index % len(CRITERIA)]] = "critical"
    sevs[CRITERIA[(index + 2) % len(CRITERIA)]] = "critical"
    if index % 2 == 0:
        sevs["finger_curvature"] = "good"
    return sevs


_SEVERITY_BUILDERS = {
    "fexcellent": _excellent_severities,
    "fgood": _good_severities,
    "fwarning": _warning_severities,
    "fcritical": _critical_severities,
}


def synthetic_label_rows() -> list[dict]:
    """Canonical extra label rows for f-prefixed paths."""
    rows: list[dict] = []
    for folder, count in _FOLDER_COUNTS:
        builder = _SEVERITY_BUILDERS[folder]
        for index in range(1, count + 1):
            sevs = builder(index)
            rows.append(
                {
                    "filename": f"{folder}/{index}.png",
                    "hand": _hand_for(index),
                    **sevs,
                    "notes": "n/a",
                }
            )
    return rows


def _from_score_low(score: float, ideal_lo: float, limit_lo: float) -> float:
    return limit_lo + (score / 100.0) * (ideal_lo - limit_lo)


def _from_score_high(score: float, ideal_hi: float, limit_hi: float) -> float:
    return limit_hi - (score / 100.0) * (limit_hi - ideal_hi)


def sample_metric(
    sev: str,
    ideal: list[float],
    limit: list[float],
    rng: random.Random,
) -> float:
    """Draw a metric whose YAML score falls in ``sev`` (good / warning / critical)."""
    ideal_lo, ideal_hi = float(ideal[0]), float(ideal[1])
    limit_lo, limit_hi = float(limit[0]), float(limit[1])
    if sev == "good":
        span = ideal_hi - ideal_lo
        pad = min(0.08 * span if span else 0.0, span / 4.0)
        return rng.uniform(ideal_lo + pad, ideal_hi - pad) if span > 0 else ideal_lo

    side = "low" if rng.random() < 0.5 else "high"
    if sev == "warning":
        score = rng.uniform(52.0, 78.0)
    else:
        score = rng.uniform(2.0, 46.0)

    if side == "low":
        value = _from_score_low(score, ideal_lo, limit_lo)
        if sev == "critical" and rng.random() < 0.25:
            extra = 0.12 * abs(ideal_lo - limit_lo)
            value = rng.uniform(limit_lo - extra, limit_lo)
        return value

    value = _from_score_high(score, ideal_hi, limit_hi)
    if sev == "critical" and rng.random() < 0.25:
        extra = 0.12 * abs(limit_hi - ideal_hi)
        value = rng.uniform(limit_hi, limit_hi + extra)
    return value


def _gauss_clip(rng: random.Random, mean: float, sigma: float, lo: float, hi: float) -> float:
    value = rng.gauss(mean, sigma)
    return min(hi, max(lo, value))


def _build_row(
    label: dict,
    hand: str,
    hand_index: int,
    config: dict,
    rng: random.Random,
) -> dict:
    metrics: dict[str, float] = {}
    for name, cfg in config["criteria"].items():
        sev = str(label.get(name) or "good").strip().lower()
        metrics[cfg["metric"]] = sample_metric(sev, cfg["ideal"], cfg["limit"], rng)

    mean_curve = metrics["mean_finger_curvature"]
    angles: dict[str, float] = {}
    for key in _JOINT_KEYS:
        angles[key] = round(_gauss_clip(rng, mean_curve, 3.5, 25.0, 178.0), 2)

    thumb_angle = metrics["thumb_index_angle"]
    angles["thumb_index_angle"] = round(thumb_angle, 2)
    angles["thumb_mcp_abduction"] = round(
        _gauss_clip(rng, 0.85 * thumb_angle + 18.0, 4.0, 15.0, 90.0), 2
    )

    lateral = metrics["wrist_lateral_deviation_deg"]
    angles["wrist_lateral_deviation"] = round(lateral, 2)

    arch = metrics["hand_arch_ratio"]
    angles["knuckle_bridge"] = round(_gauss_clip(rng, 176.0 - 55.0 * arch, 2.5, 130.0, 179.0), 2)
    angles["wrist_knuckle_tilt"] = round(
        _gauss_clip(rng, 88.0 + 25.0 * metrics["wrist_height_delta"], 3.0, 50.0, 130.0), 2
    )

    metrics["thumb_lateral_offset"] = round(
        _gauss_clip(rng, 0.12 + 0.004 * abs(thumb_angle - 35.0), 0.02, 0.02, 0.45), 4
    )
    metrics["mcp_dome_spread"] = round(_gauss_clip(rng, 0.03 + 0.08 * arch, 0.01, 0.002, 0.18), 4)
    metrics["wrist_height_delta"] = round(metrics["wrist_height_delta"], 4)
    metrics["mean_finger_curvature"] = round(mean_curve, 2)
    metrics["thumb_index_angle"] = round(thumb_angle, 2)
    metrics["wrist_lateral_deviation_deg"] = round(lateral, 2)
    metrics["hand_arch_ratio"] = round(arch, 4)

    scoring = score_all(metrics, config)
    confidence = round(_gauss_clip(rng, 0.93, 0.04, 0.72, 0.995), 4)

    row = {
        "source": label["filename"],
        "hand_index": hand_index,
        "hand": hand,
        "confidence": confidence,
    }
    row.update(angles)
    row.update(metrics)
    row.update({f"score_{k}": v for k, v in scoring["scores"].items()})
    row.update({f"severity_{k}": v for k, v in scoring["severities"].items()})
    row["composite_score"] = scoring["composite_score"]
    return row


def generate_feature_rows(
    labels: list[dict],
    config: dict,
    *,
    seed: int = 42,
) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    for label in labels:
        if not is_synthetic_source(label.get("filename") or ""):
            continue
        hand = str(label.get("hand") or "").strip().lower()
        hands = ["left", "right"] if hand in {"both", ""} else [hand]
        for hand_index, side in enumerate(hands):
            rows.append(_build_row(label, side, hand_index, config, rng))
    return rows


def write_feature_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def metric_matches_label(value: float, sev: str, ideal: list, limit: list, bands: dict) -> bool:
    score = score_metric(value, ideal, limit)
    if isinstance(score, float) and math.isnan(score):
        return False
    return severity_from_score(score, bands) == sev


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Write companion feature rows for f-prefixed label paths.",
    )
    parser.add_argument("--labels", type=Path, default=None, help="labels.csv")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Feature CSV (default: data/synthetic/feature_rows.csv)",
    )
    parser.add_argument("--config", type=Path, default=None, help="scoring.yaml")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    root = find_repo_root()
    labels_path = args.labels or (root / "data" / "labels.csv")
    output_path = args.output or (root / "data" / "synthetic" / "feature_rows.csv")
    if not labels_path.is_file():
        print(f"error: labels file not found: {labels_path}", file=sys.stderr)
        return 1

    config = load_config(args.config)
    labels = load_labels(labels_path)
    rows = generate_feature_rows(labels, config, seed=args.seed)
    write_feature_csv(output_path, rows)
    print(f"wrote {len(rows)} feature row(s) to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
