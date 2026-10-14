# Personalized Coach Implementation Plan

> **For agentic workers:** Implement **one problem per user request**. Use subagents inside that problem only. The stop rule in this file overrides any skill that says to continue to the next task, keep a merge loop going, or ask which execution mode to use.

**Goal:** Ship weekly-focus coaching and optional on-device wording on top of the existing photo, video, live, and progress product, without paid services.

**Architecture:** Geometry scoring (YAML, later logistic regression) produces severities. A Python `CoachPlan` decides what the sentence is about. `config/coaching.yaml` is the default renderer. A browser LoRA model is an opt-in renderer. Spec: [`docs/PERSONALIZED_COACH.md`](../../PERSONALIZED_COACH.md).

**Tech stack:** Python 3.11, FastAPI, existing in-memory rate limiter, React 19 + Vite, Supabase free tier (anon key + RLS only), scikit-learn joblib for the severity model, `mlx-lm` LoRA of `Qwen/Qwen2.5-0.5B-Instruct` trained from `mlx-community/Qwen2.5-0.5B-Instruct-4bit`, browser runtime `@huggingface/transformers` WebGPU `q4f16`.

**Next problem:** 7. Do not start it until the user asks.

---

## How to execute

Read this section every time, then read only the one problem the user named.

1. Read [`docs/errors.md`](../../errors.md) Quick checklist before editing. Do not reintroduce a listed failure.
2. Read [`docs/PERSONALIZED_COACH.md`](../../PERSONALIZED_COACH.md) sections cited by that problem. If this guide and the spec disagree, the spec wins. Update this guide’s checkbox in the doc commit for that problem so they match.
3. Dispatch the subagents listed for that problem. Subagents edit files. They do **not** commit, push, or start the next problem.
4. The parent integrates, runs the problem’s commands, runs the security checklist, makes a **staggered** set of commits (see **Commit rule**), starts the dev servers, reports to the user, and **stops**.

### Stop rule

After the commits for the current problem:

- Do not push (unless the user explicitly asks).
- Do not start the next problem.
- Do not amend commits to fold slices together.
- Do not keep working on follow-up polish.
- Wait for the user to say which problem is next.

### Commit rule

**Stagger commits, don’t dump one blob.** At the end of each problem, record work as several reviewable commits from the repo root — typically **3–8 per problem**, not one squashed change and not dozens of one-line drive-bys. Order slices so `git log` tells a story:

1. Shared fixtures or contracts (if the problem adds any).
2. Pure Python engine or library code **with its tests**.
3. Integration (reducer, API route, schema, rate limit) **with API/engine tests**.
4. Frontend library + Vitest (and `package.json` / lockfile when adding test tooling), then UI wiring.
5. Plan checkbox and small doc edits (often last; include this guide’s problem checkbox).

Stage only files that problem lists (plus `docs/errors.md` when the problem fixed a new significant failure). Each commit gets one HEREDOC message: complete sentence(s), **why** not just what. Subagents never commit; the parent stages each slice and commits in order.

Before the first commit of a problem:

```bash
git status
git diff
git log -5 --oneline
```

Never commit `.env`, `.env.local`, `service_role`, `data/coach/drafts/`, `data/coach/merged/`, `data/coach/adapters/`, `.venv-coach/`, or Hugging Face tokens.

If the user asks to split an existing commit on a branch that is **not** pushed yet, `git reset --soft HEAD~N`, unstage, and recommit in the slices above without changing the tree. Do not force-push unless the user explicitly requests it.

Repo-wide habit: [`AGENTS.md`](../../../AGENTS.md) § Git history.

### Dev environment rule

Do this after every problem, including problems with no UI change. Skip a process only if a terminal in the terminals folder already has that process running with a recent successful start.

API (repo root, existing `.venv`):

```bash
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

Web:

```bash
cd web && npm run dev
```

Confirm `GET http://127.0.0.1:8000/v1/health` returns `{"status":"ok",...}`.

Tell the user these links:

- App: http://127.0.0.1:5173
- The route named in that problem
- API health: http://127.0.0.1:8000/v1/health

### Report rule

The user-facing message contains only:

- What changed (files and behavior).
- How to test (clicks and commands), with the links above.
- The commit subjects (and short hashes if there are only a few commits); say how many commits if staggered.
- The name of the next problem, and that you are waiting.

### Subagent rule

- Give each subagent the spec sections, the file list, and the **Shared contracts** below. Do not tell a subagent to invent a second formula.
- Similar work goes to one subagent. Independent work runs at the same time.
- Subagents must not read or print secrets. They must not add `dangerouslySetInnerHTML` for coaching text.
- Parent review before commit: diff matches the problem’s file list, tests pass, security checklist for that problem is done.

---

## Global constraints

Copied from the spec. Every problem inherits these.

- **$0.** No paid API, GPU rental, Render Starter, Supabase Pro, Vercel Pro, or paid inference.
- **Python 3.11.** MediaPipe stays `0.10.21`. NumPy stays `<2`. Do not add `mlx` or `transformers` to `requirements-api.txt` or the API `Dockerfile`.
- **Language model never runs inside the API process.**
- **Browser model is opt-in** and off when `VITE_COACH_MODEL_REPO` is empty.
- **Templates always work** when the model, WebGPU, network, or validator fails.
- **API does not get the Supabase service role.** Clients use the anon key. RLS applies.
- **No analyze media in Supabase.** No model weights in Supabase storage or in git.
- **Do not raise** `RATE_LIMIT_LANDMARKS_MAX` (default 360 / 60 s).
- **Logistic regression and LoRA do not share weights.**
- **Production scorer default remains `SCORER=yaml`.**
- Live UI keeps the last good scores and tips on screen, and keeps both hands’ primary feedback co-visible.
- Local `web/.env.local` must keep the same Supabase project ref as Vercel. Do not edit that file to “fix” auth.
- npm installs run from `web/`, never the repo root.

---

## Shared contracts

Subagents use these names. Do not rename them in later problems.

### Criteria

Order and weights from `config/scoring.yaml`:

| Criterion | Metric | Weight |
|---|---|---|
| `wrist_height` | `wrist_height_delta` | 0.25 |
| `finger_curvature` | `mean_finger_curvature` | 0.25 |
| `thumb_position` | `thumb_index_angle` | 0.15 |
| `wrist_lateral` | `wrist_lateral_deviation_deg` | 0.15 |
| `hand_arch` | `hand_arch_ratio` | 0.20 |

`good` if score ≥ 80, `warning` if score ≥ 50, else `critical`.

### `ScoreSmoother`

Module: `src/technique_titan/coach/temporal.py`.

```python
@dataclass(frozen=True)
class SmoothedCriterion:
    score: float | None
    severity: str          # good | warning | critical | unknown
    direction: str         # too_low | too_high | generic

@dataclass(frozen=True)
class SmoothedHand:
    hand: str
    criteria: dict[str, SmoothedCriterion]

class ScoreSmoother:
    def __init__(
        self,
        *,
        alpha: float = 0.35,
        dwell_ms: int = 1200,
        good_min: float = 80,
        warning_min: float = 50,
    ) -> None: ...

    def update(
        self,
        hand: str,
        t_ms: int,
        scores: dict[str, float | None],
        metrics: dict[str, float | None],
        ideals: dict[str, list[float]],
    ) -> SmoothedHand: ...
```

Math (spec §3.6): `ema = 0.35 * raw + 0.65 * prev`. First frame copies raw. Missing score holds the previous ema. Severity comes from the ema. Direction comes from the raw metric vs `ideal`, and flips only after the new side has held ≥ 1200 ms. `generic` applies on the same frame the metric is missing. Clamp incoming scores to 0–100. Non-finite scores are treated as missing.

TypeScript mirror: `web/src/lib/scoreSmooth.ts` exports `createScoreSmoother()` with the same transitions. Oracle: `tests/fixtures/temporal_cases.json`.

### Focus

Module: `src/technique_titan/coach/focus.py`. Formula: spec §3.4. Do not reimplement it in TypeScript.

```python
@dataclass(frozen=True)
class FocusSession:
    started_on: date
    mean_composite: float | None
    mean_scores: dict[str, float | None]
    frac_warning: dict[str, float]
    frac_critical: dict[str, float]
    primary_issue: str | None

@dataclass(frozen=True)
class LockedFocus:
    criterion: str
    locked_on: date
    locked_until: date
    burden: dict[str, float]

@dataclass(frozen=True)
class FocusDecision:
    focus_criterion: str | None
    lock: LockedFocus | None
    burden: dict[str, float]

def choose_focus(
    sessions: list[FocusSession],
    locked: LockedFocus | None,
    today: date,
) -> FocusDecision: ...
```

Window filter (newest 40, last 14 days) happens **before** `choose_focus`. The function assumes `sessions` is already filtered. Tie-break: higher weight, then criterion name ascending. Hysteresis: switch only if `burden(new) >= burden(locked) + 0.08`. Early completion: last 3 sessions all have `mean_scores[focus] >= 80`. Fewer than 3 sessions → `focus_criterion is None` and `lock is None`.

### `CoachPlan`

Module: `src/technique_titan/coach/plan.py`. JSON shape: spec §3.1.

```python
def build_plan(
    *,
    hand: str,
    smoothed: SmoothedHand,
    metrics: dict[str, float | None],
    ideals: dict[str, list[float]],
    focus: FocusDecision,
    tip_kind: str,   # live | photo | recap
) -> dict | None: ...

def plan_key(plan: dict) -> str: ...
```

`build_plan` returns `None` when every smoothed criterion is `good` (caller shows `encouragement` from `coaching.yaml`). `criterion` is `acute_criterion` if set, else `focus_criterion` if that criterion is not `good`, else the worst current non-good (critical before warning, then higher weight, then criterion order).

Acute (spec §3.5): a non-focus criterion that has stayed `critical` for ≥ 1200 ms. The smoother’s dwell already enforces the 1200 ms before severity becomes `critical`; `build_plan` treats current smoothed `critical` on a non-focus criterion as acute. Clear acute when that criterion is no longer `critical`.

`plan_key` (spec §3.2):

```text
v1|{hand}|{criterion}|{severity}|{direction}|{tip_kind}|{focus_criterion or ""}|{acute_criterion or ""}
```

### Validator

Module: `src/technique_titan/coach/validate.py`.

```python
def validate_tip(text: str, plan: dict) -> list[str]: ...
```

Empty list means pass. Rules: spec §3.3. Caps: `live` 220, `photo` 320, `recap` 480 characters. Direction phrase guards live in `config/coach_direction_guards.yaml`. Start with an empty list for every `(criterion, direction)` key. Allow-words and deny-words are exactly the tables in spec §3.3.

TypeScript mirror in Problem 7: `web/src/lib/coachValidate.ts`, same fixture `tests/fixtures/coach_validator_cases.json`.

### HTTP

`POST /v1/coach/plan`

- Router: `api/routes/coach.py`, prefix `/v1`, registered in `api/main.py` next to `progress_router`.
- Bucket: add a branch in `api/rate_limit.py` `limiter_bucket` so a path ending in `/coach/plan` returns `"landmarks"`.
- Auth: none (same as analyze). Do not accept `user_id`. The API never writes `coach_focus`.
- Body: Pydantic model with `model_config = ConfigDict(extra="forbid")`. `history` max length **40**. `hand` enum `left|right`. Criterion keys only the five names. Score values 0–100 or null. `tip_kind` enum `live|photo|recap`. `locked_focus` optional.
- Oversize or extra fields: **422**. Empty required hand: **422**.
- Response always includes template `problem` and `fix` from `coaching.py` when `plan` is not null. `renderer` in the plan is always `"template"` from the server.
- Do not log the raw body.

### Supabase

Migration filename: `supabase/migrations/20261014000006_coach_focus.sql`. SQL: spec §3.7, including RLS policy `coach_focus_own`. Also append that SQL to `supabase/bootstrap.sql`. The client upserts with the anon client in `web/src/lib/coachFocus.ts` only when the response `lock` is non-null. `user_id` is `auth.uid()` from the session, never a field typed by the user.

---

## Security checklist

Run the items that match the problem before committing. Fix failures inside the same problem. Do not leave them for later.

| Check | Applies | Pass condition |
|---|---|---|
| Rate limit | 3, 8 | `POST /v1/coach/plan` is in the `landmarks` bucket. A test sends requests past the limiter and expects 429 with `Retry-After`. Existing `/score/landmarks`, `/analyze/frame`, and `/progress/reduce` buckets stay as they are. |
| Body limits | 3 | 41 history entries → 422. Unknown JSON field → 422. Non-finite scores → 422. |
| AuthZ | 2, 3 | No `service_role` anywhere under `web/` or in the diff. `coach_focus` RLS is `auth.uid() = user_id` for `using` and `with check`. API does not write that table. |
| Injection | 3, 4, 7 | `problem` and `fix` render as React text. No `dangerouslySetInnerHTML`. Model output cannot set `criterion` or `severity`. |
| Malicious metrics | 1, 3 | NaN, inf, negative, and >100 scores cannot crash the smoother or the route. |
| Path / pickle | 8 | `joblib.load` reads only `config/models/<criterion>.joblib` resolved under the repo `config/models` directory. The request body cannot choose the path. |
| Secrets in git | all | `git diff --cached` contains no `.env`, anon key values, tokens, or adapter weights. |
| Prompt data | 7 | The worker’s user message is the short plan JSON from spec §5.1. It does not include `history`, email, or user id. Weights download from Hugging Face. Inference stays in the browser. |
| CORS | 3 | Do not set `CORS_ORIGINS=*` together with `allow_credentials=True`. Leave `api/main.py` CORS logic as it is. |
| Docker | 6, 7, 8 | `Dockerfile` does not copy `data/coach/` or install `mlx-lm`. Phase 8 may copy joblib only if the hold-out gate passed. |

---

## Problem 1 — Temporal smoother

**Purpose:** A one-frame blip no longer changes the primary tip. Saved session summaries use the same smoothed scores.

**Context:** Live scoring is already throttled through `POST /v1/score/landmarks`. Tips today follow each response. `src/technique_titan/progress/reducer.py` picks `primary_issue` from raw ticks. There is no Vitest script in `web/package.json`. Photo mode has no frame series; do not change it.

**Subagents (parallel after the parent writes the fixture):**

| Agent | Owns | Does not touch |
|---|---|---|
| A Python | `src/technique_titan/coach/__init__.py`, `temporal.py`, `tests/engine/test_coach_temporal.py`, reducer call | `web/` |
| B TypeScript | `web/src/lib/scoreSmooth.ts`, `web/src/lib/scoreSmooth.test.ts`, Vitest devDependency and `"test": "vitest run"` in `web/package.json`, `LivePractice.tsx` wiring | `src/`, `api/` |

Parent writes `tests/fixtures/temporal_cases.json` first, with these cases, then starts A and B together:

Severity is the band of the EMA (spec §3.6), not the band of the raw score. A new EMA band is published only after a later sample is still in that band at least 1200 ms after the first sample that entered it. The opening sample publishes immediately. These are the fixture cases:

1. First frame score 40 → severity `critical`, ema 40.
2. Frame at t=0 score 40, frame at t=100 score 90 → ema 57.5, severity stays `critical` (the warning band has not been held).
3. Score 40 at t=0, then score 100 at t=1200, 2400, 3600, and 4800 → ema ends at 89.289625 and severity becomes `good` only on the last sample. One sample of 90 at t=1200 does not: its ema is still 57.5, so it cannot be `good`.
4. Metric on the `too_low` side of ideal, then one sample on `too_high` at +100 ms → direction stays `too_low`.
5. That `too_high` side is still present 1200 ms after it first appeared → direction `too_high`.
6. Score `NaN` → previous ema held.
7. Score 140 → clamped to 100 before the ema.

**Subproblems:**

- [x] **1.1** Fixture file, then agent A implements `ScoreSmoother` to match it. Tests fail before the implementation exists.
- [x] **1.2** Agent A calls `ScoreSmoother.update` inside `reducer.py` on kept ticks **before** `primary_issue` / mean scores are computed. Existing `tests/engine/test_progress.py` still passes. Add one reducer test: a single critical tick between warnings does not become `primary_issue` when timestamps are 100 ms apart.
- [x] **1.3** Agent B adds Vitest and ports the fixture. `cd web && npm run test` passes.
- [x] **1.4** Agent B feeds landmark-score severities through `createScoreSmoother()` in `web/src/pages/LivePractice.tsx` before the tip string changes. Do not add an endpoint, a table, or a model.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coach_temporal.py tests/engine/test_progress.py -q
cd web && npm run test && npm run build
```

**Security:** Checklist rows “Malicious metrics” and “Secrets in git”. No new endpoint.

**Manual test:** http://127.0.0.1:5173/live — start the camera, hold a steady pose, then flick a bad pose for a fraction of a second. The primary tip stays on the steady pose. Photo at http://127.0.0.1:5173/photo still returns a tip with no smoother UI.

**Commit subject:** `Smooth live and saved posture scores before choosing a tip`

- [x] Problem 1 committed

---

## Problem 2 — Weekly focus math and table

**Purpose:** Pure function chooses one criterion for seven days. The free Supabase project can store one row per user. No UI yet.

**Context:** Session rows already exist (`practice_sessions`, `session_hands`) and are written from `web/src/lib/progress.ts`. The API must not gain a Supabase client.

**Subagents (parallel):**

| Agent | Owns |
|---|---|
| A Focus | `src/technique_titan/coach/focus.py`, `tests/engine/test_coach_focus.py` |
| B Schema | `supabase/migrations/20261014000006_coach_focus.sql`, the matching block in `supabase/bootstrap.sql`, a short paragraph in `supabase/README.md` |

**Subproblems:**

- [x] **2.1** Agent A: tests first. Empty list → null focus. Two sessions → null. Three sessions → burden winner using spec §3.4. Tie on burden → higher weight (`finger_curvature` beats `thumb_position`). Locked criterion stays when the challenger leads by 0.07. Challenger leading by 0.08 switches and sets `locked_until = today + 7 days`. Three latest sessions with focus score ≥ 80 clear the lock and recompute. Unknown criterion names in `primary_issue` are ignored, not trusted.
- [x] **2.2** Agent B: SQL from spec §3.7. `check` constraint is the five criterion names. RLS policy name `coach_focus_own`. Enable RLS. No insert policy for the service role. No storage bucket.
- [x] **2.3** Parent: do not apply the migration to a remote database from the agent session. Tell the user to paste the migration into the Supabase SQL editor for the existing Technique Titan project.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coach_focus.py tests/engine/test_coach_temporal.py -q
```

**Security:** Checklist row “AuthZ”. Confirm the SQL has both `using` and `with check`. Confirm `burden jsonb` is not a place for images: document in the README that the client may store only the five numeric burden values.

**Manual test:** `pytest` above. Then, if the user has applied the SQL, in the Supabase table editor confirm `coach_focus` exists and RLS is on. App link for a smoke check that nothing else broke: http://127.0.0.1:5173/progress

**Commit subject:** `Add weekly-focus selection and coach_focus table`

- [x] Problem 2 committed

---

## Problem 3 — Coach plan endpoint

**Purpose:** One Python function builds the plan. The UI shows template sentences from that plan. Unsigned users still get a tip.

**Context:** `generate_coaching` / `_lookup_tip` in `src/technique_titan/coaching.py`. Rate buckets live in `api/rate_limit.py`. Live page already calls `/v1/score/landmarks`. Progress save stays in the browser.

**Subagents:**

Wave 1 (parallel):

| Agent | Owns |
|---|---|
| A Plan | `plan.py`, `tests/engine/test_coach_plan.py` |
| B Validator | `validate.py`, `config/coach_direction_guards.yaml`, `tests/fixtures/coach_validator_cases.json`, `tests/engine/test_coach_validate.py` |

Wave 2 (after wave 1 function names exist):

| Agent | Owns |
|---|---|
| C API | `api/routes/coach.py`, `api/schemas.py` request/response models, `api/main.py` include, `api/rate_limit.py` bucket, `tests/api/test_coach_plan.py` |

Wave 3 (parallel, after C’s response JSON is fixed):

| Agent | Owns |
|---|---|
| D Live | `web/src/lib/coachPlan.ts` (fetch + last `plan_key`), `LivePractice.tsx` |
| E Analyze | In-process `build_plan` from the photo and video handlers; pass `coach_plan` through the existing response types in `web/src/lib/api.ts`; show the strings in `PhotoAnalyze.tsx` and `VideoAnalyze.tsx` |
| F Progress | `web/src/lib/coachFocus.ts` upsert; `ProgressPage.tsx` shows the locked criterion and `locked_until`, or the sentence “Practice a few times to get a weekly focus.” |

**Subproblems:**

- [x] **3.1** Agent A: `build_plan` and `plan_key` per Shared contracts. Acute critical beats a warning focus. All-good hand returns `None`.
- [x] **3.2** Agent B: validator cases for too long, deny-word `doctor`, missing allow-word, a number that is not the score, and a clean template sentence that passes.
- [x] **3.3** Agent C: route spec §3 in the spec’s request/response example. Call `validate_tip` on the template strings; if a template fails, return 500 with a fixed detail `coaching template failed validation` (that is a bug, not user input). Rate-limit test uses a limiter with `max_requests=2` via the existing `build_limiters_from_env` pattern in API tests, not by hammering the real default of 360.
- [x] **3.4** Agent D: call `/v1/coach/plan` only when `plan_key` would change. On network failure, keep the tip already on screen. Do not clear the camera.
- [x] **3.5** Agent E: photo and video responses include the same `problem` / `fix` fields the pages already render, sourced from `build_plan`. Do not remove `AddToProgressButton`.
- [x] **3.6** Agent F: upsert `coach_focus` only for a signed-in user when `lock` is non-null. Use the user id from the Supabase session.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coach_plan.py tests/engine/test_coach_validate.py tests/api/test_coach_plan.py -q
cd web && npm run test && npm run build
```

**Security:** All checklist rows that apply to problem 3. Extra: a history entry whose `primary_issue` is `../` or `<script>` is ignored by `choose_focus` and cannot appear in `plan_key`.

**Manual test:**

- http://127.0.0.1:5173/live — tip updates when you hold a bad pose, not on a flicker.
- http://127.0.0.1:5173/photo — upload a hand photo; tip still appears.
- http://127.0.0.1:5173/progress — signed out shows the empty-focus sentence; signed in with a lock shows the criterion and date.
- `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8000/v1/coach/plan -H 'content-type: application/json' -d '{"hand":"right","extra":1}'` → `422`.

**Commit subject:** `Serve template coaching from a coach plan`

- [x] Problem 3 committed

---

## Problem 4 — Template variants

**Purpose:** The same plan shows a different approved sentence on a different UTC day, without a model download.

**Context:** Problem 3’s route is the only place that picks copy for new UI. `coaching.yaml` today has one `problem` and one `fix` per cell.

**Subagents (parallel):**

| Agent | Owns |
|---|---|
| A Catalog | `config/coaching.yaml` — add `variants` (length 4) on every warning/critical × direction cell. `variants[0]` is the sentence that already exists. Write three more pairs that pass the validator and keep the same meaning. |
| B Selector | `src/technique_titan/coaching.py` index `stable_hash(user_id + plan_key + UTC date) % 4`. Unsigned `user_id` is `""`. Same inputs → same index. `tests/engine/test_coaching.py` updates. Wire the index into `api/routes/coach.py`. Optional `user_id` on the request is a uuid string or omitted; it selects copy only. It must not be written to the database by the API. |

Agent B does not invent new sentences. Agent A does not change hash code.

**Subproblems:**

- [x] **4.1** Four variants per existing cell. YAML still loads with `load_coaching_config`.
- [x] **4.2** Hash selection. A test freezes the date and asserts index stability.
- [x] **4.3** Every variant passes `validate_tip` for a matching plan. One test loops the catalog.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coaching.py tests/engine/test_coach_validate.py tests/api/test_coach_plan.py -q
```

**Security:** Checklist “Injection”. Variant text is plain sentences. The optional `user_id` is matched with a UUID regex; anything else is treated as unsigned. Do not use it as a lookup key on the server.

**Manual test:** http://127.0.0.1:5173/photo — note the tip. The tip must not change when you re-upload the same picture on the same UTC day. It may change the next UTC day. Live http://127.0.0.1:5173/live still holds one sentence across frames of the same pose.

**Commit subject:** `Rotate approved coaching sentences by day`

- [x] Problem 4 committed

---

## Problem 5 — Training-set tools

**Purpose:** A reviewed JSONL can be built later on this Mac. This problem does not train and does not download the 0.5B weights unless they are already on disk.

**Context:** Spec §5. Human review is required before LoRA. The agent must not call a paid model to paraphrase.

**Subagents (parallel):**

| Agent | Owns |
|---|---|
| A Format | `data/coach/README.md`, `data/coach/accepted.jsonl` seeded with **one** validator-passing line per `(criterion, severity, direction)` taken from `variants[0]`, `data/coach/probe.jsonl` with **25** hand-checked plans that are **not** copies of those lines (short plans, expected JSON tips). `.gitignore` entries: `data/coach/drafts/`, `data/coach/merged/`, `data/coach/adapters/`, `.venv-coach/` |
| B Drafter | `src/technique_titan/coach/draft_paraphrases.py` and `tests/engine/test_coach_draft.py`. The test uses a fake generator function, not MLX. CLI flags match spec §5.2. The CLI refuses to run if `--model` is not `mlx-community/Qwen2.5-0.5B-Instruct-4bit`. Output directory must stay under `data/coach/drafts/`. |

**Subproblems:**

- [x] **5.1** Gitignore and README. README states drafts are unreviewed and must not be trained on.
- [x] **5.2** Seed `accepted.jsonl` from templates. A test loads every line and runs `validate_tip`.
- [x] **5.3** Drafter CLI with an injected generator in tests. Path escape `data/coach/drafts/../../.env` is rejected.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coach_draft.py tests/engine/test_coach_validate.py -q
git check-ignore -v data/coach/drafts/base.jsonl data/coach/adapters/adapters.safetensors
```

**Security:** Checklist “Secrets in git” and path check in 5.3. Do not run the real model in this problem.

**Manual test:** Open `data/coach/accepted.jsonl` and confirm it is text, not weights. App smoke: http://127.0.0.1:5173/photo still coaches. Tell the user the later command (do not run it now):

```bash
python -m technique_titan.coach.draft_paraphrases \
  --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
  --templates config/coaching.yaml \
  --output data/coach/drafts/base.jsonl \
  --per-cell 8
```

**Commit subject:** `Add reviewed-only coaching training set tools`

- [x] Problem 5 committed

---

## Problem 6 — LoRA train scripts and gate

**Purpose:** Adapter training can be reproduced on an Apple Silicon Mac. Weights stay local. The API image does not change.

**Context:** Spec §6. Prerequisite: Apple Silicon and ≥ 8 GB unified memory. If `uname -m` is not `arm64`, skip the train command, commit the scripts, and tell the user training cannot run on this machine without a paid GPU (which is forbidden).

**Subagents (parallel):**

| Agent | Owns |
|---|---|
| A Eval | `src/technique_titan/coach/eval_adapter.py`, `tests/engine/test_coach_eval.py` with a fake completer. Gate function returns pass only when validator rate ≥ 0.95 on dev **and** on `data/coach/probe.jsonl`. |
| B Docs and deps | `requirements-coach.txt` containing exactly `mlx-lm==0.30.2` (the pin used by current MLX Qwen conversions; if install fails, pin the version that successfully imports and record it in `data/coach/TRAIN.md`). `data/coach/TRAIN.md` with the `mlx_lm.lora` and `mlx_lm.fuse` commands from spec §6.2 and §6.4. Confirm `Dockerfile` and `requirements-api.txt` do not mention `mlx`. |

**Subproblems:**

- [x] **6.1** Eval gate unit tests. A 94% pass rate fails the gate. A 95% pass rate on both sets passes.
- [x] **6.2** `requirements-coach.txt` and `TRAIN.md`. Install into `.venv-coach` only: `python3.11 -m venv .venv-coach && .venv-coach/bin/pip install -r requirements-coach.txt`.
- [x] **6.3** If `arm64` and `accepted.jsonl` has at least 200 lines, run `mlx_lm.lora` with the spec flags, then `eval_adapter`. If the gate fails, do not fuse and do not treat that as a commit failure: commit the scripts and write the measured rate in `TRAIN.md`. If there are fewer than 200 accepted lines, do not train; `TRAIN.md` says the seed set is templates only and training waits for a human review. Do not pad the file with unreviewed drafts to fake the count.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/engine/test_coach_eval.py -q
git check-ignore -v .venv-coach/pyvenv.cfg data/coach/adapters/adapters.safetensors
grep -n mlx Dockerfile requirements-api.txt || true
```

The `grep` must print nothing.

**Security:** Checklist “Docker” and “Secrets in git”. Adapter files gitignored.

**Manual test:** `pytest` above. http://127.0.0.1:5173/live still uses templates. No model toggle yet.

**Commit subject:** `Add local LoRA eval gate for coaching copy`

- [x] Problem 6 committed

---

## Problem 7 — Browser wording toggle

**Purpose:** A signed-in or signed-out user can opt in to on-device sentences. The default remains templates. Render’s process list does not include the language model.

**Context:** Spec §7. Do not upload weights in this problem unless the user has already created the Hugging Face repo and `huggingface-cli` is logged in **outside** the repo. Never write a token into a file. If the repo does not exist, ship the code with both Vite vars empty so the toggle stays hidden.

**Subagents:**

Wave 1 (parallel):

| Agent | Owns |
|---|---|
| A Validator port | `web/src/lib/coachValidate.ts` and its Vitest, fixture `tests/fixtures/coach_validator_cases.json` |
| B Worker | `web/src/workers/coachModel.worker.ts` |

Wave 2:

| Agent | Owns |
|---|---|
| C Settings | Toggle “Varied tip wording” on the existing account/settings surface, `localStorage` key `tt-coach-model` values `0` and `1`, default off. Hide the toggle when `import.meta.env.VITE_COACH_MODEL_REPO` is empty. Wire live and photo to ask the worker only after a `plan_key` change, then validate, with a 2500 ms timeout back to the template. |

**Subproblems:**

- [ ] **7.1** TS validator matches the Python fixture.
- [ ] **7.2** Worker loads `@huggingface/transformers` only after the toggle is turned on. `device: "webgpu"`, `dtype: "q4f16"`, `revision` from `VITE_COACH_MODEL_REVISION`. User message is the short plan JSON only. Parse `{problem, fix}`. Any error posts `{ ok: false }`.
- [ ] **7.3** `navigator.gpu` missing → leave the toggle off and show “This browser can’t run on-device wording.” Download progress does not remove the camera or the template tip.
- [ ] **7.4** Add the two vars to `web/.env.example` with empty values and a comment that they are public repo ids, not secrets. Do not fill `.env.local`.

**Commands:**

```bash
cd web && npm run test && npm run build
grep -n "mlx\|transformers" ../Dockerfile ../requirements-api.txt || true
```

**Security:** Checklist rows “Injection”, “Prompt data”, “Secrets in git”, “Docker”. Search the diff for `dangerouslySetInnerHTML` and for any `fetch` to an inference URL (`api.openai.com`, `api.groq.com`, Hugging Face `pipeline` inference). The only network for the model is the weight download Transformers.js performs from the configured repo.

**Manual test:**

- With env vars empty: http://127.0.0.1:5173/live — no wording toggle, tips still show.
- If vars are set and WebGPU exists: turn the toggle on, confirm the template stays visible during download, then a new pose produces a sentence or falls back. Turn the toggle off and confirm no further generation.
- Narrow viewport: camera and the primary tip still fit without the tip moving off screen.

**Commit subject:** `Add opt-in on-device coaching wording`

- [ ] Problem 7 committed

---

## Problem 8 — Severity model flag

**Purpose:** The API can use the existing logistic regression models when they beat YAML. Default stays YAML. This problem does not change LoRA code.

**Context:** `src/technique_titan/ml/predict.py` loads `config/models/<criterion>.joblib`. Last measured hold-out: YAML macro **0.689**, ML **0.622**. Spec §1.2 gate.

**Subagents (parallel):**

| Agent | Owns |
|---|---|
| A Flag | `SCORER` env read in the score path used by analyze and `/v1/score/landmarks`. Values `yaml` (default) and `ml_with_fallback`. On ML exception or `unknown`, that criterion uses YAML. `tests/api/test_scorer_flag.py` with a temporary directory of fake joblib pipelines built in the test, not the real models. |
| B Gate note | Run the compare command from `docs/ML_UPGRADE.md` **only if** `data/processed/batch_summary.csv`, `data/labels.csv`, and `config/models/*.joblib` exist locally. Write the numbers into `docs/ML_UPGRADE.md` if they differ. If ML macro < YAML macro, do **not** `COPY` models in the `Dockerfile` and do not commit joblib files. If the data is missing, skip the compare and say so in the user report. The flag code still ships, defaulting to YAML. |

**Subproblems:**

- [ ] **8.1** Request body cannot select the model directory. Resolve paths with `Path(models_dir).resolve()` and require it equal `Path("config/models").resolve()`.
- [ ] **8.2** Test: `SCORER=yaml` ignores joblib. `SCORER=ml_with_fallback` uses the fake pipeline. A throwing pipeline falls back per criterion.
- [ ] **8.3** Dockerfile unchanged unless the gate passed. Render env is not modified from here; tell the user the dashboard variable stays unset.

**Commands:**

```bash
source .venv/bin/activate
pytest tests/api/test_scorer_flag.py tests/engine/test_ml.py -q
cd web && npm run build
```

**Security:** Checklist “Path / pickle”. Confirm no endpoint accepts a file upload of a `.joblib`.

**Manual test:** http://127.0.0.1:5173/photo — score still returns with the server started **without** `SCORER` set. Health: http://127.0.0.1:8000/v1/health

**Commit subject:** `Gate learned severity scores behind SCORER`

- [ ] Problem 8 committed

---

## Problem map

| Problem | User-visible result | Subagents |
|---|---|---|
| 1 Smoother | Live tips stop flickering | Python, TypeScript |
| 2 Focus | None yet (function + SQL) | Focus, Schema |
| 3 Plan API | Template tips from one plan; progress shows the weekly criterion | Plan, Validator, then API, then Live, Analyze, Progress |
| 4 Variants | Sentence can change by UTC day | Catalog, Selector |
| 5 Data tools | No UX change | Format, Drafter |
| 6 LoRA scripts | No UX change | Eval, Docs |
| 7 Browser model | Opt-in wording, hidden until env is set | Validator port, Worker, then Settings |
| 8 Scorer flag | No UX change while `SCORER` is unset | Flag, Gate note |
