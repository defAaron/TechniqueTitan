# Website deployment

How to get Technique Titan in front of users: interim Streamlit demo, then the
React + FastAPI product stack.

## Architecture

| Surface | Stack | Host |
|---|---|---|
| Interim demo | Streamlit (`app.py`) | Streamlit Community Cloud |
| Product API | FastAPI + MediaPipe | Railway (Docker) |
| Product UI | React + TypeScript + Tailwind | Vercel |

Live camera on the product UI runs in the **browser** (MediaPipe or JPEG frame
upload). It does **not** use server-side OpenCV `VideoCapture`.

---

## Phase 0 — Streamlit Community Cloud (public photo + video)

1. Push `main` with `requirements.txt`, `packages.txt`, and `.python-version` = `3.11`.
2. Open [share.streamlit.io](https://share.streamlit.io) → **New app**.
3. Repo: `defAaron/TechniqueTitan`, branch: `main`, main file: `app.py`.
4. Advanced settings → Python version **3.11**.
5. Deploy. Share the `*.streamlit.app` URL publicly.

Live mode shows a local-only warning on Cloud. Prefer Photo / Video there.

Retire this app once the React UI has photo + video + live parity.

---

## Phase 1 — API on Railway

```bash
# Local
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

API endpoints:

- `POST /v1/analyze/image`
- `POST /v1/analyze/frame`
- `POST /v1/analyze/video`
- `POST /v1/score/landmarks`
- `GET /v1/health`
- `GET /v1/config/public`

---

## Phase 2–3 — React UI on Vercel

```bash
cd web
npm install
npm run dev          # proxies /v1 → localhost:8000
```

Production:

1. Deploy the `web/` directory to Vercel (Root Directory = `web`).
2. Set `VITE_API_BASE_URL` to your Railway API origin (no trailing slash), e.g.
   `https://technique-titan-api.up.railway.app`.
3. Ensure Railway `CORS_ORIGINS` includes the Vercel URL.
4. [`web/vercel.json`](../web/vercel.json) rewrites SPA routes to `index.html`.

Live routes:

- **Landmarks (fast)** — MediaPipe Hands in-browser → `POST /v1/score/landmarks`
- **Frame upload** — canvas JPEG → `POST /v1/analyze/frame`

---

## Phase 4 — Hygiene checklist

- [ ] Custom domain on Vercel (+ optional API subdomain)
- [ ] Confirm rate limits under real traffic
- [ ] CI green on `main` (`.github/workflows/ci.yml`)
- [ ] Unpublish Streamlit Cloud when React is primary
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
