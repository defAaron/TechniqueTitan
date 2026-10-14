# Problem 4 — Agent B: daily variant selector report

## Status

**DONE_WITH_CONCERNS** — selector, wire-up, and API tests are in place; catalog `variants` assertion fails until `config/coaching.yaml` is updated by the parallel agent.

## Scope delivered

### `src/technique_titan/coaching.py`

- `_USER_ID_RE`, `canonical_user_id`, `variant_index`, `lookup_variant` per brief.
- Hash: UTF-8 `canonical_user_id(user_id) + plan_key + on.isoformat()`, `sha256`, first 8 bytes big-endian `% 4`.
- `lookup_variant`: same miss rules as `_lookup_tip`; when `variants` is a list of length 4, uses `variants[variant_index(...)]`; otherwise cell `problem`/`fix`.
- `_lookup_tip` and `generate_coaching` unchanged (cell-level copy only).

### API

- `api/schemas.py`: optional `user_id: Optional[str] = None` on `CoachPlanRequest` (`extra="forbid"` preserved; plain string, not UUID type).
- `api/routes/coach.py`: `lookup_variant(..., user_id=body.user_id, plan_key=plan_key(plan), on=today)` with existing `validate_tip` / 500 behavior.
- `api/analyze_coach_plan.py`: `lookup_variant` with `user_id=None`, `on=datetime.now(timezone.utc).date()`, `plan_key=plan_key(plan)`.

### Tests

- `tests/engine/test_coaching.py`: hash/canonical tests (test-first), strict catalog loop for `variants` length 4 + `validate_tip`.
- `tests/api/test_coach_plan.py`: frozen UTC `2026-10-13` via monkeypatched `api.routes.coach.datetime`; expectations via `lookup_variant`; `user_id` invalid vs omitted; valid UUID 200 without echo in response.
- `tests/api/test_analyze_coach_plan.py`: frozen date on `api.analyze_coach_plan.datetime`; compare to `lookup_variant`.

## Pytest (verbatim, second re-run)

```
.............F.....................                                      [100%]
=================================== FAILURES ===================================
_________________ test_catalog_variants_length_and_validation __________________

coaching_config = {'encouragement': 'Nice work — your hand posture looks balanced. Keep that shape.', 'criteria': {'wrist_height': {'war...'Your wrist has a strong sideways bend.', 'fix': 'Reset so the wrist sits straight in line with the forearm.'}}}, ...}}

    def test_catalog_variants_length_and_validation(coaching_config) -> None:
        for criterion, crit_block in coaching_config["criteria"].items():
            for severity in ("warning", "critical"):
                block = crit_block[severity]
                for direction in ("too_low", "too_high", "generic"):
                    cell = block[direction]
                    variants = cell.get("variants")
>                   assert variants is not None, (
                        f"missing variants on {criterion}/{severity}/{direction}"
                    )
E                   AssertionError: missing variants on wrist_height/warning/too_low
E                   assert None is not None

tests/engine/test_coaching.py:230: AssertionError
=============================== warnings summary ===============================
.venv/lib/python3.11/site-packages/fastapi/testclient.py:1
  /Users/aarondutta/Desktop/Coding/TechniqueTitan/.venv/lib/python3.11/site-packages/fastapi/testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

.venv/lib/python3.11/site-packages/starlette/testclient.py:53
  /Users/aarondutta/Desktop/Coding/TechniqueTitan/.venv/lib/python3.11/site-packages/starlette/testclient.py:53: DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
    _PortalFactoryType = Callable[[], AbstractContextManager[anyio.abc.BlockingPortal]]

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
=========================== short test summary info ============================
FAILED tests/engine/test_coaching.py::test_catalog_variants_length_and_validation
1 failed, 34 passed, 2 warnings in 1.27s
```

## Concerns

1. **`config/coaching.yaml` has no `variants` yet** — `test_catalog_variants_length_and_validation` fails on first cell (`wrist_height/warning/too_low`). Runtime falls back to cell `problem`/`fix` until YAML lands; re-run pytest after Agent A finishes YAML.
2. **Catalog validation test** will only pass once all warning/critical × direction cells have four variants and each variant passes `validate_tip` with the synthetic plan (score 70, `tip_kind` live).

## Commits

None (per brief).

## Files touched

- `src/technique_titan/coaching.py`
- `api/schemas.py`
- `api/routes/coach.py`
- `api/analyze_coach_plan.py`
- `tests/engine/test_coaching.py`
- `tests/api/test_coach_plan.py`
- `tests/api/test_analyze_coach_plan.py`
- `.superpowers/sdd/problem-4-selector-report.md` (this file)

**Not edited:** `config/coaching.yaml`
