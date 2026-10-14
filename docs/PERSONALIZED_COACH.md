# Personalized coach — build plan

**Status:** Plan only. Nothing in this document is implemented.
**Last updated:** 2026-10-13
**Companions:** [`ML_UPGRADE.md`](./ML_UPGRADE.md), [`ML_LOGISTIC_REGRESSION.md`](./ML_LOGISTIC_REGRESSION.md), [`DEPLOY.md`](./DEPLOY.md), [`supabase/README.md`](../supabase/README.md), [`superpowers/plans/2026-10-13-personalized-coach.md`](./superpowers/plans/2026-10-13-personalized-coach.md) (agent build guide)

This is the start-to-finish plan for weekly-focus coaching and varied
wording. Scoring stays geometry. Wording stays a separate renderer.
Logistic regression and the language model do not share weights.

---

## 0. Hard constraints

These choices are locked. Do not reopen them without editing this file.

| Constraint | Decision |
|---|---|
| Cash | **$0.** No paid API, GPU rental, Render Starter, Supabase Pro, Vercel Pro, or paid model host. |
| Hosts that stay | Existing **free** tiers only: Vercel (SPA), Render free (FastAPI Docker), Supabase free (auth + scores). |
| Language model in production | **Never on Render.** Free instances are ~512 MB and already run MediaPipe. A 0.5B model does not fit beside that process. |
| Language model at inference | **In the browser**, opt-in, WebGPU, weights downloaded from a **public Hugging Face repo** (free). Cache in the browser. If WebGPU, download, latency, or the validator fails, use `config/coaching.yaml`. |
| Training | **Developer Mac, Apple Silicon, MLX.** No cloud trainer. |
| Third-party LLM APIs | Forbidden. Including for paraphrasing the training set. |
| Media in Supabase | Still forbidden. Progress rows stay scores and tips. Model weights do **not** go in the `avatars` bucket or any new bucket. |
| What “fully functional” means before the language model exists | Photo, video, live, and `/progress` already work. After Phases 1–4 they also do smoothing, weekly focus, and template copy. The language model is an optional wording layer on top of that. |

---

## 1. Locked model and library names

### 1.1 Language model

| Role | Exact name |
|---|---|
| Base weights (Apache-2.0) | [`Qwen/Qwen2.5-0.5B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) |
| Why this one | Apache-2.0 (the Qwen2.5 **3B** and **72B** checkpoints are not). 0.5B is the largest size that is realistic for a free browser download and for LoRA on an 8 GB Mac. |
| MLX weights used **only for training** | [`mlx-community/Qwen2.5-0.5B-Instruct-4bit`](https://huggingface.co/mlx-community/Qwen2.5-0.5B-Instruct-4bit) |
| Training library | `mlx-lm` (Apple MLX). Pin the version in `requirements-coach.txt` the day training starts; do not float. |
| LoRA targets | `q_proj`, `k_proj`, `v_proj`, `o_proj` |
| LoRA rank / alpha / dropout | `r=8`, `alpha=16`, `dropout=0.05`, `seed=0` |
| Optimizer | AdamW, learning rate `1e-4`, 600 iterations, batch size 4, max sequence length 512 |
| Merged training artifact (local, gitignored) | `data/coach/merged/` — full merged MLX weights after `mlx_lm.fuse` |
| Browser artifact | ONNX **q4f16**, hosted at a public repo created in Phase 7. Repo name: `technique-titan-coach-onnx`. Account: a free Hugging Face user the maintainer creates. The repo URL is **not** hardcoded until that upload exists; the web app reads `VITE_COACH_MODEL_REPO`. |
| Browser runtime | `@huggingface/transformers` (Transformers.js), `device: "webgpu"`, `dtype: "q4f16"` |
| Browser download size | About **460 MB** once, then Cache Storage. That is why the model is **off by default**. |
| Generation caps | `max_new_tokens: 64`, `temperature: 0.7`, `top_p: 0.9`, `do_sample: true`. One generation per plan change, not per frame. Abort the worker if it has not finished in **2500 ms**. |

Rejected:

| Option | Why it is rejected under $0 |
|---|---|
| Any OpenAI / Anthropic / Groq / hosted-inference API | Costs money or is a wrapper. |
| Qwen2.5-1.5B or larger | Download and RAM blow the “efficient” budget on phones and on 8 GB Macs. |
| Running the 0.5B model inside the Render container | Free tier RAM. |
| Putting ONNX weights in the git repo or the Vercel deployment | Repo and bandwidth. Weights stay on Hugging Face. |
| Supabase Storage for weights | Free file quota is for avatars; a 460 MB file would crowd it and is the wrong host. |

### 1.2 Severity model (already in the repo, separate from LoRA)

| Role | Exact name |
|---|---|
| Algorithm | L2 multinomial logistic regression per criterion: `StandardScaler` + `LogisticRegression` in scikit-learn |
| Code | `src/technique_titan/ml/train.py`, `predict.py`, `features.py` |
| Artifacts | `config/models/{wrist_height,finger_curvature,thumb_position,wrist_lateral,hand_arch}.joblib` (gitignored today) |
| Production switch | `SCORER=yaml` (default) or `SCORER=ml_with_fallback` |
| Gate | Serve ML only when `python -m technique_titan.eval --scorer compare` shows ML hold-out **macro accuracy ≥ YAML** on the **real-image** ids in `data/eval/holdout_split.json`. Last measured: YAML **0.689**, ML **0.622**. Until that flips, production stays YAML. |

Logistic regression writes **severity labels**. LoRA writes **sentences**. The only connection is that severities are fields inside `CoachPlan`.

### 1.3 Templates (always on)

`config/coaching.yaml` remains the fallback and the seed for the training set.
`src/technique_titan/coaching.py` stays the function that turns scores into
`CoachingTip` objects when the renderer is `template`.

---

## 2. What each piece is for

```text
frame
  → MediaPipe (browser on /live, server on /photo and /video)
  → geometry metrics
  → scorer: YAML, or logistic regression only after the hold-out gate
  → scores, severities, direction (too_low / too_high / generic)
  → temporal smoother (EMA + dwell)
  → focus policy (14-day history from Supabase, or no focus if < 3 sessions)
  → CoachPlan JSON
  → renderer
       template: coaching.yaml          (default, local and prod)
       model:    browser LoRA model     (opt-in, WebGPU)
  → validator
  → UI string, or template if validation fails
```

| Piece | Purpose | Runs where |
|---|---|---|
| YAML scorer | Explainable 0–100 and good/warning/critical from `config/scoring.yaml` | API process |
| Logistic regression | Same outputs, learned from `data/labels.csv`, if it wins the hold-out gate | API process, joblib, milliseconds |
| Temporal smoother | Stop the tip from flickering every frame | Browser for live; Python for video reduction |
| Focus policy | One criterion for the week, from saved sessions | Python, `POST /v1/coach/plan` |
| `coach_focus` row | Remember the locked criterion across devices | Supabase free Postgres, one row per user |
| Template renderer | Correct, testable sentences | Python, inside `/v1/coach/plan` and existing coaching |
| LoRA model | Different wording for the same plan | Browser only, after opt-in |
| Validator | Reject sentences that contradict the plan | Python (authoritative) and a TypeScript copy used before paint |

---

## 3. Contracts

### 3.1 `CoachPlan` (version 1)

Built only in Python (`src/technique_titan/coach/plan.py`). The browser does
not invent criterion, severity, or direction.

```json
{
  "version": 1,
  "hand": "right",
  "focus_criterion": "wrist_height",
  "acute_criterion": null,
  "criterion": "wrist_height",
  "severity": "warning",
  "direction": "too_high",
  "score": 62,
  "metric_name": "wrist_height_delta",
  "metric_value": 1.12,
  "ideal": [-0.0711, 0.966],
  "trend_delta": -4.0,
  "sessions_in_window": 6,
  "tip_kind": "live",
  "renderer": "template"
}
```

Field rules:

| Field | Rule |
|---|---|
| `hand` | `left` or `right` |
| `focus_criterion` | One of the five criteria, or `null` when the user has fewer than 3 saved sessions in the window |
| `acute_criterion` | A **different** criterion that is `critical` after dwell, or `null` |
| `criterion` | The one the sentence is about: `acute_criterion` if set, else `focus_criterion`, else the worst current non-good criterion |
| `severity` | `warning` or `critical`. A `good` criterion produces no plan; the UI shows `encouragement` from `coaching.yaml` |
| `direction` | `too_low`, `too_high`, or `generic` via `metric_direction()` in `coaching.py` |
| `score` | Integer 0–100 after smoothing |
| `trend_delta` | Mean score of `criterion` over the last 3 sessions minus the mean over the 3 sessions before that. `null` if fewer than 6 sessions |
| `tip_kind` | `live` (≤220 characters), `photo` (≤320), `recap` (≤480, one per saved session) |
| `renderer` | `template` or `model`. The server always fills template strings. `model` is a client hint, never a server call |

Five criteria, fixed order, matching `scoring.yaml`:

1. `wrist_height` (weight 0.25, metric `wrist_height_delta`)
2. `finger_curvature` (0.25, `mean_finger_curvature`)
3. `thumb_position` (0.15, `thumb_index_angle`)
4. `wrist_lateral` (0.15, `wrist_lateral_deviation_deg`)
5. `hand_arch` (0.20, `hand_arch_ratio`)

Severity bands stay `good_min: 80`, `warning_min: 50`.

### 3.2 Plan identity

`plan_key` is the string:

```text
v1|{hand}|{criterion}|{severity}|{direction}|{tip_kind}|{focus_criterion}|{acute_criterion}
```

The live UI keeps the current sentence until `plan_key` changes. It does not
call the model when only `score` changes inside the same band.

### 3.3 Validator

Implemented twice from one fixture file `tests/fixtures/coach_validator_cases.json`
(pytest + Vitest) so the copies cannot drift.

Reject the string when any rule fails. On reject, show the template.

1. Non-empty, one or two sentences, no markdown, no emoji.
2. Length ≤ the `tip_kind` cap above.
3. Contains at least one allow-word for `criterion`:

| Criterion | Allow-words (case-insensitive) |
|---|---|
| `wrist_height` | wrist, knuckle |
| `finger_curvature` | finger, curve, round |
| `thumb_position` | thumb |
| `wrist_lateral` | wrist, side |
| `hand_arch` | arch, knuckle, palm |
4. Does not contain a deny-word: `diagnos`, `injur`, `doctor`, `medical`, `pain`, `surgery`, `arthritis`.
5. If the string contains a number, that number must be within 2 of `score` or within 0.05 of `metric_value` or equal to a bound in `ideal`. Otherwise reject. Templates today contain no numbers; the model may omit numbers.
6. `direction: too_high` must not contain the phrases `too low` or `lift the wrist` when criterion is `wrist_height` and direction is `too_high` is **not** a universal rule. Direction checks are phrase lists in `config/coach_direction_guards.yaml`, one list per `(criterion, direction)`, reviewed by hand. Empty list means “no extra phrase guard”.

### 3.4 Focus math

Window: saved `session_hands` rows whose session `started_at` is within the
last **14 days**, capped at the **40** newest sessions. Unsigned users have
no window; `focus_criterion` is `null`.

Per session, if both hands exist, keep the hand with the lower
`mean_composite` and use that hand’s `frac_warning`, `frac_critical`,
`primary_issue`, and `mean_scores`.

For each criterion `c`, with `n` sessions in the window:

```text
rate(c) = mean over sessions of (frac_warning[c] + 2 * frac_critical[c])
hit(c)  = (sessions where primary_issue == c) / n
burden(c) = 0.65 * rate(c) + 0.35 * hit(c)
```

Winner = argmax `burden`. Ties break by higher `scoring.yaml` weight, then
by criterion name ascending.

Hysteresis: if a focus is already locked and the new winner differs, switch
only when `burden(new) >= burden(locked) + 0.08`.

Lock length: **7 days** from `locked_on` (date in the user’s session, stored
as UTC date). Recompute burden on each `/progress` load and on each analyze
save, but do not change `criterion` until the lock expires, hysteresis
allows a switch, or early completion fires.

Early completion: the last **3** sessions all have `mean_scores[focus] >= 80`.
Then clear the lock and recompute immediately.

Fewer than **3** sessions in the window: do not write a lock.
`focus_criterion = null`. The plan uses the worst **current** non-good
criterion (critical before warning, then higher weight, then criterion order).

### 3.5 Acute override

After smoothing, if some criterion other than the focus is `critical` for
**≥ 1200 ms** of kept frames, set `acute_criterion` to it. If several are
critical, pick the one critical longest, then higher weight. Clear it after
that criterion has been non-critical for **≥ 1200 ms**. The weekly focus
does not change because of an acute spike.

### 3.6 Smoothing

Per hand, per criterion score:

```text
ema = 0.35 * raw_score + 0.65 * previous_ema
```

Missing frame: hold `previous_ema`. First frame: `ema = raw_score`.

Map `ema` through the same 80 / 50 bands to get smoothed severity.

Direction uses the raw metric against `ideal`, but the reported direction
changes only after the new side of the ideal range has held for **≥ 1200 ms**.
`generic` (metric missing) applies immediately.

Live call rate stays inside the existing landmark rate limit
(**360 / window**, default window 60 s). Do not raise it.

### 3.7 Supabase table

New migration `supabase/migrations/20261014000006_coach_focus.sql`.
One row per user. No media. Bytes are negligible next to the 500 MB
database quota and the existing 400-session cap.

```sql
create table public.coach_focus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criterion text not null check (criterion in (
    'wrist_height', 'finger_curvature', 'thumb_position',
    'wrist_lateral', 'hand_arch'
  )),
  locked_on date not null,
  locked_until date not null,
  burden jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.coach_focus enable row level security;

create policy coach_focus_own on public.coach_focus
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

The client writes this row only after `POST /v1/coach/plan` returns a
non-null `focus_criterion` and a `lock` object. The API does not hold the
Supabase service role. Same pattern as `web/src/lib/progress.ts`.

---

## 4. Runtime layout (local and production)

Both environments use the same code paths. Only origins change.

| | Local | Production (free) |
|---|---|---|
| UI | `cd web && npm run dev` (Vite `:5173`) | Vercel, root directory `web` |
| API | `uvicorn api.main:app --port 8000` | Render Docker, health `/v1/health` |
| API origin | Vite proxy, `VITE_API_BASE_URL` empty | `VITE_API_BASE_URL=https://technique-titan-api.onrender.com` |
| Auth and progress | `web/.env.local` Supabase URL + anon key, **same project ref as Vercel** | Same two vars on Vercel, then redeploy |
| Scorer | `SCORER=yaml` | `SCORER=yaml` until the ML gate |
| Wording | Templates | Templates, plus opt-in browser model |
| Coach weights | Not in the API image | Not in the API image. Browser fetches HF |

New env vars:

| Var | Where | Default | Meaning |
|---|---|---|---|
| `SCORER` | API | `yaml` | `yaml` or `ml_with_fallback` |
| `VITE_COACH_MODEL_REPO` | Vite bake | empty | HF repo id. Empty disables the model toggle |
| `VITE_COACH_MODEL_REVISION` | Vite bake | empty | HF commit SHA. Required when the repo id is set, so a bad upload cannot silently ship |

Docker image contents stay: `requirements-api.txt`, `config/scoring.yaml`,
`config/coaching.yaml`, `src/`, `api/`. Do not `COPY` `data/coach/` or
`config/models/` until Phase 8, and then only the five joblib files.

---

## 5. Rollout

Each phase ends with the product working on templates. Do not start a phase
until the previous phase’s exit checks pass. Phase 8 may start any time
after Phase 3; it does not block Phases 4–7.

### Phase 1 — Temporal smoother

**Purpose:** live and video stop changing the primary tip on single-frame noise.

**1.1** Add `src/technique_titan/coach/temporal.py` with `ScoreSmoother`
(EMA 0.35 / 0.65, dwell 1200 ms, bands 80 and 50). Pure functions. No I/O.

**1.2** Add `tests/engine/test_coach_temporal.py`. Cases: first frame copies
raw; a one-frame critical blip does not change severity; a 1200 ms critical
run does; direction flip inside 1200 ms is ignored.

**1.3** Use `ScoreSmoother` inside `src/technique_titan/progress/reducer.py`
before `primary_issue` is chosen, so saved sessions match what the user saw.

**1.4** Port the same transitions to `web/src/lib/scoreSmooth.ts`. Drive it
from `web/src/pages/LivePractice.tsx` on each landmark score **before** the
tip text updates. Share numeric cases via `tests/fixtures/temporal_cases.json`
and a Vitest file `web/src/lib/scoreSmooth.test.ts`.

**1.5** Do not add a model, a table, or a new endpoint in this phase.

**Exit:** pytest + Vitest green. On `/live`, a one-frame flicker does not
change the primary tip. Photo mode unchanged.

### Phase 2 — Weekly focus

**Purpose:** one criterion stays the practice target for seven days, using
rows already stored in `practice_sessions` / `session_hands`.

**2.1** Add `src/technique_titan/coach/focus.py` implementing §3.4 exactly.
Input is a list of hand summaries, not a Supabase client.

**2.2** Add `tests/engine/test_coach_focus.py`: empty history; 2 sessions
returns null; 3 sessions picks the burden winner; tie breaks on weight;
hysteresis of 0.08 blocks a tiny lead; early completion at three scores ≥ 80
clears the lock.

**2.3** Add migration `supabase/migrations/20261014000006_coach_focus.sql`
(§3.7). Apply it in the Supabase SQL editor on the **existing free project**.
Append the same SQL to `supabase/bootstrap.sql` so a fresh project gets it.
Document the one-time apply in `supabase/README.md`.

**2.4** Add `web/src/lib/coachFocus.ts`: load the user’s last 40 sessions
(existing progress query), `POST` them to the focus endpoint in Phase 3,
upsert `coach_focus`. Until Phase 3 exists, unit-test the burden function
only in Python. Do not duplicate the formula in TypeScript.

**Exit:** migration applied; focus tests green; no UI change yet.

### Phase 3 — `CoachPlan` endpoint and template renderer

**Purpose:** one server function decides the sentence inputs. UI keeps
working with templates if anything else fails.

**3.1** Add `src/technique_titan/coach/plan.py` building the JSON in §3.1
from smoothed scores + focus result + `scoring.yaml`.

**3.2** Add `src/technique_titan/coach/validate.py` implementing §3.3.
Wire `config/coach_direction_guards.yaml` (start with empty lists per key).

**3.3** Add `POST /v1/coach/plan` in `api/routes/coach.py`, registered from
`api/main.py`.

Request body:

```json
{
  "hand": "right",
  "scores": {"wrist_height": 62, "finger_curvature": 90, "thumb_position": 88, "wrist_lateral": 91, "hand_arch": 70},
  "severities": {"wrist_height": "warning", "finger_curvature": "good", "thumb_position": "good", "wrist_lateral": "good", "hand_arch": "warning"},
  "metrics": {"wrist_height_delta": 1.12, "mean_finger_curvature": 140, "thumb_index_angle": 30, "wrist_lateral_deviation_deg": 2, "hand_arch_ratio": 0.04},
  "history": [],
  "tip_kind": "live",
  "locked_focus": null
}
```

`history` entries are the compact hand summaries already stored (no
samples, no images). Max **40** entries. Reject larger bodies with 422.

Response:

```json
{
  "plan": { },
  "problem": "…from coaching.yaml…",
  "fix": "…from coaching.yaml…",
  "plan_key": "v1|right|wrist_height|warning|too_high|live|wrist_height|",
  "lock": {"criterion": "wrist_height", "locked_on": "2026-10-13", "locked_until": "2026-10-20", "burden": {}}
}
```

`problem` and `fix` always come from `generate_coaching` / `_lookup_tip`.
The handler also runs the validator on those strings; a template that fails
is a test failure, not a runtime surprise.

Rate limit: reuse the landmarks bucket (`RATE_LIMIT_LANDMARKS_MAX`, default
360). This endpoint is called when `plan_key` inputs change, not at camera FPS.

**3.4** Live (`LivePractice.tsx`): after the smoother settles, call
`/v1/coach/plan` only if the prospective `plan_key` changed. On network
error, keep `coaching.py` output already returned by `/v1/score/landmarks`.
Hold the last good sentence (same rule as scores in `docs/errors.md`).

**3.5** Photo (`PhotoAnalyze.tsx`) and video (`VideoAnalyze.tsx`): the
analyze handlers in `api/` call `build_plan` in-process and add
`coach_plan` next to the existing `progress_draft`. The button label stays
“Add to progress”.

**3.6** `/progress`: show the locked criterion name and `locked_until` from
`coach_focus`. If the row is missing, show “Practice a few times to get a
weekly focus.” Do not call the language model on this page.

**3.7** Tests: `tests/api/test_coach_plan.py` for the route; fixture plans
for all five criteria × both non-good severities × three directions.

**Exit:** local `:8000` and a Docker run of the same image both return
template strings. Prod deploy is the existing Render/Vercel path. No new
paid service. Unsigned users get acute/current tips and `lock: null`.

### Phase 4 — Template variants (variety before any model)

**Purpose:** cut repetition while the model does not exist yet, at zero
download cost.

**4.1** Extend `config/coaching.yaml` so each `(criterion, severity, direction)`
has `variants`: a list of **4** `{problem, fix}` objects. Keep the current
sentence as `variants[0]`.

**4.2** Pick the variant with

```text
index = stable_hash(user_id + plan_key + UTC date) mod 4
```

Unsigned users hash `plan_key + UTC date` only. Same user, same plan, same
day → same sentence. Next day → a different variant. Implement in
`coaching.py`. Do not randomize per frame.

**4.3** Update coaching tests so every variant passes `validate.py`.

**Exit:** live tip changes across days for the same posture, not across
frames. Still no model download.

### Phase 5 — Training set (local, human-reviewed)

**Purpose:** teach the 0.5B model to paraphrase a plan without changing the facts.

**5.1** Add `data/coach/README.md` describing the JSONL row. Gitignore
`data/coach/drafts/` and `data/coach/merged/`. **Track** `data/coach/accepted.jsonl`.

Each line:

```json
{"messages": [
  {"role": "system", "content": "You write one piano posture tip for a child. Use only the facts in the plan. Return JSON with keys problem and fix."},
  {"role": "user", "content": "{\"criterion\":\"wrist_height\",\"severity\":\"warning\",\"direction\":\"too_high\",\"score\":62,\"tip_kind\":\"live\"}"},
  {"role": "assistant", "content": "{\"problem\":\"…\",\"fix\":\"…\"}"}
]}
```

The user message is the plan with history fields removed. The assistant
message is the only target.

**5.2** Generate **drafts** on the Mac with the **base** MLX model (no LoRA yet):

```sh
python -m technique_titan.coach.draft_paraphrases \
  --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
  --templates config/coaching.yaml \
  --output data/coach/drafts/base.jsonl \
  --per-cell 8
```

`per-cell` covers every `(criterion, severity, direction, tip_kind)` cell.
This process is local. Discard drafts that fail `validate.py`.

**5.3** Human pass: move kept lines into `data/coach/accepted.jsonl`.
Minimum to start training: **200** accepted lines, at least **8** per
`(criterion, direction)` pair. Do not train on `drafts/`.

**5.4** Split accepted lines 90 / 10 into train and dev **by cell**, so every
criterion appears in dev. Write `data/coach/split.json`.

**Exit:** `accepted.jsonl` committed; every line passes the validator.

### Phase 6 — LoRA train and gate

**Purpose:** produce an adapter that is more varied than variant 0 and still
fact-correct. Training does not deploy anything.

**Prerequisite:** Apple Silicon Mac, **≥ 8 GB** unified memory (16 GB is
comfortable). Intel Macs are out of scope; do not rent a GPU.

**6.1** Add `requirements-coach.txt` (not installed in the API image):

```text
mlx-lm==<pin on the day this phase starts>
```

Install only into a separate venv `.venv-coach`. Do not add `mlx` to
`requirements-api.txt` or the Dockerfile.

**6.2** Train:

```sh
mlx_lm.lora \
  --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
  --train \
  --data data/coach \
  --batch-size 4 \
  --lora-layers 16 \
  --iters 600 \
  --learning-rate 1e-4 \
  --max-seq-length 512 \
  --seed 0 \
  --adapter-path data/coach/adapters
```

`--lora-layers 16` matches Qwen2.5-0.5B’s layer count so every attention
block gets `q_proj`, `k_proj`, `v_proj`, `o_proj` adapters. If `mlx_lm.lora`
at the pinned version uses different flags for rank, set rank **8** and
alpha **16** in the config file it writes, and record the exact command in
`data/coach/TRAIN.md`.

**6.3** Eval script `python -m technique_titan.coach.eval_adapter`:

- Run the adapter on every dev plan.
- Report **validator pass rate**.
- Report **exact-match rate** against the template (lower is fine; this
  measures variety).
- Gate to export: validator pass rate **≥ 0.95** on dev **and** ≥ 0.95 on a
  frozen list of 25 hand-written plans in `data/coach/probe.jsonl` that were
  **not** in training.

If the gate fails: add accepted lines, train again. Do not upload weights.

**6.4** Fuse for export (local only):

```sh
mlx_lm.fuse \
  --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
  --adapter-path data/coach/adapters \
  --save-path data/coach/merged
```

**Exit:** gate numbers written in `data/coach/TRAIN.md`. Adapters gitignored.

### Phase 7 — Browser renderer

**Purpose:** opted-in users get model sentences. Everyone else stays on
Phase 4 templates. Production API RAM does not change.

**7.1** Convert `data/coach/merged` to ONNX q4f16 with Hugging Face Optimum
on the same Mac. Follow the file layout of
`onnx-community/Qwen2.5-0.5B-Instruct` (onnx weights under `onnx/`).
Do this once per promoted adapter.

**7.2** Create a **public** Hugging Face model repo named
`technique-titan-coach-onnx` under a free account. Upload the ONNX folder.
Copy the commit SHA.

**7.3** Set `VITE_COACH_MODEL_REPO` and `VITE_COACH_MODEL_REVISION` on
Vercel and in `web/.env.local`. Redeploy Vercel (Vite bakes env at build).
Leave them empty until the upload exists. Empty means the toggle is hidden.

**7.4** Add `web/src/workers/coachModel.worker.ts`:

- Dynamic-import `@huggingface/transformers`.
- `pipeline("text-generation", repo, { dtype: "q4f16", device: "webgpu", revision })`.
- System prompt identical to the training `system` message.
- User message is `JSON.stringify` of the plan fields listed in §5.1.
- Parse the assistant text as JSON `{problem, fix}`.
- Post the strings back. On any throw, post `{ ok: false }`.

**7.5** Settings toggle **“Varied tip wording”** in the existing account
settings UI, default **off**, stored in `localStorage` key
`tt-coach-model` = `0|1`. Turning it on:

1. Checks `navigator.gpu`.
2. If missing, show “This browser can’t run on-device wording” and stay on templates.
3. If present, start the worker. First load downloads ~460 MB from Hugging Face into Cache Storage. Show a progress label. The camera and template tips stay on screen during download.
4. When a new `plan_key` arrives and the worker is ready, generate once.
5. Run the TypeScript validator. On failure, 2500 ms timeout, or `{ ok: false }`, show the template strings from `/v1/coach/plan`.

**7.6** Never send the plan to any host other than the existing API (for the
template) and the user’s GPU. Hugging Face is contacted only to **download
weights**, not to run inference.

**7.7** Manual check on a phone-sized viewport and on desktop: toggle off
(no download), toggle on (download once, second visit uses cache), airplane
mode after cache (generation still runs), validator failure path (force a
bad revision in dev and confirm the template appears).

**Exit:** Render metrics unchanged (no new Python deps in the image). A user
who never toggles the setting downloads zero model bytes. A user who toggles
it gets a validated sentence or the template.

### Phase 8 — Logistic regression on the API (independent)

**Purpose:** better severities inside `CoachPlan`. Does not change wording
code.

**8.1** Re-run the compare command in `ML_UPGRADE.md`. If ML macro < YAML
macro on real hold-out rows, stop. Do not ship joblib files.

**8.2** If the gate passes, copy the five `config/models/*.joblib` files
into the Docker build context via a deliberate `COPY config/models/ config/models/`
**only after** they are small (they are) and a decision is made to track
them or fetch them at image build from a **free** location. Preferred: commit
the joblib files if they are under a few MB each. They are classical models,
not the LLM.

**8.3** In `api/`, when `SCORER=ml_with_fallback`, call
`technique_titan.ml.predict` and if it throws or returns `unknown`, use YAML
for that criterion. Default env on Render remains `SCORER=yaml` until you
set the variable in the Render dashboard (free).

**8.4** Tests: `tests/api/test_scorer_flag.py` with a fake model directory.
CI does not need the real joblib files.

**Exit:** production env still defaults to YAML. Flipping the env var does
not require a Vercel change. LoRA weights stay out of this image.

---

## 6. Efficiency budget

| Path | Time | Memory |
|---|---|---|
| Landmark score, YAML | Existing budget, a few tens of ms server-side | Unchanged API container |
| `POST /v1/coach/plan` | Same order as coaching.py (sub-millisecond to a few ms) | No model loaded |
| Live UI | Smoother is a handful of floats. Plan request only when `plan_key` changes | No model until toggle |
| Model toggle | First visit ~460 MB download. Later visits read Cache Storage. Generation aborted at 2500 ms | WebGPU buffer on the **user’s** GPU. API process unchanged |
| Training | 600 steps of a 0.5B 4-bit LoRA on Apple Silicon. One-off, local | Fits in 8 GB unified memory; close other heavy apps |
| Supabase | One `coach_focus` row per user plus existing session caps (400 sessions, 32 KB samples, 20 timelines) | Stays inside the free 500 MB database |

Cold starts on Render free tier stay a property of the API (about 30–60 s
after 15 idle minutes). The coach endpoint does not add a second service, so
it does not add a second cold start. Template tips already returned inside
`/v1/score/landmarks` cover the gap.

---

## 7. Test and bug bar

A phase is done only when all of these that apply to it are true:

- `pytest` green, including new coach tests.
- `cd web && npm run build` green. Vitest green for `scoreSmooth` and the validator.
- Docker image still starts and `/v1/health` returns without downloading MLX or ONNX.
- Photo, video, live, and `/progress` manually checked on local `:5173` + `:8000`.
- For UI phases, desktop and a narrow viewport.
- Unsigned, signed-in with 0 sessions, and signed-in with ≥ 3 sessions.
- Model phase: toggle off, toggle on, timeout, validator reject, offline-after-cache.
- No `service_role` key in `web/` or Vercel.
- No new paid dashboard, bucket, or instance type.

---

## 8. Explicit non-goals

- Teacher accounts, PDF export, and multi-user review (roadmap Phase 4 product items).
- Replacing MediaPipe.
- Training on photos or on `data/raw/`.
- A language model that chooses the criterion or the severity.
- On-device training in the browser.
- A second hosted database. Supabase free remains the only database.
- Localizing copy (PRD FR-FB-5) until English validator pass rate holds.

---

## 9. File map (created across phases)

| Path | Phase |
|---|---|
| `src/technique_titan/coach/temporal.py` | 1 |
| `src/technique_titan/coach/focus.py` | 2 |
| `src/technique_titan/coach/plan.py` | 3 |
| `src/technique_titan/coach/validate.py` | 3 |
| `src/technique_titan/coach/draft_paraphrases.py` | 5 |
| `src/technique_titan/coach/eval_adapter.py` | 6 |
| `config/coach_direction_guards.yaml` | 3 |
| `api/routes/coach.py` | 3 |
| `supabase/migrations/20261014000006_coach_focus.sql` | 2 |
| `web/src/lib/scoreSmooth.ts` | 1 |
| `web/src/lib/coachFocus.ts` | 2–3 |
| `web/src/workers/coachModel.worker.ts` | 7 |
| `data/coach/accepted.jsonl` | 5 |
| `data/coach/probe.jsonl` | 6 |
| `requirements-coach.txt` | 6 |
| `tests/fixtures/temporal_cases.json` | 1 |
| `tests/fixtures/coach_validator_cases.json` | 3 |

Existing files touched: `coaching.py`, `coaching.yaml`, `progress/reducer.py`,
`api/main.py`, `LivePractice.tsx`, `PhotoAnalyze.tsx`, `VideoAnalyze.tsx`,
`ProgressPage.tsx`, `Dockerfile` (Phase 8 only), `supabase/bootstrap.sql`,
`supabase/README.md`, `web/.env.example`.
