from __future__ import annotations

import json
from pathlib import Path

import pytest

from technique_titan.eval import (
    CRITERIA,
    SEVERITIES,
    accuracy,
    cohen_kappa,
    confusion_matrix,
    evaluate,
    load_labels,
    load_or_create_split,
    merge_predictions_and_labels,
)
from technique_titan.eval.labels import load_csv_rows

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "eval"

_GOOD = {c: "good" for c in CRITERIA}
_SEV_GOOD = {f"severity_{c}": "good" for c in CRITERIA}


def _load_merge_inputs() -> tuple[list[dict], list[dict]]:
    labels = load_labels(FIXTURES / "labels_merge.csv")
    summary = load_csv_rows(FIXTURES / "summary_merge.csv")
    return summary, labels


def test_public_constants():
    assert CRITERIA == (
        "wrist_height",
        "finger_curvature",
        "thumb_position",
        "wrist_lateral",
        "hand_arch",
    )
    assert SEVERITIES == ("good", "warning", "critical")


def test_merge_left_label_drops_other_hand():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels, match_hand=True)
    hands = {(row["filename"], row["hand"]) for row in matched}
    assert ("solo/left_only.png", "left") in hands
    assert ("solo/left_only.png", "right") not in hands


def test_merge_both_keeps_all_hands():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels, match_hand=True)
    hands = sorted(row["hand"] for row in matched if row["filename"] == "both_hands.png")
    assert hands == ["left", "right"]


def test_merge_match_hand_false_keeps_both_detected_hands():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels, match_hand=False)
    hands = sorted(row["hand"] for row in matched if row["filename"] == "solo/left_only.png")
    assert hands == ["left", "right"]


def test_merge_basename_fallback():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels)
    by_file = {row["filename"] for row in matched}
    assert "folder/nested.png" in by_file
    assert "basename_only.png" in by_file


def test_merge_exact_path_not_confused_with_same_basename():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels)
    excellent = next(row for row in matched if row["filename"] == "excellent/1.png")
    good = next(row for row in matched if row["filename"] == "good/1.png")
    assert excellent["true_wrist_height"] == "good"
    assert good["true_wrist_height"] == "warning"


def test_merge_prefers_labels_csv_over_summary_label_columns():
    summary, labels = _load_merge_inputs()
    matched = merge_predictions_and_labels(summary, labels)
    row = next(r for r in matched if r["filename"] == "prefer_labels.png")
    assert row["true_wrist_height"] == "good"
    assert row["pred_wrist_height"] == "warning"


def test_ambiguous_basename_does_not_cross_match():
    labels = [
        {"filename": "excellent/1.png", "hand": "right", **_GOOD},
        {"filename": "good/1.png", "hand": "right", **_GOOD},
    ]
    summary = [{"source": "1.png", "hand": "right", **_SEV_GOOD}]
    assert merge_predictions_and_labels(summary, labels) == []


def test_perfect_agreement_accuracy_and_kappa_are_one():
    y = ["good", "warning", "critical", "good"]
    assert accuracy(y, y) == 1.0
    assert cohen_kappa(y, y) == pytest.approx(1.0)
    single = ["warning"] * 8
    assert accuracy(single, single) == 1.0
    assert cohen_kappa(single, single) == pytest.approx(1.0)


def test_cohen_kappa_chance_level_is_zero():
    y_true = [
        "good",
        "good",
        "good",
        "warning",
        "warning",
        "warning",
        "critical",
        "critical",
        "critical",
    ]
    y_pred = [
        "good",
        "warning",
        "critical",
        "good",
        "warning",
        "critical",
        "good",
        "warning",
        "critical",
    ]
    assert cohen_kappa(y_true, y_pred) == pytest.approx(0.0)


def test_cohen_kappa_known_table():
    # pairs: (g,g), (g,g), (g,w), (w,w), (w,w)
    # p_o = 4/5 = 0.8
    # p_true: good=0.6 warning=0.4; p_pred: good=0.4 warning=0.6
    # p_e = 0.6*0.4 + 0.4*0.6 = 0.48
    # κ = (0.8 - 0.48) / (1 - 0.48) = 0.32 / 0.52 = 8/13
    y_true = ["good", "good", "good", "warning", "warning"]
    y_pred = ["good", "good", "warning", "warning", "warning"]
    assert cohen_kappa(y_true, y_pred) == pytest.approx(8 / 13)


def test_confusion_matrix_row_true_col_pred():
    result = confusion_matrix(["good"], ["warning"])
    assert result["labels"] == list(SEVERITIES)
    matrix = result["matrix"]
    assert matrix[0][1] == 1  # true=good, pred=warning
    assert matrix[1][0] == 0  # true=warning, pred=good
    assert matrix[0][0] == 0
    assert matrix[1][1] == 0


def test_split_is_deterministic(tmp_path):
    labels = FIXTURES / "labels_split.csv"
    first = load_or_create_split(labels, tmp_path / "a.json", seed=42, holdout_fraction=0.30)
    second = load_or_create_split(labels, tmp_path / "b.json", seed=42, holdout_fraction=0.30)
    assert first["train"] == second["train"]
    assert first["holdout"] == second["holdout"]
    assert first["train"] == sorted(first["train"])
    assert first["holdout"] == sorted(first["holdout"])
    assert set(first["train"]).isdisjoint(first["holdout"])
    assert first["train"] and first["holdout"]


def test_existing_split_is_not_reshuffled(tmp_path):
    labels = FIXTURES / "labels_split.csv"
    frozen = {
        "seed": 1,
        "holdout_fraction": 0.3,
        "train": ["custom/train.png"],
        "holdout": ["custom/holdout.png"],
    }
    path = tmp_path / "frozen.json"
    path.write_text(json.dumps(frozen), encoding="utf-8")
    loaded = load_or_create_split(labels, path, seed=999, holdout_fraction=0.9)
    assert loaded == frozen


def test_split_singleton_stratum_goes_to_train(tmp_path):
    split = load_or_create_split(
        FIXTURES / "labels_split.csv",
        tmp_path / "split.json",
        seed=42,
        holdout_fraction=0.30,
    )
    assert "good/1.png" in split["train"]
    assert "good/1.png" not in split["holdout"]
    assert any(name.startswith("warning/") for name in split["train"])
    assert any(name.startswith("warning/") for name in split["holdout"])
    assert any(name.startswith("excellent/") for name in split["train"])
    assert any(name.startswith("excellent/") for name in split["holdout"])


def test_evaluate_writes_output_files(tmp_path):
    output_dir = tmp_path / "reports"
    report = evaluate(
        FIXTURES / "summary_merge.csv",
        FIXTURES / "labels_merge.csv",
        tmp_path / "split.json",
        output_dir,
    )
    assert (output_dir / "agreement.json").is_file()
    assert (output_dir / "agreement.md").is_file()
    for criterion in CRITERIA:
        csv_path = output_dir / f"confusion_{criterion}.csv"
        assert csv_path.is_file()
        header = csv_path.read_text(encoding="utf-8").splitlines()[0]
        assert header.startswith("true\\pred,")
        assert "good,warning,critical" in header
    loaded = json.loads((output_dir / "agreement.json").read_text(encoding="utf-8"))
    assert loaded["n_matched"] == report["n_matched"]
    assert set(loaded["criteria"]) == set(CRITERIA)
    for name in CRITERIA:
        for slice_name in ("all", "train", "holdout"):
            stats = loaded["criteria"][name][slice_name]
            assert {"n", "accuracy", "kappa", "confusion"} <= set(stats)
    assert "macro" in loaded
    body = (output_dir / "agreement.md").read_text(encoding="utf-8")
    assert "Cohen's κ" in body
    assert (tmp_path / "split.json").is_file()


def test_evaluate_unmatched_counts_and_blank_skip(tmp_path):
    report = evaluate(
        FIXTURES / "summary_merge.csv",
        FIXTURES / "labels_merge.csv",
        tmp_path / "split.json",
    )
    assert report["n_matched"] == 9
    assert report["n_unmatched_predictions"] == 2
    assert report["n_unmatched_labels"] == 1
    # blank true wrist_height on blank_true.png is skipped, not a mismatch
    assert report["criteria"]["wrist_height"]["all"]["n"] == 8
    assert report["criteria"]["finger_curvature"]["all"]["n"] == 9


def test_cli_missing_summary_exits_1(tmp_path, capsys):
    from technique_titan.eval.__main__ import main

    code = main(
        [
            "--summary",
            str(tmp_path / "missing.csv"),
            "--labels",
            str(FIXTURES / "labels_merge.csv"),
            "--split",
            str(tmp_path / "split.json"),
            "--output",
            str(tmp_path / "out"),
        ]
    )
    captured = capsys.readouterr()
    assert code == 1
    assert "process_folder" in captured.err
    assert "--input data/raw --output data/processed --labels data/labels.csv" in captured.err
