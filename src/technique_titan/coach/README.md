# Coach

Chooses **one** tip and keeps it from flickering. Scoring stays in `scoring.py` and `config/scoring.yaml`. This package does not change a 0–100 number’s formula. It decides which criterion is spoken, and whether a sentence is allowed on screen.

Design contract, including the parts that are still opt-in: [`docs/PERSONALIZED_COACH.md`](../../../../docs/PERSONALIZED_COACH.md). The wording model itself runs in the browser ([`web/src/workers`](../../../../web/src/workers/README.md)), never inside this process.

## Pieces

| Module | Role |
|---|---|
| `temporal.py` | `ScoreSmoother`. EMA on each criterion score (`alpha=0.35`). Severity and direction publish only after they have been pending for `dwell_ms=1200`. Bands match YAML: 80 / 50. |
| `focus.py` | Weekly criterion from saved session aggregates. |
| `plan.py` | `build_plan` / `plan_key`. The browser is not allowed to invent criterion, severity, or direction. |
| `validate.py` | Rejects a tip string that contradicts the plan. |
| `draft_paraphrases.py` | Local MLX drafts for the training set. Not used at request time. |
| `eval_adapter.py` | Compares adapter wording against the frozen probe set. |

A TypeScript smoother with the same constants lives in `web/src/lib/scoreSmooth.ts`. Shared cases: `tests/fixtures/temporal_cases.json` (pytest and Vitest).

## Focus math

Window: sessions whose `started_on` is within **14 days**, newest **40**. Fewer than **3** sessions → `focus_criterion` is null and there is no lock.

For each criterion, burden is

```text
0.65 * mean(frac_warning + 2 * frac_critical) + 0.35 * (share of sessions whose primary_issue is this criterion)
```

The winner is the highest burden, then the higher YAML weight, then name. A lock lasts **7 days** (`locked_until = locked_on + 7`). While a lock is in force it is kept, unless:

- the last three sessions all scored ≥ 80 on the locked criterion (early completion), or
- another criterion’s burden is at least **0.08** higher, which starts a new 7-day lock.

The signed-in **progress page** is the caller that supplies history and the stored lock (`web/src/lib/coachFocus.ts` → `POST /v1/coach/plan`, then upserts `coach_focus`). Photo and video plans attached to analyze responses use an empty history (`api/analyze_coach_plan.py`). The live page posts the smoothed hand with `history: []` and `locked_focus: null` (`buildCoachPlanRequestBody`). On those screens the sentence is the acute criterion or the worst current one, not the weekly lock, until a caller starts passing that history.

## Plan

`build_plan` returns nothing when every smoothed criterion is good (the UI uses the encouragement line from `coaching.yaml`). Otherwise:

1. `acute_criterion` — a **different** criterion that is critical after dwell. Ties break by weight, then criterion order.
2. Else the focus criterion, if it is currently not good.
3. Else the worst non-good criterion (critical before warning, then weight, then order).

`plan_key` is:

```text
v1|{hand}|{criterion}|{severity}|{direction}|{tip_kind}|{focus}|{acute}
```

The live UI keeps the current sentence until `plan_key` changes. A score moving inside the same band does not call the wording model.

`tip_kind` length caps, enforced again by the validator: live ≤ 220 characters, photo ≤ 320, recap ≤ 480.

Direction (`too_low` / `too_high` / `generic`) comes from `coaching.metric_direction` against the criterion’s `ideal` interval.

Template copy is still `coaching.lookup_variant`. When a cell has four `variants`, the index is SHA-256 of the canonical user id, the plan key, and the UTC date. `POST /v1/coach/plan` passes `body.user_id` when the client sends a UUID. Analyze responses and the current live request do not, so the hash uses an empty id and the day’s variant is the same for everyone with that plan key. A non-UUID is treated as unsigned.

## Validator

`validate_tip` rejects the string unless all of these hold:

- Non-empty, one or two sentences, no markdown, no emoji.
- Length ≤ the `tip_kind` cap.
- Contains an allow-word for the criterion (wrist/knuckle, finger/curve/round, thumb, wrist/side, arch/knuckle/palm).
- Does not contain a deny stem: `diagnos`, `injur`, `doctor`, `medical`, `pain`, `surgery`, `arthritis`.
- Any number in the string is within 2 of `score`, within 0.05 of `metric_value`, or equal to an `ideal` bound.
- Direction phrases in [`config/coach_direction_guards.yaml`](../../../../config/coach_direction_guards.yaml) are absent for that `(criterion, direction)`.

The TypeScript copy is `web/src/lib/coachValidate.ts`. Both read cases from `tests/fixtures/coach_validator_cases.json`. On reject, the UI shows the template.

`POST /v1/coach/plan` builds the plan and runs the template through `validate_tip` before returning it. Analyze responses also attach a `coach_plan` via `api/analyze_coach_plan.py`.

## Training text

Reviewed lines live in [`data/coach/`](../../../../data/coach/README.md). Drafts and adapter weights are gitignored. No hosted LLM is used to paraphrase.

## Tests

`tests/engine/test_coach_temporal.py`, `test_coach_focus.py`, `test_coach_plan.py`, `test_coach_validate.py`, `test_coach_draft.py`, `test_coach_eval.py`. API coverage: `tests/api/test_coach_plan.py`, `test_analyze_coach_plan.py`.
