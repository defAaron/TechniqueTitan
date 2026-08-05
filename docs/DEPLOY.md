# Website deployment

How to get Technique Titan in front of users: the React + FastAPI product stack
(primary), plus the interim Streamlit Cloud demo.

## Architecture

| Surface | Stack | Host | Role |
|---|---|---|---|
| Product UI | React 19 + TypeScript + Vite + Tailwind 4 | Vercel | Primary |
| Product API | FastAPI + MediaPipe + OpenCV | Railway (Docker) | Primary |
| Interim demo | Streamlit (`app.py`) | Streamlit Community Cloud | Optional / research |

The React UI already has **photo + video + live** parity with Streamlit. Live
camera on the product UI runs in the **browser** (MediaPipe Hands → landmark
scoring, or JPEG frame upload). It does **not** use server-side OpenCV
`VideoCapture`.

---

## Product API on Railway

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

### Railway

1. Create a Railway project from this GitHub repo.
2. Railway uses [`Dockerfile`](../Dockerfile) + [`railway.toml`](../railway.toml).
3. Set env vars:
   - `CORS_ORIGINS` — your Vercel origin(s), comma-separated (prefer explicit origins; `*` disables credentials)
   - `TRUST_PROXY` — set `1` on Railway/behind a reverse proxy so rate limits use `X-Forwarded-For`
   - `RATE_LIMIT_WINDOW` — default `60` seconds
   - `RATE_LIMIT_MAX` — heavy uploads (`/analyze/image`, `/analyze/video`); default `60` per window
   - `RATE_LIMIT_FRAME_MAX` — live JPEG frames (`/analyze/frame`); default `120` per window
   - `RATE_LIMIT_LANDMARKS_MAX` — browser landmark scoring (`/score/landmarks`); default `360` per window (~6 Hz)
4. Healthcheck: `GET /v1/health`

### API endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/analyze/image` | JPEG/PNG, max 8 MB |
| `POST` | `/v1/analyze/frame` | Live JPEG frames, max 8 MB |
| `POST` | `/v1/analyze/video` | MP4/MOV/AVI, max 40 MB; `stride` 1–30; `max_frames` 1–300 |
| `POST` | `/v1/score/landmarks` | Browser MediaPipe landmarks (≤2 hands) |
| `GET` | `/v1/health` | Healthcheck |
| `GET` | `/v1/config/public` | Criterion labels + supported modes |

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
2. Set `VITE_API_BASE_URL` to your Railway API origin (no trailing slash), e.g.
   `https://technique-titan-api.up.railway.app`. See [`web/.env.example`](../web/.env.example).
3. Ensure Railway `CORS_ORIGINS` includes the Vercel URL.
4. [`web/vercel.json`](../web/vercel.json) rewrites SPA routes to `index.html`.

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
