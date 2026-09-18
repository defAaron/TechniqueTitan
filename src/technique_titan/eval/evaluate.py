"""Run the full heuristic-vs-expert agreement report."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from .constants import CRITERIA, SEVERITIES
from .labels import load_csv_rows, load_labels, merge_predictions_and_labels, unmatched_counts
from .metrics import accuracy, cohen_kappa, confusion_matrix
from .split import load_or_create_split


def _valid_severity(value: object) -> bool:
    return isinstance(value, str) and value in SEVERITIES


def _pairs_for_criterion(rows: list[dict], criterion: str) -> tuple[list[str], list[str]]:
    y_true: list[str] = []
    y_pred: list[str] = []
    true_key = f"true_{criterion}"
    pred_key = f"pred_{criterion}"
    for row in rows:
        true = row.get(true_key)
        pred = row.get(pred_key)
        if _valid_severity(true) and _valid_severity(pred):
            y_true.append(true)
            y_pred.append(pred)
    return y_true, y_pred


def _slice_stats(rows: list[dict], criterion: str) -> dict:
    y_true, y_pred = _pairs_for_criterion(rows, criterion)
    n = len(y_true)
    confusion = confusion_matrix(y_true, y_pred)
    if n == 0:
        return {"n": 0, "accuracy": None, "kappa": None, "confusion": confusion}
    return {
        "n": n,
        "accuracy": accuracy(y_true, y_pred),
        "kappa": cohen_kappa(y_true, y_pred),
        "confusion": confusion,
    }


def _macro(criteria: dict, slice_name: str) -> dict:
    accs: list[float] = []
    kappas: list[float] = []
    for name in CRITERIA:
        stats = criteria[name][slice_name]
        if stats["n"] == 0:
            continue
        accs.append(stats["accuracy"])
        kappas.append(stats["kappa"])
    return {
        "accuracy": (sum(accs) / len(accs)) if accs else None,
        "kappa": (sum(kappas) / len(kappas)) if kappas else None,
    }


def _write_confusion_csv(path: Path, confusion: dict) -> None:
    labels = confusion["labels"]
    matrix = confusion["matrix"]
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["true\\pred", *labels])
        for lab, row in zip(labels, matrix):
            writer.writerow([lab, *row])


def _fmt_metric(value: float | None, digits: int = 3) -> str:
    if value is None:
        return "—"
    return f"{value:.{digits}f}"


def render_agreement_md(report: dict) -> str:
    """Human-readable agreement tables including hold-out confusion matrices."""
    split = report["split"]
    title = report.get("title") or "Heuristic vs expert agreement"
    lines = [
        f"# {title}",
        "",
        f"- Matched rows: {report['n_matched']}",
        f"- Unmatched predictions: {report['n_unmatched_predictions']}",
        f"- Unmatched labels: {report['n_unmatched_labels']}",
        f"- Train files: {len(split['train'])} · Hold-out files: {len(split['holdout'])}",
        f"- Split seed: {split.get('seed')} · hold-out fraction: {split.get('holdout_fraction')}",
        "",
        "## Per-criterion",
        "",
        "| Criterion | Split | N | Accuracy | Cohen's κ |",
        "|---|---|---:|---:|---:|",
    ]
    for name in CRITERIA:
        for slice_name in ("all", "train", "holdout"):
            stats = report["criteria"][name][slice_name]
            lines.append(
                f"| {name} | {slice_name} | {stats['n']} | "
                f"{_fmt_metric(stats['accuracy'])} | {_fmt_metric(stats['kappa'])} |"
            )
    lines.extend(
        [
            "",
            "## Macro (unweighted mean over criteria with n>0)",
            "",
            "| Split | Accuracy | Cohen's κ |",
            "|---|---:|---:|",
        ]
    )
    for slice_name in ("all", "train", "holdout"):
        macro = report["macro"][slice_name]
        lines.append(
            f"| {slice_name} | {_fmt_metric(macro['accuracy'])} | {_fmt_metric(macro['kappa'])} |"
        )

    lines.extend(["", "## Hold-out confusion matrices", ""])
    for name in CRITERIA:
        confusion = report["criteria"][name]["holdout"]["confusion"]
        labels = confusion["labels"]
        matrix = confusion["matrix"]
        lines.append(f"### {name}")
        lines.append("")
        lines.append("| true\\pred | " + " | ".join(labels) + " |")
        lines.append("|---|" + "|".join("---:" for _ in labels) + "|")
        for lab, row in zip(labels, matrix):
            lines.append("| " + lab + " | " + " | ".join(str(v) for v in row) + " |")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_stdout_table(report: dict) -> str:
    """Compact per-criterion table for the CLI."""
    headers = (
        "criterion",
        "n_all",
        "acc_all",
        "k_all",
        "n_train",
        "acc_train",
        "k_train",
        "n_holdout",
        "acc_holdout",
        "k_holdout",
    )
    widths = {
        "criterion": 18,
        "n_all": 6,
        "acc_all": 8,
        "k_all": 7,
        "n_train": 7,
        "acc_train": 9,
        "k_train": 8,
        "n_holdout": 9,
        "acc_holdout": 11,
        "k_holdout": 10,
    }

    def cell(key: str, value: object, numeric: bool = True) -> str:
        text = str(value) if not isinstance(value, float) else _fmt_metric(value)
        if value is None:
            text = "—"
        width = widths[key]
        return text.rjust(width) if numeric else text.ljust(width)

    rows: list[str] = [" ".join(cell(h, h, numeric=(h != "criterion")) for h in headers)]
    for name in CRITERIA:
        all_s = report["criteria"][name]["all"]
        train_s = report["criteria"][name]["train"]
        hold_s = report["criteria"][name]["holdout"]
        values = {
            "criterion": name,
            "n_all": all_s["n"],
            "acc_all": all_s["accuracy"],
            "k_all": all_s["kappa"],
            "n_train": train_s["n"],
            "acc_train": train_s["accuracy"],
            "k_train": train_s["kappa"],
            "n_holdout": hold_s["n"],
            "acc_holdout": hold_s["accuracy"],
            "k_holdout": hold_s["kappa"],
        }
        rows.append(
            " ".join(
                cell(h, values[h], numeric=(h != "criterion")) for h in headers
            )
        )
    macro = report["macro"]
    values = {
        "criterion": "macro",
        "n_all": "—",
        "acc_all": macro["all"]["accuracy"],
        "k_all": macro["all"]["kappa"],
        "n_train": "—",
        "acc_train": macro["train"]["accuracy"],
        "k_train": macro["train"]["kappa"],
        "n_holdout": "—",
        "acc_holdout": macro["holdout"]["accuracy"],
        "k_holdout": macro["holdout"]["kappa"],
    }
    rows.append(" ".join(cell(h, values[h], numeric=(h != "criterion")) for h in headers))
    header_lines = [
        f"matched={report['n_matched']}  "
        f"unmatched_pred={report['n_unmatched_predictions']}  "
        f"unmatched_labels={report['n_unmatched_labels']}",
        "",
    ]
    return "\n".join(header_lines + rows) + "\n"


def render_compare_table(heuristic: dict, ml: dict) -> str:
    """Side-by-side heuristic vs ML agreement on train and hold-out slices."""
    headers = (
        "criterion",
        "n_train",
        "h_acc_tr",
        "ml_acc_tr",
        "h_k_tr",
        "ml_k_tr",
        "n_holdout",
        "h_acc_ho",
        "ml_acc_ho",
        "h_k_ho",
        "ml_k_ho",
    )
    widths = {
        "criterion": 18,
        "n_train": 7,
        "h_acc_tr": 8,
        "ml_acc_tr": 9,
        "h_k_tr": 7,
        "ml_k_tr": 8,
        "n_holdout": 9,
        "h_acc_ho": 8,
        "ml_acc_ho": 9,
        "h_k_ho": 7,
        "ml_k_ho": 8,
    }

    def cell(key: str, value: object, numeric: bool = True) -> str:
        text = str(value) if not isinstance(value, float) else _fmt_metric(value)
        if value is None:
            text = "—"
        width = widths[key]
        return text.rjust(width) if numeric else text.ljust(width)

    lines = [
        f"heuristic_matched={heuristic['n_matched']}  ml_matched={ml['n_matched']}",
        "",
        " ".join(cell(h, h, numeric=(h != "criterion")) for h in headers),
    ]
    for name in CRITERIA:
        h_tr = heuristic["criteria"][name]["train"]
        m_tr = ml["criteria"][name]["train"]
        h_ho = heuristic["criteria"][name]["holdout"]
        m_ho = ml["criteria"][name]["holdout"]
        values = {
            "criterion": name,
            "n_train": h_tr["n"],
            "h_acc_tr": h_tr["accuracy"],
            "ml_acc_tr": m_tr["accuracy"],
            "h_k_tr": h_tr["kappa"],
            "ml_k_tr": m_tr["kappa"],
            "n_holdout": h_ho["n"],
            "h_acc_ho": h_ho["accuracy"],
            "ml_acc_ho": m_ho["accuracy"],
            "h_k_ho": h_ho["kappa"],
            "ml_k_ho": m_ho["kappa"],
        }
        lines.append(
            " ".join(cell(h, values[h], numeric=(h != "criterion")) for h in headers)
        )
    h_macro = heuristic["macro"]
    m_macro = ml["macro"]
    values = {
        "criterion": "macro",
        "n_train": "—",
        "h_acc_tr": h_macro["train"]["accuracy"],
        "ml_acc_tr": m_macro["train"]["accuracy"],
        "h_k_tr": h_macro["train"]["kappa"],
        "ml_k_tr": m_macro["train"]["kappa"],
        "n_holdout": "—",
        "h_acc_ho": h_macro["holdout"]["accuracy"],
        "ml_acc_ho": m_macro["holdout"]["accuracy"],
        "h_k_ho": h_macro["holdout"]["kappa"],
        "ml_k_ho": m_macro["holdout"]["kappa"],
    }
    lines.append(" ".join(cell(h, values[h], numeric=(h != "criterion")) for h in headers))
    return "\n".join(lines) + "\n"


def _write_report(output_dir: Path, report: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "agreement.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "agreement.md").write_text(render_agreement_md(report), encoding="utf-8")
    for name in CRITERIA:
        _write_confusion_csv(
            output_dir / f"confusion_{name}.csv",
            report["criteria"][name]["holdout"]["confusion"],
        )


def evaluate(
    summary_path: Path | None,
    labels_path: Path,
    split_path: Path,
    output_dir: Path | None = None,
    *,
    summary_rows: list[dict] | None = None,
    scorer: str = "heuristic",
) -> dict:
    """Full report dict. Always include train / holdout / all slices."""
    if summary_rows is None:
        if summary_path is None:
            raise ValueError("evaluate requires summary_path or summary_rows")
        summary_rows = load_csv_rows(summary_path)
    labels = load_labels(labels_path)
    matched = merge_predictions_and_labels(summary_rows, labels, match_hand=True)
    n_unmatched_predictions, n_unmatched_labels = unmatched_counts(
        summary_rows, labels, match_hand=True
    )
    split = load_or_create_split(labels_path, split_path)

    train_set = set(split.get("train") or [])
    holdout_set = set(split.get("holdout") or [])
    for row in matched:
        filename = row["filename"]
        if filename in holdout_set:
            row["split"] = "holdout"
        elif filename in train_set:
            row["split"] = "train"
        else:
            row["split"] = None

    train_rows = [row for row in matched if row["split"] == "train"]
    holdout_rows = [row for row in matched if row["split"] == "holdout"]

    criteria: dict = {}
    for name in CRITERIA:
        criteria[name] = {
            "all": _slice_stats(matched, name),
            "train": _slice_stats(train_rows, name),
            "holdout": _slice_stats(holdout_rows, name),
        }

    titles = {
        "heuristic": "Heuristic vs expert agreement",
        "ml": "ML vs expert agreement",
    }
    report = {
        "scorer": scorer,
        "title": titles.get(scorer, f"{scorer} vs expert agreement"),
        "n_matched": len(matched),
        "n_unmatched_predictions": n_unmatched_predictions,
        "n_unmatched_labels": n_unmatched_labels,
        "split": {
            "train": split.get("train", []),
            "holdout": split.get("holdout", []),
            "seed": split.get("seed"),
            "holdout_fraction": split.get("holdout_fraction"),
        },
        "criteria": criteria,
        "macro": {
            "all": _macro(criteria, "all"),
            "train": _macro(criteria, "train"),
            "holdout": _macro(criteria, "holdout"),
        },
    }
    if output_dir is not None:
        _write_report(Path(output_dir), report)
    return report
