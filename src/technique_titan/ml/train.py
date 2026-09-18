"""Train per-criterion multinomial logistic regression on labeled feature rows."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..eval.constants import CRITERIA, SEVERITIES
from ..eval.labels import load_labels, match_label_index
from ..eval.paths import find_repo_root
from ..eval.split import load_or_create_split
from .features import FEATURE_NAMES, load_merged_feature_rows, matrix_from_rows

try:
    import joblib
    from sklearn.dummy import DummyClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError:  # pragma: no cover
    joblib = None
    DummyClassifier = None  # type: ignore[misc, assignment]
    Pipeline = None  # type: ignore[misc, assignment]


def _labeled_train_pairs(
    feature_rows: list[dict],
    labels: list[dict],
    train_files: set[str],
) -> list[tuple[dict, dict]]:
    pairs: list[tuple[dict, dict]] = []
    for row in feature_rows:
        idx = match_label_index(row, labels, match_hand=True)
        if idx is None:
            continue
        filename = labels[idx]["filename"]
        if filename not in train_files:
            continue
        pairs.append((row, labels[idx]))
    return pairs


def _criterion_xy(
    pairs: list[tuple[dict, dict]],
    criterion: str,
) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    y: list[str] = []
    for row, label in pairs:
        sev = str(label.get(criterion) or "").strip().lower()
        if sev not in SEVERITIES:
            continue
        rows.append(row)
        y.append(sev)
    return rows, y


def _make_estimator(y: list[str]) -> Any:
    classes = set(y)
    if len(classes) < 2:
        clf = DummyClassifier(strategy="constant", constant=y[0])
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("clf", clf),
            ]
        )
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "clf",
                LogisticRegression(
                    solver="lbfgs",
                    max_iter=2000,
                    C=1.0,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def train_models(
    feature_rows: list[dict],
    labels: list[dict],
    train_files: set[str],
    output_dir: Path,
) -> dict:
    if joblib is None:
        raise ImportError("scikit-learn/joblib extra required: pip install -e '.[ml]'")

    pairs = _labeled_train_pairs(feature_rows, labels, train_files)
    if not pairs:
        raise ValueError("no labeled train rows to fit")

    output_dir.mkdir(parents=True, exist_ok=True)
    n_per_criterion: dict[str, int] = {}
    for criterion in CRITERIA:
        rows, y = _criterion_xy(pairs, criterion)
        if not rows:
            raise ValueError(f"no labeled train rows for {criterion}")
        X = matrix_from_rows(rows, FEATURE_NAMES)
        estimator = _make_estimator(y)
        estimator.fit(X, y)
        joblib.dump(estimator, output_dir / f"{criterion}.joblib")
        n_per_criterion[criterion] = len(y)

    manifest = {
        "algorithm": "logistic_regression",
        "feature_names": list(FEATURE_NAMES),
        "criteria": list(CRITERIA),
        "sklearn_version": __sklearn_version(),
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "n_train_rows": len(pairs),
        "n_train_files": len({lab["filename"] for _, lab in pairs}),
        "n_per_criterion": n_per_criterion,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def __sklearn_version() -> str:
    try:
        import sklearn

        return sklearn.__version__
    except ImportError:
        return "unknown"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Train per-criterion logistic regression on labeled geometry features.",
    )
    parser.add_argument("--labels", type=Path, default=None)
    parser.add_argument("--summary", type=Path, default=None, help="Optional batch_summary.csv")
    parser.add_argument(
        "--synthetic",
        type=Path,
        default=None,
        help="Companion feature CSV (default: data/synthetic/feature_rows.csv)",
    )
    parser.add_argument("--split", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None, help="Model directory")
    args = parser.parse_args(argv)

    if joblib is None:
        print("error: install the ml extra: pip install -e '.[ml]'", file=sys.stderr)
        return 1

    root = find_repo_root()
    labels_path = args.labels or (root / "data" / "labels.csv")
    summary_path = args.summary or (root / "data" / "processed" / "batch_summary.csv")
    synthetic_path = args.synthetic or (root / "data" / "synthetic" / "feature_rows.csv")
    split_path = args.split or (root / "data" / "eval" / "holdout_split.json")
    output_dir = args.output or (root / "config" / "models")

    if not labels_path.is_file():
        print(f"error: labels file not found: {labels_path}", file=sys.stderr)
        return 1

    summary = summary_path if summary_path.is_file() else None
    synthetic = synthetic_path if synthetic_path.is_file() else None
    if summary is None and synthetic is None:
        print(
            "error: need batch_summary.csv and/or data/synthetic/feature_rows.csv",
            file=sys.stderr,
        )
        return 1

    feature_rows = load_merged_feature_rows(summary, synthetic)
    labels = load_labels(labels_path)
    split = load_or_create_split(labels_path, split_path)
    train_files = set(split.get("train") or [])
    try:
        manifest = train_models(feature_rows, labels, train_files, output_dir)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(
        f"trained {manifest['n_train_rows']} row(s) / "
        f"{manifest['n_train_files']} file(s) -> {output_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
