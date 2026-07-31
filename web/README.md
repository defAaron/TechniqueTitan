# Technique Titan — Web UI

React + TypeScript + Vite + Tailwind frontend for Technique Titan.

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

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local Vite server |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

## Layout

```
web/
├── public/           # Static assets (icons, hero image, webmanifest)
├── src/
│   ├── components/   # Shared UI
│   ├── pages/        # Route screens
│   └── lib/          # API client + MediaPipe helper
├── index.html
├── vite.config.ts
└── vercel.json       # SPA rewrite for Vercel
```
