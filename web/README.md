# Web

React 19 + TypeScript + Vite 8 + Tailwind 4 product UI. Vercel root directory is `web/`. The FastAPI process is a separate host. This folder never runs MediaPipe’s Python API and never holds the Supabase `service_role` key.

## Develop

```sh
# repo root, API on :8000
uvicorn api.main:app --reload --port 8000

cd web
npm install
npm run dev
```

http://localhost:5173. `vite.config.ts` proxies `/v1` to `http://127.0.0.1:8000`. Leave `VITE_API_BASE_URL` empty in dev. Production builds bake that variable; changing it on Vercel requires a redeploy.

Copy [`.env.example`](.env.example) to `.env.local` for auth. CI builds with the vars unset: auth pages render a not-configured state, and `ProtectedRoute` sends analyze routes to `/login`.

| Script | What it does |
|---|---|
| `npm run dev` | Vite. Does **not** run `tsc`. |
| `npm run build` | `tsc -b` then Vite. This is the check that catches unused locals. |
| `npm run test` | Vitest (smoother, coach plan, validator, model protocol) |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve `dist/` |

Run npm from `web/` only. The repo root has no `package.json` on purpose.

## Auth boundary

`ProtectedRoute` wraps `/photo`, `/video`, `/live`, `/profile`, `/settings`. No session, or no Supabase env, redirects to `/login?next=…`. `/admin` also requires `is_admin()`.

`/`, `/about`, `/login`, `/signup`, `/auth/callback` are public. `/progress` is not route-gated; with no user it renders an empty dashboard.

The API itself stays unauthenticated. Saving a session uses the user’s Supabase JWT and row-level security, from `src/lib/progress.ts`.

## Stack

| Package | Role |
|---|---|
| React 19, React Router 7 | UI and routes |
| `@mediapipe/tasks-vision` | Live landmarks, two hands, VIDEO mode |
| `@huggingface/transformers` | Optional WebGPU wording, loaded only after opt-in |
| `@supabase/supabase-js` | Email, Google, profiles, progress, coach focus |
| Recharts | Video timeline and progress charts |
| Framer Motion | Landing and dashboard motion (honors reduced-motion on the dashboard) |
| Tailwind 4 via `@tailwindcss/vite` | Styling. Theme tokens are CSS variables; renaming one means updating `getComputedStyle` readers too. |

## Layout

```
web/
├── public/                 favicons, manifest, landing stills and clips
├── src/pages/              one screen per route
├── src/components/         chrome, analyze, marketing, progress, auth
├── src/lib/                API, MediaPipe, smoothing, auth, progress
├── src/workers/            coach wording worker
├── index.html
├── vite.config.ts
├── vercel.json             SPA fallback
└── .env.example
```

Deeper READMEs: [pages](src/pages/README.md), [components](src/components/README.md), [lib](src/lib/README.md), [workers](src/workers/README.md).

## Deploy

Root Directory `web`. `VITE_API_BASE_URL=https://technique-titan-api.onrender.com` with no trailing slash. The API’s `CORS_ORIGINS` must include `https://technique-titan.vercel.app`. Supabase Site URL is that same origin, and redirect URLs include `http://localhost:5173/auth/callback` plus the production callback. Full sequence: [`docs/DEPLOY.md`](../docs/DEPLOY.md).
