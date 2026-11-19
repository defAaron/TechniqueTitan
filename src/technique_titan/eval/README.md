# Eval

Compares predicted severities to expert labels and reports whether a scoring change is real. This is the gate in front of any YAML edit and any learned scorer.

```sh
python -m technique_titan.eval \
  --summary data/processed/batch_summary.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --output data/eval/reports
```

Reports (`summary.json`, per-criterion confusion) land in `data/eval/reports/`, which is gitignored. The split file is tracked. Do not regenerate it to make a number look better.

## What “agreement” means

For each criterion the CLI pairs a predicted severity (`good` / `warning` / `critical`) with the expert column of the same name. It reports:

- accuracy
- Cohen’s κ
- a 3×3 confusion matrix
- the macro mean across the five criteria

Matching is **hand-aware**. A label row with `hand=left` or `right` joins that detected hand. `both` applies to each hand in the image. The batch CLI’s own label join is filename-only; this package re-merges.

Rows whose filename starts with the synthetic `f` prefix stay on the train side of the frozen split. The hold-out is **10 real image ids**. Last measured YAML macro accuracy on that hold-out is **0.689** (κ **0.103**) after the 2026-09-19 promotion. NFR-ACC-2 asks for ≥ 0.85. That gap is still open.

## Compare mode

```sh
python -m technique_titan.eval --scorer compare \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --models config/models \
  --output data/eval/reports
```

Prints YAML and logistic-regression hold-out side by side. Production stays on YAML until ML’s **real-image** hold-out macro accuracy is at least YAML’s. The last comparison in the coach design notes is YAML 0.689 vs ML 0.622.

## Modules

| File | Role |
|---|---|
| `evaluate.py` | Report assembly |
| `labels.py` | CSV load and hand-aware join |
| `metrics.py` | Accuracy, κ, confusion |
| `split.py` | Load the frozen id lists; create-if-missing is for tests, not for the real split |
| `paths.py` | Repo root discovery |
| `constants.py` | Criterion order and severity names shared with ML |

Threshold search is not in this package. It is [`notebooks/scoring_tuning.ipynb`](../../../../notebooks/README.md): fit on train, read hold-out, leave YAML untouched.

## Tests

`tests/engine/test_eval.py` uses `tests/fixtures/eval/`. CI runs those tests. It does not need `data/raw/`.
