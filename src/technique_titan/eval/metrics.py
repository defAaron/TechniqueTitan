"""Agreement metrics implemented locally (no sklearn)."""

from __future__ import annotations

from .constants import SEVERITIES


def accuracy(y_true: list[str], y_pred: list[str]) -> float:
    """Fraction of paired labels that match. Empty input is NaN."""
    pairs = list(zip(y_true, y_pred))
    if not pairs:
        return float("nan")
    return sum(t == p for t, p in pairs) / len(pairs)


def cohen_kappa(
    y_true: list[str],
    y_pred: list[str],
    labels: tuple[str, ...] = SEVERITIES,
) -> float:
    """Unweighted Cohen's κ. Perfect single-class agreement returns 1.0."""
    pairs = list(zip(y_true, y_pred))
    n = len(pairs)
    if n == 0:
        return float("nan")

    p_o = sum(t == p for t, p in pairs) / n
    p_e = 0.0
    for lab in labels:
        p_true = sum(t == lab for t, _ in pairs) / n
        p_pred = sum(p == lab for _, p in pairs) / n
        p_e += p_true * p_pred

    if p_e == 1.0:
        return 1.0 if p_o == 1.0 else 0.0
    return (p_o - p_e) / (1.0 - p_e)


def confusion_matrix(
    y_true: list[str],
    y_pred: list[str],
    labels: tuple[str, ...] = SEVERITIES,
) -> dict:
    """Return ``{"labels": [...], "matrix": [[int, ...], ...]}`` with row=true, col=pred."""
    index = {lab: i for i, lab in enumerate(labels)}
    size = len(labels)
    matrix = [[0] * size for _ in range(size)]
    for true, pred in zip(y_true, y_pred):
        if true not in index or pred not in index:
            continue
        matrix[index[true]][index[pred]] += 1
    return {"labels": list(labels), "matrix": matrix}
