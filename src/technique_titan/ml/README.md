# Offline logistic scoring

One multinomial logistic regression per criterion. It predicts a **severity label** (`good` / `warning` / `critical`). It does not replace the 0–100 piecewise score. The language-model wording stack does not share these weights.

Install: `pip install -e ".[ml]"` (`scikit-learn`, `joblib`).

Math and the reason this exists: [`docs/ML_LOGISTIC_REGRESSION.md`](../../../../docs/ML_LOGISTIC_REGRESSION.md). The promotion rule: [`docs/ML_UPGRADE.md`](../../../../docs/ML_UPGRADE.md).

## Train

```sh
python -m technique_titan.ml.synthetic \
  --labels data/labels.csv \
  --output data/synthetic/feature_rows.csv

python -m technique_titan.ml.train \
  --labels data/labels.csv \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --split data/eval/holdout_split.json \
  --output config/models
```

`--summary` is optional when only the companion feature table is present. Hold-out ids are never training rows. `f*` filenames stay on the train side.

Each artifact is `config/models/<criterion>.joblib`: a scikit-learn pipeline of imputer, `StandardScaler`, and `LogisticRegression`. A `DummyClassifier` path exists for criteria that do not have enough class variety to fit. Artifacts are gitignored (`config/models/.gitkeep` only).

## Features

`features.py` freezes `FEATURE_NAMES`. Scores, severities, and expert labels are not inputs.

- `NUMERIC_FEATURES` — confidence, the scored metrics, eight finger angles, thumb extras, signed and raw lateral deviation, `hand_arch_ratio`, `mcp_dome_spread`, `knuckle_bridge`.
- `DERIVED_FEATURES` — for each scored metric, distance outside the YAML `ideal` interval, that distance squared, and absolute deviation from the interval center. The bands are two-sided, so a plain linear model on the raw number cannot represent “good in the middle.”
- `ONEHOT_FEATURES` — `hand_left`, `hand_right`.

Missing numbers are imputed inside the pipeline at predict time.

`matrix_from_rows` is what both training and `api/scorer.py` call, so a column drift fails loudly instead of scoring the wrong field.

## Predict in the API

`api/scorer.py` reads `SCORER`:

| Value | Behavior |
|---|---|
| `yaml` (default, and anything unrecognized) | YAML severities. Joblib is not loaded. |
| `ml_with_fallback` | For each criterion, replace the severity with `model.predict` when the label is one of the three severities. A missing file, a pickle that is not under `config/models`, or a predict error keeps YAML for that criterion. Scores stay YAML. |

`resolve_models_dir` refuses any path other than the repo `config/models` directory. The models are joblib/pickle; an arbitrary directory would be code execution.

The hold-out gate is still a person running `technique_titan.eval --scorer compare` and deciding to set the env var. The flag does not flip itself.

## Tests

`tests/engine/test_ml.py`, `tests/api/test_scorer_flag.py`, fixtures in `tests/fixtures/ml/`.
