# API

FastAPI process that detects, scores, plans a tip, and reduces a practice session. Deployed as the repo `Dockerfile` on Render. Locally: `uvicorn api.main:app --reload --port 8000`.

OpenAPI is at `/docs` unless `ENVIRONMENT=production`, which turns docs off. MediaPipe is not loaded during startup. `/v1/health` only checks that the process is up, so a Render health check does not pay model-init time. YAML is loaded in the lifespan hook.

The routes do not require a Supabase JWT. The React app is what asks the player to sign in. Abuse control is the rate limiter and the upload cap.

## Routes

| Method | Path | Bucket | Body |
|---|---|---|---|
| `GET` | `/v1/health` | — | `{status, service}` |
| `GET` | `/v1/config/public` | — | Criterion labels and the mode list `photo`, `video`, `live` |
| `POST` | `/v1/analyze/image` | heavy | JPEG/PNG, max **8 MB** |
| `POST` | `/v1/analyze/frame` | frame | One live JPEG, max **8 MB** (fallback when the browser cannot run MediaPipe) |
| `POST` | `/v1/analyze/video` | heavy | MP4/MOV/AVI, max **40 MB** |
| `POST` | `/v1/score/landmarks` | landmarks | JSON, 21 points per hand, already extracted in the browser |
| `POST` | `/v1/coach/plan` | landmarks | Smoothed hand + session history → one template plan. Same cheap bucket as landmark scoring so live practice can ask for a plan at camera rate. |
| `POST` | `/v1/progress/reduce` | heavy | Scored ticks → session draft |

Default sliding windows (60 s), overridable with env: heavy `RATE_LIMIT_MAX=60`, frame `RATE_LIMIT_FRAME_MAX=120`, landmarks `RATE_LIMIT_LANDMARKS_MAX=360`. Landmark traffic is the highest because live mode posts about 4 Hz. The limiter keeps at most 4096 IP keys. Anything that is not coach-plan, landmarks, or frame falls in the heavy bucket.

Behind Render, set `TRUST_PROXY=1`. The client IP is `CF-Connecting-IP` if present, otherwise the **first** `X-Forwarded-For` hop. The last hop is a proxy. Both headers are ignored when `TRUST_PROXY` is unset.

`UploadBodyLimitMiddleware` rejects an oversized `Content-Length` before Starlette buffers the body, and stops a chunked body once it passes the file cap plus 64 KB of multipart framing. The handler checks the file bytes again.

CORS origins come from `CORS_ORIGINS` (comma-separated). A `*` origin forces `allow_credentials=False`. Production sets the Vercel origin explicitly.

## What an analyze response carries

`api/service.py` runs `analyze_hands` (or builds `HandDetection`s from posted landmarks), then `apply_scorer` (`api/scorer.py`), then template coaching, then a `coach_plan` and, for video, a `progress_draft`.

Video opens a temp file, reads with OpenCV, and analyzes every **5th** frame up to **120** frames (`stride=5`, `max_frames=120`). The suffix is allowlisted (`.mp4`, `.mov`, `.avi`); anything else becomes `.mp4` so a caller cannot escape the temp directory. Per-hand composite scores are also returned as `timeline` for the Recharts chart. The browser replays the landmark skeleton itself; the API does not return an annotated video.

`SCORER` defaults to `yaml`. `ml_with_fallback` is documented in [`src/technique_titan/ml/README.md`](../src/technique_titan/ml/README.md).

## Layout

| File | Role |
|---|---|
| `main.py` | App, CORS, rate-limit middleware, health, public config |
| `routes/analyze.py` | Upload limits and the four analyze/score routes |
| `routes/coach.py` | History window (14 days, 40 sessions), focus, plan, template validation |
| `routes/progress.py` | Tick list → `build_session_draft` |
| `service.py` | Image, video, and landmark orchestration |
| `analyze_coach_plan.py` | Attaches a plan onto analyze responses; failures become “no plan,” not a 500 |
| `scorer.py` | Optional severity swap |
| `schemas.py` | Pydantic models, including `CoachPlanRequest` |
| `deps.py` | Cached YAML, lazy `HandDetector`, public error strings |
| `rate_limit.py` | Sliding window and proxy IP |
| `coach_shape.py` | Request JSON → `SmoothedHand` |
| `progress_helpers.py` | Draft → response, confidence floor |

`src/` is inserted on `sys.path` so `uvicorn api.main:app` works even without `pip install -e .`. Docker still installs the package.

## Tests

`tests/api/` via pytest and httpx (`test_api.py`, `test_rate_limit.py`, `test_scorer_flag.py`, `test_coach_plan.py`, `test_analyze_coach_plan.py`).
