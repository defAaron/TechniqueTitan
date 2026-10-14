# Problem 4 — Agent B: daily variant selector

You own the Python selector and its tests. Do **not** edit `config/coaching.yaml`. Do **not** invent new coaching sentences. Do **not** commit. Do **not** push.

Read this brief first. It is the requirements, with the exact values to use verbatim.

## Where this fits

`POST /v1/coach/plan` (`api/routes/coach.py`) and photo/video copy (`api/analyze_coach_plan.py` `build_coach_plan_payload`) currently call `_lookup_tip`, which returns the cell's `problem` / `fix`. Those cells are gaining a `variants` list of 4 `{problem, fix}` objects. `variants[0]` matches the existing `problem` / `fix`. Another agent is editing the YAML at the same time. Your code must work when `variants` is present (length 4) and must keep `_lookup_tip` returning the existing cell `problem` / `fix` so `generate_coaching` and current engine tests stay on the original sentence.

## Functions (in `src/technique_titan/coaching.py`)

```python
_USER_ID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

def canonical_user_id(user_id: str | None) -> str:
    """UUID string stays; None, '', and anything else become '' (unsigned)."""

def variant_index(user_id: str | None, plan_key: str, on: date) -> int:
    """stable_hash(canonical_user_id + plan_key + on.isoformat()) mod 4.

    Hash is hashlib.sha256 of the UTF-8 concatenation, then int.from_bytes(digest[:8], 'big') % 4.
    Do not use builtin hash(). Unsigned users contribute an empty prefix, so the
    input is plan_key + YYYY-MM-DD only.
    """

def lookup_variant(
    coaching_config: dict,
    criterion: str,
    severity: str,
    direction: str,
    *,
    user_id: str | None,
    plan_key: str,
    on: date,
) -> CoachingTip | None:
    """Same miss behavior as _lookup_tip. When the cell has a variants list of
    length 4, pick variants[variant_index(...)]. Otherwise use the cell
    problem/fix (index treated as 0). Direction still collapses to generic
    unless it is too_low or too_high.
    """
```

Same inputs → same index. A different UTC date may change the index. Do not randomize per call.

## Wire-up

1. `api/schemas.py` `CoachPlanRequest`: optional `user_id: Optional[str] = None`. Keep `extra="forbid"`. Do **not** use a UUID type (a bad string must not 422). The route passes `body.user_id` into `lookup_variant`. The API must not write `user_id` anywhere and must not log the raw body. Do not use `user_id` as a database key.

2. `api/routes/coach.py`: replace the `_lookup_tip` copy pick with `lookup_variant`, using `today` (already UTC) and `plan_key(plan)`. Still `validate_tip(f"{tip.problem} {tip.fix}", plan)` and still 500 with detail `coaching template failed validation` when the chosen variant fails or the tip is missing.

3. `api/analyze_coach_plan.py` `build_coach_plan_payload`: same selector, `user_id=None` (unsigned), `on` = `datetime.now(timezone.utc).date()`, `plan_key` from the plan just built. Photo and video have no user id on the request. This is required so the same picture on the same UTC day returns the same sentences.

`generate_coaching` and `_lookup_tip` stay on the cell-level `problem` / `fix` (the original sentence). Do not day-rotate the legacy tip list.

## Tests (`tests/engine/test_coaching.py`)

Follow test-first for the hash:

- Freeze a date. `variant_index(None, key, date)` equals `variant_index("", key, date)` equals `variant_index("not-a-uuid", key, date)`.
- Calling twice with the same uuid, plan_key, and date returns the same index in `0..3`.
- A different ISO date or a different valid uuid can be asserted as stable (same call twice), not as a specific bucket, unless you compute the expected sha256 in the test.
- One test loops the loaded catalog: every warning/critical × direction cell has `variants` length 4; `variants[0]` equals the cell `problem`/`fix`; for each variant, `validate_tip(f"{problem} {fix}", plan)` returns `[]` where the plan has that criterion, severity, direction, `tip_kind` `"live"`, `score` 70, and no numbers required. Use `technique_titan.coach.validate.validate_tip`.

If the catalog loop fails only because `config/coaching.yaml` does not yet have `variants`, leave the assertion strict and say so in the report. Do not skip the test.

Update `tests/api/test_coach_plan.py` `test_spec_shaped_body_returns_plan_and_templates` so it does not assume today's hash is index 0. Freeze UTC "today" inside the route (monkeypatch `api.routes.coach.datetime` or the date helper you add) to `date(2026, 10, 13)`, call the endpoint with no `user_id`, and assert `problem`/`fix` equal the variant at `variant_index(None, plan_key, that date)`.

Update `tests/api/test_analyze_coach_plan.py` the same way: freeze the date used by `build_coach_plan_payload` and compare to `lookup_variant`, not to `_lookup_tip`, once variants exist. Until variants exist, comparing to the selected variant still works if `lookup_variant` falls back to the cell sentence.

Add one API test: `user_id` `"not-a-uuid"` returns the same `problem`/`fix` as omitting `user_id` for the frozen date. A valid uuid is accepted (200) and is not echoed as a database write. Do not add a Supabase client.

## Commands to run before you finish

```bash
source .venv/bin/activate
pytest tests/engine/test_coaching.py tests/engine/test_coach_validate.py tests/api/test_coach_plan.py tests/api/test_analyze_coach_plan.py -q
```

The catalog assertion may fail if the YAML edit is still in progress. Re-run once at the end. Report the pytest summary verbatim.

## Report

Write the full report to `.superpowers/sdd/problem-4-selector-report.md`. Return only status (DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED), commits (none), a one-line test summary, and concerns.
