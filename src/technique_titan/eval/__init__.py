"""Evaluation harness: heuristic vs expert-label agreement."""

from .constants import CRITERIA, SEVERITIES
from .evaluate import evaluate, render_compare_table
from .labels import load_labels, merge_predictions_and_labels
from .metrics import accuracy, cohen_kappa, confusion_matrix
from .split import load_or_create_split

__all__ = [
    "CRITERIA",
    "SEVERITIES",
    "load_labels",
    "merge_predictions_and_labels",
    "cohen_kappa",
    "accuracy",
    "confusion_matrix",
    "load_or_create_split",
    "evaluate",
    "render_compare_table",
]
