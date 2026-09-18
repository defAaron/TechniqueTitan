from __future__ import annotations

import json
from pathlib import Path

import pytest

sklearn = pytest.importorskip("sklearn")

from technique_titan.eval import CRITERIA, SEVERITIES, evaluate, render_compare_table
from technique_titan.ml.features import FEATURE_NAMES, derived_from_row, load_merged_feature_rows, matrix_from_rows
from technique_titan.ml.predict import load_bundle, overlay_ml_predictions, predict_severities
from technique_titan.ml.synthetic import (
    generate_feature_rows,
    is_synthetic_source,
    metric_matches_label,
    sample_metric,
    synthetic_label_rows,
)
from technique_titan.ml.train import train_models
from technique_titan.scoring import load_config

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "ml"


def test_feature_names_are_stable():
    assert FEATURE_NAMES[:3] == ("confidence", "wrist_height_delta", "wrist_knuckle_tilt")
    assert FEATURE_NAMES[-2:] == ("hand_left", "hand_right")
    assert "wrist_height_delta_outside_ideal" in FEATURE_NAMES
    assert "score_wrist_height" not in FEATURE_NAMES
    assert "severity_wrist_height" not in FEATURE_NAMES
    assert len(FEATURE_NAMES) == 37


def test_matrix_shape_matches_feature_names():
    rows = load_merged_feature_rows(None, FIXTURES / "feature_rows.csv")
    matrix = matrix_from_rows(rows)
    assert matrix.shape == (len(rows), len(FEATURE_NAMES))


def test_derived_outside_ideal_is_zero_inside_band():
    row = {"wrist_height_delta": 0.1, "mean_finger_curvature": 140.0,
           "thumb_index_angle": 35.0, "wrist_lateral_deviation_deg": 2.0,
           "hand_arch_ratio": 0.25}
    derived = derived_from_row(row)
    assert derived["wrist_height_delta_outside_ideal"] == 0.0
    assert derived["mean_finger_curvature_outside_ideal"] == 0.0
    assert derived["wrist_height_delta_outside_ideal_sq"] == 0.0


def test_is_synthetic_source():
    assert is_synthetic_source("fexcellent/1.png")
    assert is_synthetic_source("fcritical/20.png")
    assert not is_synthetic_source("excellent/1.png")
    assert not is_synthetic_source("good/1.png")


def test_sample_metric_lands_in_labeled_band():
    config = load_config()
    bands = config["severity_bands"]
    rng = __import__("random").Random(0)
    for cfg in config["criteria"].values():
        for sev in SEVERITIES:
            value = sample_metric(sev, cfg["ideal"], cfg["limit"], rng)
            assert metric_matches_label(value, sev, cfg["ideal"], cfg["limit"], bands)


def test_generated_rows_match_label_severities():
    config = load_config()
    bands = config["severity_bands"]
    labels = synthetic_label_rows()[:12]
    rows = generate_feature_rows(labels, config, seed=42)
    by_file = {}
    for row in rows:
        by_file.setdefault(row["source"], []).append(row)
    assert rows
    for label in labels:
        for row in by_file[label["filename"]]:
            for name, cfg in config["criteria"].items():
                value = float(row[cfg["metric"]])
                assert metric_matches_label(
                    value, label[name], cfg["ideal"], cfg["limit"], bands
                )
                assert row[f"severity_{name}"] == label[name]


def test_train_predict_roundtrip(tmp_path):
    from technique_titan.eval.labels import load_labels

    labels = load_labels(FIXTURES / "labels.csv")
    rows = load_merged_feature_rows(None, FIXTURES / "feature_rows.csv")
    train_files = set(json.loads((FIXTURES / "holdout_split.json").read_text())["train"])
    manifest = train_models(rows, labels, train_files, tmp_path)
    assert manifest["algorithm"] == "logistic_regression"
    assert manifest["feature_names"] == list(FEATURE_NAMES)
    assert (tmp_path / "manifest.json").is_file()
    for name in CRITERIA:
        assert (tmp_path / f"{name}.joblib").is_file()

    bundle = load_bundle(tmp_path)
    train_row = next(r for r in rows if r["source"] == "fexcellent/1.png")
    preds = predict_severities(train_row, bundle)
    assert set(preds) == set(CRITERIA)
    assert all(v in SEVERITIES for v in preds.values())


def test_evaluate_ml_report_shape(tmp_path):
    from technique_titan.eval.labels import load_labels

    labels = load_labels(FIXTURES / "labels.csv")
    rows = load_merged_feature_rows(None, FIXTURES / "feature_rows.csv")
    train_files = set(json.loads((FIXTURES / "holdout_split.json").read_text())["train"])
    train_models(rows, labels, train_files, tmp_path / "models")
    bundle = load_bundle(tmp_path / "models")
    ml_rows = overlay_ml_predictions(rows, bundle)

    heuristic = evaluate(
        None,
        FIXTURES / "labels.csv",
        FIXTURES / "holdout_split.json",
        summary_rows=rows,
        scorer="heuristic",
    )
    ml_report = evaluate(
        None,
        FIXTURES / "labels.csv",
        FIXTURES / "holdout_split.json",
        tmp_path / "reports",
        summary_rows=ml_rows,
        scorer="ml",
    )
    assert heuristic["scorer"] == "heuristic"
    assert ml_report["scorer"] == "ml"
    assert ml_report["n_matched"] == 8
    assert set(ml_report["criteria"]) == set(CRITERIA)
    for name in CRITERIA:
        for slice_name in ("all", "train", "holdout"):
            stats = ml_report["criteria"][name][slice_name]
            assert {"n", "accuracy", "kappa", "confusion"} <= set(stats)
    body = (tmp_path / "reports" / "agreement.md").read_text(encoding="utf-8")
    assert "ML vs expert agreement" in body
    table = render_compare_table(heuristic, ml_report)
    assert "h_acc_ho" in table
    assert "ml_acc_ho" in table
    assert "macro" in table


def test_cli_scorer_ml(tmp_path):
    from technique_titan.eval.labels import load_labels
    from technique_titan.eval.__main__ import main

    labels = load_labels(FIXTURES / "labels.csv")
    rows = load_merged_feature_rows(None, FIXTURES / "feature_rows.csv")
    train_files = set(json.loads((FIXTURES / "holdout_split.json").read_text())["train"])
    models_dir = tmp_path / "models"
    train_models(rows, labels, train_files, models_dir)

    code = main(
        [
            "--scorer",
            "ml",
            "--summary",
            str(tmp_path / "missing.csv"),
            "--synthetic",
            str(FIXTURES / "feature_rows.csv"),
            "--labels",
            str(FIXTURES / "labels.csv"),
            "--split",
            str(FIXTURES / "holdout_split.json"),
            "--models",
            str(models_dir),
            "--output",
            str(tmp_path / "out"),
        ]
    )
    assert code == 0
    assert (tmp_path / "out" / "agreement.json").is_file()
    loaded = json.loads((tmp_path / "out" / "agreement.json").read_text(encoding="utf-8"))
    assert loaded["scorer"] == "ml"
