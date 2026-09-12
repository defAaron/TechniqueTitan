"""CLI: ``python -m technique_titan.eval``."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .evaluate import evaluate, render_stdout_table
from .paths import find_repo_root

PROCESS_FOLDER_HINT = (
    "python -m technique_titan.batch.process_folder "
    "--input data/raw --output data/processed --labels data/labels.csv"
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compare batch heuristic severities against expert labels.",
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
    args = parser.parse_args(argv)

    root = find_repo_root()
    summary_path = args.summary or (root / "data" / "processed" / "batch_summary.csv")
    labels_path = args.labels or (root / "data" / "labels.csv")
    split_path = args.split or (root / "data" / "eval" / "holdout_split.json")
    output_dir = args.output or (root / "data" / "eval" / "reports")

    if not summary_path.is_file():
        print(f"error: batch summary not found: {summary_path}", file=sys.stderr)
        print(f"Run: {PROCESS_FOLDER_HINT}", file=sys.stderr)
        return 1
    if not labels_path.is_file():
        print(f"error: labels file not found: {labels_path}", file=sys.stderr)
        return 1

    report = evaluate(summary_path, labels_path, split_path, output_dir)
    print(render_stdout_table(report), end="")
    print(f"wrote report to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
