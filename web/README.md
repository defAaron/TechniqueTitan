# Technique Titan — Web UI

React 19 + TypeScript + Vite 8 + Tailwind 4 product frontend for Technique Titan.

Primary user-facing surface. Talks to the FastAPI backend under `/v1/*`.

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

## Routes

| Path | Page | Behavior |
|---|---|---|
| `/` | Home | Marketing: hero, problem/solution, pipeline, mode cards |
| `/photo` | Photo analyze | Upload JPEG/PNG → `POST /v1/analyze/image` |
| `/video` | Video analyze | Upload MP4/MOV → `POST /v1/analyze/video` + Recharts timeline |
| `/live` | Live practice | Browser MediaPipe → `POST /v1/score/landmarks`, or JPEG → `/v1/analyze/frame` |
| `/about` | About | Scoring overview |

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
| Tailwind CSS 4 | Styling via `@tailwindcss/vite` |

## Layout

```
web/
├── public/           # Static assets (icons, hero image, webmanifest)
├── src/
│   ├── components/
│   │   ├── layout/     # App chrome
│   │   ├── marketing/  # Landing-page sections
│   │   ├── analyze/    # Score / overlay / coaching panels
│   │   └── ui/         # Shared primitives
│   ├── pages/        # Route screens
│   └── lib/          # API client + MediaPipe helper
├── index.html
├── vite.config.ts
├── .env.example      # VITE_API_BASE_URL
└── vercel.json       # SPA rewrite for Vercel
```

## Deploy

Root Directory = `web` on Vercel. Set `VITE_API_BASE_URL` to the Render API origin
(`https://technique-titan-api.onrender.com`) and allow the Vercel origin in API
`CORS_ORIGINS`. Full steps: [docs/DEPLOY.md](../docs/DEPLOY.md).
