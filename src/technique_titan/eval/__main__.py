"""CLI: ``python -m technique_titan.eval``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .evaluate import evaluate, render_compare_table, render_stdout_table
from .paths import find_repo_root

PROCESS_FOLDER_HINT = (
    "python -m technique_titan.batch.process_folder "
    "--input data/raw --output data/processed --labels data/labels.csv"
)


def _write_named_report(output_dir: Path, report: dict, stem: str) -> None:
    from .evaluate import render_agreement_md

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"{stem}.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    (output_dir / f"{stem}.md").write_text(render_agreement_md(report), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compare batch severities against expert labels.",
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=None,
        help="batch_summary.csv (default: data/processed/batch_summary.csv)",
    )
    parser.add_argument(
        "--labels",
        type=Path,
        default=None,
        help="labels.csv (default: data/labels.csv)",
    )
    parser.add_argument(
        "--split",
        type=Path,
        default=None,
        help="Frozen split JSON (default: data/eval/holdout_split.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Report directory (default: data/eval/reports)",
    )
    parser.add_argument(
        "--scorer",
        choices=("heuristic", "ml", "compare"),
        default="heuristic",
        help="Prediction source (default: heuristic YAML severities)",
    )
    parser.add_argument(
        "--models",
        type=Path,
        default=None,
        help="Trained model directory (default: config/models)",
    )
    parser.add_argument(
        "--synthetic",
        type=Path,
        default=None,
        help="Companion feature CSV (default: data/synthetic/feature_rows.csv)",
    )
    args = parser.parse_args(argv)

    root = find_repo_root()
    summary_path = args.summary or (root / "data" / "processed" / "batch_summary.csv")
    labels_path = args.labels or (root / "data" / "labels.csv")
    split_path = args.split or (root / "data" / "eval" / "holdout_split.json")
    output_dir = args.output or (root / "data" / "eval" / "reports")
    synthetic_path = args.synthetic or (root / "data" / "synthetic" / "feature_rows.csv")
    models_dir = args.models or (root / "config" / "models")

    if not labels_path.is_file():
        print(f"error: labels file not found: {labels_path}", file=sys.stderr)
        return 1

    need_features = args.scorer in {"ml", "compare"}
    summary_exists = summary_path.is_file()
    synthetic_exists = synthetic_path.is_file()

    if args.scorer == "heuristic" and not summary_exists:
        print(f"error: batch summary not found: {summary_path}", file=sys.stderr)
        print(f"Run: {PROCESS_FOLDER_HINT}", file=sys.stderr)
        return 1

    if need_features and not summary_exists and not synthetic_exists:
        print(
            "error: need batch_summary.csv and/or a companion feature CSV "
            f"(looked for {summary_path} and {synthetic_path})",
            file=sys.stderr,
        )
        return 1

    if args.scorer == "heuristic":
        report = evaluate(summary_path, labels_path, split_path, output_dir, scorer="heuristic")
        print(render_stdout_table(report), end="")
        print(f"wrote report to {output_dir}")
        return 0

    from ..ml.features import load_merged_feature_rows
    from ..ml.predict import load_bundle, overlay_ml_predictions

    feature_rows = load_merged_feature_rows(
        summary_path if summary_exists else None,
        synthetic_path if synthetic_exists else None,
    )
    try:
        bundle = load_bundle(models_dir)
    except (ImportError, FileNotFoundError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    ml_rows = overlay_ml_predictions(feature_rows, bundle)
    ml_output = output_dir if args.scorer == "ml" else None
    ml_report = evaluate(
        summary_path if summary_exists else None,
        labels_path,
        split_path,
        ml_output,
        summary_rows=ml_rows,
        scorer="ml",
    )

    if args.scorer == "ml":
        print(render_stdout_table(ml_report), end="")
        print(f"wrote report to {output_dir}")
        return 0

    heuristic_rows = feature_rows
    heuristic_report = evaluate(
        summary_path if summary_exists else None,
        labels_path,
        split_path,
        output_dir,
        summary_rows=heuristic_rows,
        scorer="heuristic",
    )
    _write_named_report(output_dir, ml_report, "agreement_ml")
    print(render_compare_table(heuristic_report, ml_report), end="")
    print(f"wrote heuristic report to {output_dir}")
    print(f"wrote ML report to {output_dir / 'agreement_ml.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
