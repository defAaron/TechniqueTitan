# Website deployment

How to get Technique Titan in front of users: the React + FastAPI product stack
(primary), plus the interim Streamlit Cloud demo.

## Architecture

| Surface | Stack | Host | Role |
|---|---|---|---|
| Product UI | React 19 + TypeScript + Vite + Tailwind 4 | [Vercel](https://technique-titan.vercel.app) | Primary |
| Product API | FastAPI + MediaPipe + OpenCV | [Render](https://technique-titan-api.onrender.com) (Docker) | Primary |
| Interim demo | Streamlit (`app.py`) | Streamlit Community Cloud | Optional / research |

The React UI already has **photo + video + live** parity with Streamlit. Live
camera on the product UI runs in the **browser** (MediaPipe Hands → landmark
scoring, or JPEG frame upload). It does **not** use server-side OpenCV
`VideoCapture`.

**Production URLs**

| Service | URL |
|---|---|
| UI | `https://technique-titan.vercel.app` |
| API | `https://technique-titan-api.onrender.com` |
| API health | `https://technique-titan-api.onrender.com/v1/health` |
| API docs | `https://technique-titan-api.onrender.com/docs` |

---

## Product API on Render

### Local

```bash
pip install -e ".[api]"
# or: pip install -r requirements-api.txt && pip install -e . --no-deps
uvicorn api.main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs

### Docker

```bash
docker build -t technique-titan-api .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=* technique-titan-api
```

### Render (production)

The live API is deployed from this repo’s root [`Dockerfile`](../Dockerfile).
Optional infrastructure-as-code: [`render.yaml`](../render.yaml).

1. [render.com](https://render.com) → **New** → **Web Service** (or **Blueprint** from `render.yaml`).
2. Connect **`defAaron/TechniqueTitan`**, branch **`main`**, **Root Directory** blank (repo root).
3. **Runtime:** Docker · **Health Check Path:** `/v1/health` · **Instance type:** Free (or Starter for always-on).
4. Environment variables:

| Variable | Production value |
|---|---|
| `CORS_ORIGINS` | `https://technique-titan.vercel.app` (or `*` for a public demo) |
| `TRUST_PROXY` | `1` |

Optional rate-limit overrides (defaults are fine):

| Variable | Default |
|---|---|
| `RATE_LIMIT_WINDOW` | `60` |
| `RATE_LIMIT_MAX` | `60` |
| `RATE_LIMIT_FRAME_MAX` | `120` |
| `RATE_LIMIT_LANDMARKS_MAX` | `360` |

Do **not** set `PORT` — Render injects it.

**Free tier notes:** services spin down after **15 minutes** without traffic; the
next request can take **30–60 seconds** (cold start). First Docker build is slow
(MediaPipe + OpenCV). Upgrade to **Starter** ($7/mo) for always-on and faster wake-ups.

### API endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/analyze/image` | JPEG/PNG, max 8 MB |
| `POST` | `/v1/analyze/frame` | Live JPEG frames, max 8 MB |
| `POST` | `/v1/analyze/video` | MP4/MOV/AVI, max 40 MB; `stride` 1–30; `max_frames` 1–300 |
| `POST` | `/v1/score/landmarks` | Browser MediaPipe landmarks (≤2 hands) |
| `GET` | `/v1/health` | Healthcheck |
| `GET` | `/v1/config/public` | Criterion labels + supported modes |

Opening the API root `/` returns `{"detail":"Not Found"}` — expected. The product
UI lives on Vercel.

---

## Product UI on Vercel

### Local

```bash
# Terminal 1 — API on :8000
uvicorn api.main:app --reload --port 8000

# Terminal 2
cd web
npm install
npm run dev          # proxies /v1 → localhost:8000
```

Open http://localhost:5173

Routes: `/` (home), `/photo`, `/video`, `/live`, `/about`.

### Production

1. Deploy the `web/` directory to Vercel (Root Directory = `web`).
2. Set `VITE_API_BASE_URL` to the Render API origin (no trailing slash):

   `https://technique-titan-api.onrender.com`

   See [`web/.env.example`](../web/.env.example).
3. Ensure Render `CORS_ORIGINS` includes the Vercel URL.
4. **Redeploy** after changing env vars (Vite bakes them at build time).
5. [`web/vercel.json`](../web/vercel.json) rewrites SPA routes to `index.html`.

### “Load failed” / API unreachable

Safari shows **Load failed** (Chrome: **Failed to fetch**) when the UI cannot talk to
the API. Confirm:

1. Render `GET /v1/health` returns `{"status":"ok",...}`.
2. On the **free** tier, the service may be **cold** — wait up to ~60s on the first
   request after idle, then retry.
3. `VITE_API_BASE_URL` points at Render (not Vercel `/v1/...`) and the UI was
   **redeployed** after setting it.
4. `CORS_ORIGINS` includes `https://technique-titan.vercel.app` (no trailing slash).

### Live routes (client behavior)

| Mode | Client | API |
|---|---|---|
| **Landmarks (fast)** | `@mediapipe/tasks-vision` in-browser | `POST /v1/score/landmarks` |
| **Frame upload** | Canvas JPEG | `POST /v1/analyze/frame` |

---

## Streamlit Community Cloud (interim)

Optional public demo for photo + video. Prefer the React app for new users.

1. Push `main` with `requirements.txt`, `packages.txt`, and `.python-version` = `3.11`.
2. Open [share.streamlit.io](https://share.streamlit.io) → **New app**.
3. Repo: `defAaron/TechniqueTitan`, branch: `main`, main file: `app.py`.
4. Advanced settings → Python version **3.11**.
5. Deploy. Share the `*.streamlit.app` URL publicly.

Live mode shows a local-only warning on Cloud (no server webcam). Prefer Photo /
Video there, or use the React Live page for hosted real-time feedback.

---

## Hygiene checklist

- [x] API on Render (`technique-titan-api.onrender.com`)
- [x] UI on Vercel (`technique-titan.vercel.app`) with `VITE_API_BASE_URL` set
- [ ] Custom domain on Vercel (+ optional API subdomain)
- [ ] Confirm rate limits under real traffic
- [ ] CI green on `main` (`.github/workflows/ci.yml` — pytest + web build)
- [ ] Point public links at the Vercel UI; unpublish Streamlit Cloud when unused
- [ ] Optional: Sentry on API + web

---

## Local full stack

```bash
# terminal 1
uvicorn api.main:app --reload --port 8000

# terminal 2
cd web && npm run dev
```

Open http://localhost:5173
