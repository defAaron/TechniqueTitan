# Technique Titan — Web UI

React 19 + TypeScript + Vite 8 + Tailwind 4 product frontend for Technique Titan.

Primary user-facing surface. Talks to the FastAPI backend under `/v1/*`.
Scoring on the API is **YAML heuristics only** (offline ML is not wired).
Optional Supabase auth is live. Signed-in users can **Add to progress** after
photo, video, or live analyze and view **`/progress`** (dashboard + session list).
Scores only — no media in Supabase. Apply
[`supabase/migrations/20260923000004_practice_sessions.sql`](../supabase/migrations/20260923000004_practice_sessions.sql)
on your project. Remaining Phase 3b: a11y pass, richer capture guidance.

## Develop

```bash
# From repo root — API must be on :8000 for the Vite proxy
uvicorn api.main:app --reload --port 8000

cd web
npm install
npm run dev
```

Open http://localhost:5173. Requests to `/v1/*` proxy to the API (see `vite.config.ts`).

For production builds, set `VITE_API_BASE_URL` to your API origin (see `.env.example`).
Optional auth: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from a dedicated
Technique Titan project ([`supabase/README.md`](../supabase/README.md)). Never
commit the `service_role` key. CI builds succeed without these vars (auth pages
show “not configured”).

## Routes

| Path | Page | Behavior |
|---|---|---|
| `/` | Home | Marketing: hero, problem/solution, pipeline, mode cards |
| `/photo` | Photo analyze | Upload JPEG/PNG → `POST /v1/analyze/image` |
| `/video` | Video analyze | Upload MP4/MOV → `POST /v1/analyze/video` + Recharts timeline |
| `/live` | Live practice | Browser MediaPipe → `POST /v1/score/landmarks`, or JPEG → `/v1/analyze/frame` |
| `/about` | About | Scoring overview |
| `/login` | Sign in | Email/password or Google (optional; analyze stays public) |
| `/signup` | Sign up | Email/password or Google |
| `/auth/callback` | OAuth return | PKCE redirect target |
| `/admin` | Signup stats | Owner-only account counts (`app_admins`) |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local Vite server |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

## Stack

| Package | Role |
|---|---|
| React 19 / React Router 7 | UI + routing |
| TanStack Query 5 | Query client provider (ready for caching) |
| `@mediapipe/tasks-vision` | In-browser hand landmarks (live) |
| Recharts | Video posture timeline |
| OGL | Specular WebGL button effect |
| `@supabase/supabase-js` | Optional email / Google auth |
| Tailwind CSS 4 | Styling via `@tailwindcss/vite` |

## Layout

```
web/
├── public/
│   ├── landing/      # Optimized stills + photo/video mode clips
│   └── …             # Favicons, webmanifest (paths must stay at public root)
├── src/
│   ├── components/
│   │   ├── layout/     # App chrome
│   │   ├── marketing/  # Landing hero
│   │   ├── analyze/    # Score / overlay / coaching panels
│   │   ├── auth/       # ProtectedRoute
│   │   └── ui/         # Shared primitives
│   ├── pages/        # Route screens
│   └── lib/          # API client, auth, MediaPipe helper
├── index.html
├── vite.config.ts
├── .env.example      # VITE_API_BASE_URL, VITE_SUPABASE_*
└── vercel.json       # SPA rewrite for Vercel
```

## Deploy

Root Directory = `web` on Vercel. Set `VITE_API_BASE_URL` to the Render API origin
(`https://technique-titan-api.onrender.com`) and allow the Vercel origin in API
`CORS_ORIGINS`. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and **redeploy**.
Full steps: [docs/DEPLOY.md](../docs/DEPLOY.md).
