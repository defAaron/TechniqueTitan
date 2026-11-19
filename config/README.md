# Config

Tunable product behavior that is not Python. Changing a number here changes scores or sentences without a code change. The 0–100 formula itself stays in `src/technique_titan/scoring.py`.

## `scoring.yaml`

Version string `2026-09-19-calibrated`. Promoted from [`notebooks/scoring_tuning.ipynb`](../notebooks/README.md) because hold-out macro accuracy rose from 0.622 to **0.689** (κ 0.103). The ≥ 85% target is still open. The notebook does not write this file.

| Block | Meaning |
|---|---|
| `severity_bands` | `good_min: 80`, `warning_min: 50` |
| `criteria.*.metric` | Key in `criterion_metrics` |
| `criteria.*.ideal` | Closed interval that scores 100 |
| `criteria.*.limit` | Outside this interval the score is 0; linear in between |
| `criteria.*.weight` | Composite weight. The five weights sum to 1 |
| `outliers` | Batch flags: confidence &lt; 0.6, finger angles outside 20–175°, metrics beyond 3 standard deviations |

Criterion order and weights: wrist height 0.25, finger curvature 0.25, thumb 0.15, wrist lateral 0.15, hand arch 0.20.

## `coaching.yaml`

Message catalog consumed by `technique_titan.coaching`. Each `(criterion, severity, direction)` cell has a problem, a fix, and optionally exactly four `variants`. Four variants enable the daily SHA-256 pick. Any other count uses the cell’s primary copy.

Encouragement lines are what the UI shows when `build_plan` returns nothing (every criterion good).

Templates are the production wording. The on-device model is allowed to replace them only after `validate_tip` passes, and only if the player turned the toggle on.

## `coach_direction_guards.yaml`

Phrase lists keyed by criterion and direction. `validate_tip` rejects a sentence that contains one of those phrases (for example a “lift the wrist” fix when the wrist is already too high). An empty list means no extra phrase guard. The allow-word and deny-word lists live in code (`coach/validate.py` and `web/src/lib/coachValidate.ts`), not in this file.

## `models/`

Gitignored joblib pipelines, one per criterion, produced by `python -m technique_titan.ml.train`. Only `.gitkeep` is tracked. The API loads this directory only when `SCORER=ml_with_fallback`, and only from this exact path.
