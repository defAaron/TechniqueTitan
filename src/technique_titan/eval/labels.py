"""Load expert labels and join them to batch-summary prediction rows."""

from __future__ import annotations

import csv
from pathlib import Path

from .constants import CRITERIA

_HAND_BOTH = frozenset({"both", ""})
_HAND_SIDES = frozenset({"left", "right"})


def _norm_key(name: str) -> str:
    return name.strip().replace("\\", "/")


def _norm_hand(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _norm_severity(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def load_csv_rows(path: Path) -> list[dict]:
    """Read a CSV into a list of dicts (keys stripped)."""
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows: list[dict] = []
        for raw in reader:
            row = {(k.strip() if isinstance(k, str) else k): v for k, v in raw.items()}
            rows.append(row)
        return rows


def load_labels(path: Path) -> list[dict]:
    """Load ``data/labels.csv`` rows. Skips entries with a blank filename."""
    rows: list[dict] = []
    for raw in load_csv_rows(path):
        filename = _norm_key(raw.get("filename") or "")
        if not filename:
            continue
        cleaned = {}
        for key, value in raw.items():
            if key is None:
                continue
            cleaned[key] = value.strip() if isinstance(value, str) else value
        cleaned["filename"] = filename
        if "hand" in cleaned:
            cleaned["hand"] = _norm_hand(cleaned.get("hand"))
        rows.append(cleaned)
    return rows


def _label_indexes_for_source(source: str, labels: list[dict]) -> list[int]:
    source_key = _norm_key(source)
    if not source_key:
        return []

    exact = [i for i, lab in enumerate(labels) if lab.get("filename") == source_key]
    if exact:
        return exact

    src_base = Path(source_key).name
    base_matches = [
        i for i, lab in enumerate(labels) if Path(lab.get("filename") or "").name == src_base
    ]
    unique_names = {labels[i]["filename"] for i in base_matches}
    if len(unique_names) == 1:
        return base_matches
    return []


def _pick_label_index(
    candidate_idxs: list[int],
    labels: list[dict],
    summary_hand: str,
    *,
    match_hand: bool,
) -> int | None:
    if not candidate_idxs:
        return None

    if match_hand:
        for idx in candidate_idxs:
            label_hand = _norm_hand(labels[idx].get("hand"))
            if label_hand in _HAND_SIDES:
                if summary_hand == label_hand:
                    return idx
            elif label_hand in _HAND_BOTH:
                return idx
        return None

    for idx in candidate_idxs:
        if _norm_hand(labels[idx].get("hand")) == summary_hand and summary_hand in _HAND_SIDES:
            return idx
    for idx in candidate_idxs:
        if _norm_hand(labels[idx].get("hand")) in _HAND_BOTH:
            return idx
    return candidate_idxs[0]


def match_label_index(
    summary_row: dict,
    labels: list[dict],
    *,
    match_hand: bool = True,
) -> int | None:
    source = _norm_key(summary_row.get("source") or "")
    if not source:
        return None
    candidates = _label_indexes_for_source(source, labels)
    summary_hand = _norm_hand(summary_row.get("hand"))
    return _pick_label_index(candidates, labels, summary_hand, match_hand=match_hand)


def _matched_row(summary_row: dict, label: dict) -> dict:
    row = {
        "filename": label["filename"],
        "hand": _norm_hand(summary_row.get("hand")),
        "split": None,
    }
    for criterion in CRITERIA:
        row[f"pred_{criterion}"] = _norm_severity(summary_row.get(f"severity_{criterion}"))
        row[f"true_{criterion}"] = _norm_severity(label.get(criterion))
    return row


def merge_predictions_and_labels(
    summary_rows: list[dict],
    labels: list[dict],
    *,
    match_hand: bool = True,
) -> list[dict]:
    """Join batch summary rows to expert labels.

    Join key: summary ``source`` == label ``filename`` (also accept basename fallback).

    If match_hand is True:
      - label.hand in {left, right}: keep only summary rows whose ``hand`` matches
      - label.hand in {both, "", None}: keep all detected hands for that image
    Predicted severities live in summary as ``severity_<criterion>``.
    Expert labels live on the label row as ``<criterion>`` (NOT ``label_*``).
    Prefer labels.csv as source of truth even if summary already has ``label_*`` columns.
    """
    matched: list[dict] = []
    for summary_row in summary_rows:
        idx = match_label_index(summary_row, labels, match_hand=match_hand)
        if idx is None:
            continue
        matched.append(_matched_row(summary_row, labels[idx]))
    return matched


def unmatched_counts(
    summary_rows: list[dict],
    labels: list[dict],
    *,
    match_hand: bool = True,
) -> tuple[int, int]:
    """Return ``(n_unmatched_predictions, n_unmatched_labels)``."""
    used_labels: set[int] = set()
    n_unmatched_predictions = 0
    for summary_row in summary_rows:
        idx = match_label_index(summary_row, labels, match_hand=match_hand)
        if idx is None:
            n_unmatched_predictions += 1
        else:
            used_labels.add(idx)
    n_unmatched_labels = len(labels) - len(used_labels)
    return n_unmatched_predictions, n_unmatched_labels
