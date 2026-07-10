"""Batch CLI: process a folder of hand images into vectors, angles, and scores.

Usage:
    python -m technique_titan.batch.process_folder \
        --input data/raw --output data/processed [--labels data/labels.csv]

For every image found under --input (recursively):
  1. Extract MediaPipe hand landmarks (best hand kept per image).
  2. Normalize coordinates (wrist origin, palm-span scale).
  3. Compute all vectors, joint angles, and criterion metrics.
  4. Score each criterion against config/scoring.yaml.

Outputs under --output:
  landmarks/<name>.json     raw landmark coordinates per image
  metrics/<name>.json       vectors + angles + metrics + scores per image
  batch_summary.csv         one row per image, all features as columns
  outliers.csv              auto-flagged suspicious rows
  failed/failures.csv       images with no detectable hand, with reasons
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

from ..detection import HandDetector
from ..features import extract_all_features
from ..scoring import load_config, score_all

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def find_images(input_dir: Path) -> list:
    return sorted(
        p for p in input_dir.rglob("*")
        if p.suffix.lower() in IMAGE_EXTENSIONS and p.is_file()
    )


def load_labels(labels_path: Path | None) -> dict:
    """Optional labels.csv keyed by filename; merged into the summary CSV."""
    if not labels_path or not labels_path.exists():
        return {}
    labels = {}
    with open(labels_path, newline="") as f:
        for row in csv.DictReader(f):
            name = row.pop("filename", None)
            if name:
                labels[name] = row
    return labels


def process_image(detector: HandDetector, image_path: Path, config: dict) -> dict:
    """Returns a result dict, or raises ValueError when unusable."""
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("unreadable image file")

    detection = detector.detect(image)
    if not detection.found:
        raise ValueError("no hand detected")

    hand = max(detection.hands, key=lambda h: h.confidence)
    # Prefer world landmarks (meters, 3D-stable); fall back to image coords.
    coords = hand.world_landmarks if hand.world_landmarks is not None else hand.landmarks

    features = extract_all_features(coords, hand.handedness)
    scoring = score_all(features["criterion_metrics"], config)

    return {
        "hand": hand.handedness.lower(),
        "confidence": round(hand.confidence, 4),
        "detection": hand.to_dict(),
        **features,
        **scoring,
    }


def flag_outliers(rows: list, config: dict) -> list:
    """Flags rows with low confidence, implausible joint angles, or extreme
    metric z-scores relative to this batch."""
    cfg = config["outliers"]
    joint_angle_keys = [
        k for k in (rows[0].keys() if rows else [])
        if k.endswith("_pip") or k.endswith("_dip")
    ]
    zscore_metrics = ["wrist_height_delta", "hand_arch_ratio", "mean_finger_curvature"]

    stats = {}
    for m in zscore_metrics:
        values = [r[m] for r in rows if isinstance(r.get(m), (int, float)) and not math.isnan(r[m])]
        if len(values) >= 3:
            stats[m] = (float(np.mean(values)), float(np.std(values)))

    outliers = []
    for row in rows:
        reasons = []
        if row.get("confidence", 1.0) < cfg["min_confidence"]:
            reasons.append(f"low confidence ({row['confidence']})")
        for k in joint_angle_keys:
            v = row.get(k)
            if isinstance(v, (int, float)) and not math.isnan(v):
                if v < cfg["joint_angle_min_deg"] or v > cfg["joint_angle_max_deg"]:
                    reasons.append(f"implausible angle {k}={v}")
        for m, (mean, std) in stats.items():
            v = row.get(m)
            if std > 0 and isinstance(v, (int, float)) and not math.isnan(v):
                z = abs(v - mean) / std
                if z > cfg["zscore_threshold"]:
                    reasons.append(f"{m} z-score {z:.1f}")
        if reasons:
            outliers.append({**row, "outlier_reasons": "; ".join(reasons)})
    return outliers


def write_csv(path: Path, rows: list) -> None:
    if not rows:
        path.write_text("")
        return
    fieldnames: list = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def flatten_for_csv(source: str, result: dict, labels: dict) -> dict:
    row = {
        "source": source,
        "hand": result["hand"],
        "confidence": result["confidence"],
    }
    row.update(result["angles_deg"])
    row.update(result["criterion_metrics"])
    row.update({f"score_{k}": v for k, v in result["scores"].items()})
    row.update({f"severity_{k}": v for k, v in result["severities"].items()})
    row["composite_score"] = result["composite_score"]
    label = labels.get(source) or labels.get(Path(source).name)
    if label:
        row.update({f"label_{k}": v for k, v in label.items()})
    return row


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description="Batch-process hand images into geometry metrics.")
    parser.add_argument("--input", required=True, type=Path, help="Folder of raw images (searched recursively)")
    parser.add_argument("--output", required=True, type=Path, help="Output folder for JSON/CSV results")
    parser.add_argument("--labels", type=Path, default=None, help="Optional labels.csv to merge into the summary")
    parser.add_argument("--config", type=Path, default=None, help="Scoring config (default: config/scoring.yaml)")
    args = parser.parse_args(argv)

    if not args.input.is_dir():
        print(f"error: input folder not found: {args.input}", file=sys.stderr)
        return 1

    images = find_images(args.input)
    if not images:
        print(f"error: no images found under {args.input}", file=sys.stderr)
        return 1

    config = load_config(args.config)
    labels = load_labels(args.labels)

    landmarks_dir = args.output / "landmarks"
    metrics_dir = args.output / "metrics"
    failed_dir = args.output / "failed"
    for d in (landmarks_dir, metrics_dir, failed_dir):
        d.mkdir(parents=True, exist_ok=True)

    summary_rows: list = []
    failures: list = []

    print(f"Processing {len(images)} image(s) from {args.input} ...")
    with HandDetector(static_image_mode=True) as detector:
        for i, image_path in enumerate(images, 1):
            rel = str(image_path.relative_to(args.input))
            stem = rel.replace("/", "__").rsplit(".", 1)[0]
            try:
                result = process_image(detector, image_path, config)
            except ValueError as exc:
                failures.append({"source": rel, "reason": str(exc)})
                print(f"  [{i}/{len(images)}] FAILED {rel}: {exc}")
                continue

            with open(landmarks_dir / f"{stem}.json", "w") as f:
                json.dump({"source": rel, **result["detection"]}, f, indent=2)

            metrics_payload = {k: v for k, v in result.items() if k != "detection"}
            with open(metrics_dir / f"{stem}.json", "w") as f:
                json.dump({"source": rel, **metrics_payload}, f, indent=2)

            summary_rows.append(flatten_for_csv(rel, result, labels))
            print(f"  [{i}/{len(images)}] ok {rel} (composite {result['composite_score']})")

    write_csv(args.output / "batch_summary.csv", summary_rows)
    outliers = flag_outliers(summary_rows, config)
    write_csv(args.output / "outliers.csv", outliers)
    write_csv(failed_dir / "failures.csv", failures)

    print(
        f"\nDone: {len(summary_rows)} processed, {len(failures)} failed, "
        f"{len(outliers)} flagged as outliers."
    )
    print(f"  summary : {args.output / 'batch_summary.csv'}")
    print(f"  outliers: {args.output / 'outliers.csv'}")
    if failures:
        print(f"  failures: {failed_dir / 'failures.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
