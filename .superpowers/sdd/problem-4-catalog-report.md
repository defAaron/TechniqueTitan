# Problem 4 — Agent A: coaching catalog variants report

## Status

**DONE** — `config/coaching.yaml` has four variants on every warning and critical × direction cell. `load_coaching_config()` loads the file. Every variant passes `validate_tip`.

## Scope delivered

`config/coaching.yaml` only (plus this report).

- Existing `problem` and `fix` strings are unchanged versus `HEAD:config/coaching.yaml` (character-for-character).
- `encouragement` is unchanged.
- Each of the 30 cells has `variants` of length 4.
- `variants[0].problem` and `variants[0].fix` equal that cell's `problem` and `fix`.
- `variants[1]` through `variants[3]` keep the same direction (raise vs lower, tuck vs flare, thumb side vs pinky side, flat vs high arch) and are not identical to each other or to `variants[0]`.
- Warning variants stay mild. Critical variants stay stronger than the warning cell for the same direction.

Cell count: **30** (5 criteria × 2 severities × 3 directions). Variant pairs checked: **120**.

## Validation

Python: repo `.venv` (`technique_titan.coaching.load_coaching_config`, `technique_titan.coach.validate.validate_tip`).

`validate_tip` imported cleanly. Each pair was checked as `"{problem} {fix}"` with `tip_kind: "live"` (cap 220) and `score: 70`.

| Check | Result |
|---|---|
| Cells with 4 variants | 30 / 30 |
| `variants[0]` equals cell `problem` / `fix` | 30 / 30 |
| Original `problem` / `fix` vs git `HEAD` | unchanged |
| `validate_tip` rejections | 0 |
| Duplicate pairs inside a cell | 0 |
| Longest combined string | 121 characters (`wrist_height` / warning / `too_low` / variant 2) |

No sentence is close to the 220-character live cap. Nothing was left that might fail the length check.

## Concerns

None.

## Commits

None (per brief).
