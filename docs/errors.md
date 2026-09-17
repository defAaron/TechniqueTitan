# Technique Titan — Error History

**Purpose:** Chronological record of significant errors encountered while building
this project, what stage they happened in, root cause, and how they were fixed.

**Mandatory for agents:** Before starting any new task, read this document (and the
quick checklist below). Do not reintroduce a fixed failure mode. When you fix a
new significant error, append an entry here in the same format.

**Sources:** Git history (notably `713814a`, `2b63b1c`) and agent session logs
(Jun 2026 – Aug 2026). Companion deploy notes: [`DEPLOY.md`](./DEPLOY.md).

---

## Quick checklist (do not repeat)

| Area | Rule |
|---|---|
| Python | Use **Python 3.11**. MediaPipe `0.10.21` has no wheel for 3.13+. |
| MediaPipe (server) | Pin **`mediapipe==0.10.21`**. Do not unpinned-install newer MediaPipe if code uses `mp.solutions`. |
| NumPy / OpenCV | Keep **NumPy `<2`** with MediaPipe 0.10.21; OpenCV **~4.10**. Never mix `opencv-python` and `opencv-python-headless` in one resolve. |
| Streamlit Cloud | No editable `.` in Cloud `requirements.txt`; add `src/` to `sys.path`; `packages.txt` → `libgl1`; `.python-version` = `3.11`. |
| Local Streamlit webcam | Needs **full** `opencv-python` + AVFoundation on macOS — not headless. |
| Hosted live camera | Server `cv2.VideoCapture(0)` cannot see the user’s webcam. Live on product UI = **browser MediaPipe**. |
| Local React stack | Run **API on `:8000`** and `cd web && npm run dev`. Missing API → Vite **502**. |
| npm | Always from **`web/`**, never repo root. |
| Rate limits | Landmarks ≫ frames ≫ uploads (defaults: **360 / 120 / 60** per window). |
| Vercel | Set **`VITE_API_BASE_URL`** (no trailing slash) and **redeploy** (Vite bake-time). Root Directory = `web`. |
| Auth / Supabase | Dedicated Technique Titan project only. Set **`VITE_SUPABASE_URL`** + **`VITE_SUPABASE_ANON_KEY`** from the **same** project (no trailing slash) and **redeploy**. Paste the **full** anon/publishable key as one line — no quotes, spaces, or line wraps. Never put **`service_role`** in `web/` or Vercel frontend env. Auth **Site URL** must be `https://technique-titan.vercel.app` (not `localhost:3000`). Redirect allow-list must include localhost **:5173** + production `/auth/callback`. `/admin` lists `auth.users`; apply the profiles + `admin_list_signups` migrations or Google OAuth rows never appear in `profiles`. |
| Render CORS | Set **`CORS_ORIGINS`** to the Vercel origin (`https://technique-titan.vercel.app`). Never pair `*` with `allow_credentials=True`. |
| Trust proxy | Set **`TRUST_PROXY=1`** behind Render/reverse proxy so rate limits use `X-Forwarded-For`. |
| Venvs | Ignore all `venv*` / `.venv*`. Recreate after Python upgrades; don’t trust stale `venv/`. |
| Streamlit state | Persist incrementally across reruns; don’t rely on `finally` after Stop. |
| Live UI | Hold last good scores between async responses; keep camera + **both hands'** primary feedback co-visible (side by side, not stacked). |
| Theme tokens | Renaming CSS vars requires updating TS/`getComputedStyle` consumers. |
| Assets | Don’t reference `/hero-*.jpg|mp4` unless files exist under `web/public/`. |
| Full-bleed layout | Don’t put `100vw` breakouts under a clipped `max-w-*` + `overflow-x-clip` parent. |
| Tests | Synthetic hand fixtures must be non-collinear for plane fits. |
| Filenames | Git-tracked names must match import and markdown-link **case** (Linux/CI is case-sensitive; macOS often is not). |
| GitHub mermaid | Quote node labels; avoid reserved IDs (`end`, `graph`, `input`); do not use subgraphs with edges that cross groups — GitHub/Safari crashes with `t.render`. |
| API unreachable | UI **Load failed** / **Failed to fetch** — check Render `/v1/health`; free tier cold start ~30–60s after idle; update `VITE_API_BASE_URL` + redeploy Vercel if API URL changed. |
| Root clutter | Keep Streamlit/Render entry files at repo root (`app.py`, `Dockerfile`, `requirements*.txt`). Do not commit source `*.mp4` or a root `package-lock.json` — frontend lockfile is `web/package-lock.json`; masters live in `assets/source/` (gitignored). |
| Local CLI | Run `python -m technique_titan.*` from the repo **`.venv`** after `pip install -e .`. Homebrew `python3.11` does not have the package. |

---

## Chronological log

### E01 — MediaPipe missing / wrong API version
| | |
|---|---|
| **When** | ~2026-06-15 |
| **Stage** | Early OpenCV + MediaPipe prototype |
| **Symptom** | `ModuleNotFoundError: mediapipe`; after install, newer MediaPipe broke `mp.solutions` |
| **Root cause** | Deps not installed; MediaPipe ≥0.10.35 removed legacy `mp.solutions.hands` |
| **Fix** | Install OpenCV + pin MediaPipe (first `0.10.9`, later project standard **`0.10.21`**) |
| **Prevention** | Never `pip install mediapipe` unpinned against `mp.solutions` code |

---

### E02 — macOS camera denied → empty frames / `cvtColor` crash
| | |
|---|---|
| **When** | ~2026-06-15 |
| **Stage** | Prototype webcam demo |
| **Symptom** | Empty frames; crash on color conversion |
| **Root cause** | macOS blocked camera (`not authorized to capture video`) |
| **Fix** | Grant Camera access for Cursor/Terminal; skip failed frames; clear exit messaging |
| **Prevention** | Treat empty frames as permission/backend failure, not a MediaPipe bug |

---

### E03 — Broken virtualenv after Python 3.9 removed
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Bulk geometry pipeline / package scaffold |
| **Symptom** | `venv` Python symlink broken; tools won’t run |
| **Root cause** | Old `venv/` pointed at removed Python 3.9 |
| **Fix** | Create fresh `.venv` (later also `venv311`) with Python 3.11; reinstall deps |
| **Prevention** | Recreate venvs after OS/Python upgrades; ignore all `venv*` in git |

---

### E04 — MediaPipe 0.10.35 + NumPy/OpenCV pin conflict
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Core engine install |
| **Symptom** | Legacy `mp.solutions` gone; OpenCV/NumPy resolver conflicts |
| **Root cause** | Fresh install pulled MediaPipe 0.10.35; pin to 0.10.21 forces NumPy 1.26 while newer OpenCV wanted NumPy ≥2 |
| **Fix** | Pin `mediapipe==0.10.21`, OpenCV ~4.10/4.11, NumPy `<2` in manifests |
| **Prevention** | Lock MediaPipe + OpenCV + NumPy together in `pyproject.toml` / requirements |

---

### E05 — Degenerate plane-fit unit test
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Geometry / scoring tests |
| **Symptom** | `fit_plane` test failed while others passed |
| **Root cause** | Synthetic MCP points were collinear → SVD normal indeterminate |
| **Fix** | Fit through a non-collinear triangle (wrist + index/pinky MCP) |
| **Prevention** | Synthetic fixtures must reflect real hand geometry |

---

### E06 — Streamlit Cloud dependency install failure
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Streamlit Community Cloud deploy |
| **Symptom** | Cloud installer non-zero exit / dependency processing error |
| **Root cause** | (1) `requirements.txt` mixed `opencv-python-headless` with editable `.` pulling GUI OpenCV; (2) default Cloud Python 3.13 — no MediaPipe 0.10.21 wheel |
| **Fix** | Commit `713814a`: remove editable install from Cloud requirements; `sys.path` insert for `src/` in `app.py`; pin headless OpenCV; add `packages.txt` (`libgl1`); `.python-version` = **3.11** |
| **Prevention** | Never mix headless + GUI OpenCV in one resolve; force Python 3.11 for MediaPipe on Cloud |

---

### E07 — Local live camera broken after headless OpenCV
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Streamlit local live camera (post–Cloud hardening) |
| **Symptom** | “Camera not available…” even on a Mac with a webcam |
| **Root cause** | Cloud switch to `opencv-python-headless` cannot open local macOS webcam |
| **Fix** | Commit `2b63b1c`: local path uses full `opencv-python` via `requirements-dev.txt`; `CAP_AVFOUNDATION` on Darwin; detect headless vs permission vs Streamlit Cloud and show clearer errors |
| **Prevention** | Headless for Cloud/Docker/API; full OpenCV for local Streamlit webcam — document both |

---

### E08 — Streamlit Cloud cannot do server-side live camera
| | |
|---|---|
| **When** | 2026-07-10 |
| **Stage** | Cloud deploy / architecture |
| **Symptom** | Expectation that live camera works on Streamlit Cloud |
| **Root cause** | `cv2.VideoCapture(0)` runs on the remote server, which has no user webcam |
| **Fix** | Cloud UI warning; Photo/Video on Cloud; product live later moved to **browser MediaPipe** in React |
| **Prevention** | Hosted live = client capture (browser MediaPipe / WebRTC), never server OpenCV |

---

### E09 — Record session: no summary/download after Stop
| | |
|---|---|
| **When** | 2026-07-15 |
| **Stage** | Streamlit live record feature |
| **Symptom** | After Record → Stop, no summary or download appeared |
| **Root cause** | Streamlit rerun on Stop tore down the camera loop before `finally` persisted frames/scores |
| **Fix** | Persist frames/scores to session state each frame; finalize on Stop click |
| **Prevention** | Don’t rely on `finally` across Streamlit reruns — persist incrementally |

---

### E10 — Live UI: coaching scrolled off-screen
| | |
|---|---|
| **When** | 2026-07-23 |
| **Stage** | Streamlit live + coaching UX |
| **Symptom** | Tall camera + tall score widgets; feedback required scroll that hid the video |
| **Root cause** | Vertical stack without a co-visible feedback region |
| **Fix** | Split viewport (~63% camera / ~37% feedback); compact bars; primary tip + expander; independent feedback scroll |
| **Prevention** | Live practice must keep camera + primary feedback co-visible |

---

### E11 — React live overlay flicker
| | |
|---|---|
| **When** | 2026-07-27 |
| **Stage** | React + FastAPI product (live practice) |
| **Symptom** | Overlay/scores flickered every frame |
| **Root cause** | Canvas cleared scores each frame when the latest async API result was missing |
| **Fix** | Keep `lastResultsRef` and paint last good scores while waiting |
| **Prevention** | Live canvas: hold last successful result between async score responses |

---

### E12 — Hero black box (missing media assets)
| | |
|---|---|
| **When** | 2026-07-28 |
| **Stage** | Landing page UI |
| **Symptom** | Hero rendered as a black box |
| **Root cause** | `Hero` referenced `/hero-piano.mp4` / `.jpg` not present under `web/public/` |
| **Fix** | Add real `hero-piano.jpg` under `web/public/`; use `<img>` (+ CSS motion) instead of missing video |
| **Prevention** | Never ship media `src`s without checked-in (or generated) assets |

---

### E13 — `npm install` ENOENT at repo root
| | |
|---|---|
| **When** | 2026-07-28 |
| **Stage** | React frontend tooling |
| **Symptom** | `npm install` failed with ENOENT |
| **Root cause** | Command run from repo root; `package.json` lives under `web/` |
| **Fix** | `cd web && npm install` |
| **Prevention** | All frontend package commands from `web/` |

---

### E14 — Stale Vite serving old Hero
| | |
|---|---|
| **When** | 2026-07-30 |
| **Stage** | Landing page UI |
| **Symptom** | Layout/code changes not visible in browser |
| **Root cause** | Stale Vite process/cache serving old bundle |
| **Fix** | Clear Vite cache, restart `npm run dev`, hard-refresh browser |
| **Prevention** | After large layout edits, restart Vite + hard refresh before declaring “not fixed” |

---

### E15 — Live practice `Request failed (502)` + broken venv
| | |
|---|---|
| **When** | 2026-07-30 |
| **Stage** | React Live practice (local) |
| **Symptom** | 502 when a hand appears (no error with no hand) |
| **Root cause** | Vite proxies `/v1/*` → `:8000`; API down (`ECONNREFUSED`). Stale `venv` (dead Python 3.9) couldn’t import `cv2` / start uvicorn |
| **Fix** | Create `venv311` with Python 3.11 + `requirements-api.txt`; start `uvicorn api.main:app --reload --port 8000` |
| **Prevention** | Local product needs **both** UI and API. Hand detection triggers API calls — silence with no hand is expected |

---

### E16 — Live practice rate-limit (429)
| | |
|---|---|
| **When** | 2026-07-30 |
| **Stage** | React Live practice / API rate limiting |
| **Symptom** | Rate-limit error after ~15s of live use |
| **Root cause** | Landmark posts ~4 Hz against a flat **60 POST/min** budget shared with uploads |
| **Fix** | Path-tiered limits (landmarks **360**/min, frames **120**/min, image/video **60**/min); `Retry-After`; client ~2s backoff on 429; frame mode paced to 500ms |
| **Prevention** | Never apply heavy-upload caps to high-frequency `/score/landmarks` |

---

### E17 — Almost committing `venv311/` + insecure CORS/proxy defaults
| | |
|---|---|
| **When** | 2026-07-30 |
| **Stage** | Repo hygiene / API security |
| **Symptom** | `git add` would stage thousands of venv files; CORS/credentials and forwarded-IP trust were unsafe |
| **Root cause** | `.gitignore` covered `venv/`/`.venv/` but not `venv311/`; `CORS_ORIGINS=*` with credentials; trusting `X-Forwarded-For` without a proxy flag |
| **Fix** | Ignore `venv*/`; fix CORS + credentials pairing; gate forwarded-IP trust behind `TRUST_PROXY` |
| **Prevention** | Ignore all venv name patterns; never pair `*` CORS with credentials; only trust forwarded IPs when `TRUST_PROXY=1` |

---

### E18 — Theme token break (`severityColor`)
| | |
|---|---|
| **When** | 2026-07-30 |
| **Stage** | Landing / product UI theme revamp |
| **Symptom** | Severity colors broke after dark theme token cleanup |
| **Root cause** | Removed `--color-ink-muted` while TS still read it |
| **Fix** | Point `severityColor` at `--color-muted`; update canvas hexes in MediaPipe helpers |
| **Prevention** | Theme renames must update TS/`getComputedStyle` consumers, not only CSS classes |

---

### E19 — Railway root `{"detail":"Not Found"}` (operator confusion)
| | |
|---|---|
| **When** | 2026-08-05 |
| **Stage** | Railway API deploy |
| **Symptom** | Opening the Railway root URL returns Not Found |
| **Root cause** | API has no `/` route; the product UI is on Vercel |
| **Fix** | Use `/v1/health` or `/docs` on Railway; open the Vercel URL for the site |
| **Prevention** | Document Railway as API-only (see [`DEPLOY.md`](./DEPLOY.md)) |

---

### E20 — Vercel deploy `Request failed (405)`
| | |
|---|---|
| **When** | 2026-08-05 |
| **Stage** | Vercel UI + Railway API production |
| **Symptom** | Analyze/live requests fail with **405** on the deployed site |
| **Root cause** | Missing `VITE_API_BASE_URL` → browser POSTs hit Vercel `/v1/...` (SPA host), not Railway |
| **Fix** | Set `VITE_API_BASE_URL` to the Railway origin (no trailing slash) and **redeploy**; set Railway `CORS_ORIGINS` to the Vercel origin |
| **Prevention** | Vite env vars are bake-time — changing them requires a new Vercel build. Root Directory must be `web` |

---

### E21 — Landing hero not full-bleed horizontally
| | |
|---|---|
| **When** | 2026-08-05 |
| **Stage** | Landing page UI |
| **Symptom** | Hero image constrained to content column; not fluid full width |
| **Root cause** | `overflow-x-clip` on `<main>` clipped a `100vw` breakout inside `max-w-6xl` |
| **Fix** | Move overflow clip to the outer page shell so the hero can span the viewport |
| **Prevention** | Full-bleed breakouts cannot live under a clipped max-width main |

---

### E22 — Production UI “Load failed”
| | |
|---|---|
| **When** | 2026-08-17 |
| **Stage** | Vercel UI + Railway API production |
| **Symptom** | Photo / video / live show **Load failed** (Safari) or **Failed to fetch** (Chrome) |
| **Root cause** | Vercel bundle posts to `https://techniquetitan-production.up.railway.app`, but Railway’s edge returned 404 `Application not found` (`x-railway-fallback: true`) — service or public domain gone. No CORS on that fallback, so the browser surfaces a TypeError. |
| **Fix** | Restore the Railway API (redeploy + Generate Domain). If the hostname changed, set Vercel `VITE_API_BASE_URL` and redeploy. UI maps the TypeError to an API-unreachable message and banners when `/v1/health` fails. |
| **Prevention** | After any Railway domain change, update `VITE_API_BASE_URL` and redeploy Vercel. Smoke-check `/v1/health` before assuming the UI is broken. |

---

### E23 — API migrated Railway → Render
| | |
|---|---|
| **When** | 2026-08-17 |
| **Stage** | Production deploy |
| **Symptom** | Railway subscription ended; production UI could not reach API |
| **Root cause** | API host was `techniquetitan-production.up.railway.app`; service removed when Railway plan lapsed |
| **Fix** | Deploy API to Render (`technique-titan-api.onrender.com`); set Vercel `VITE_API_BASE_URL`; `CORS_ORIGINS` + `TRUST_PROXY=1` on Render; add `render.yaml`; defer MediaPipe init so `/v1/health` passes deploy checks |
| **Prevention** | Document production API URL in `DEPLOY.md` / `.env.example`; smoke-test `/v1/health` after any host change |

---

### E24 — macOS hid case-mismatched paths that would fail on Linux CI
| | |
|---|---|
| **When** | 2026-08-24 |
| **Stage** | Repo hygiene / directory reorganization |
| **Symptom** | Git tracked camelCase web files (`overlayImage.tsx`) and `docs/ERRORS.md` while TypeScript imports and markdown links used PascalCase / `errors.md`. Fine on macOS; Vite resolve and GitHub links break on Linux. |
| **Root cause** | Default macOS disk is case-insensitive, so `git status` does not flag case-only drift. |
| **Fix** | Two-step `git mv` to PascalCase components grouped under `layout/`, `marketing/`, `analyze/`, `ui/`; rename `docs/ERRORS.md` → `docs/errors.md`; park research binary in `docs/archive/`. |
| **Prevention** | Git-tracked paths must match import and markdown-link case exactly. After a case rename, confirm with `git ls-files` (not Finder/`ls`). |

---

### E25 — Live UI: right-hand stats required scroll
| | |
|---|---|
| **When** | 2026-09-02 |
| **Stage** | React live practice |
| **Symptom** | With both hands in frame, only the left-hand score card was visible; right-hand stats sat below the fold |
| **Root cause** | Live feedback column stacked `ScorePanel` + `CoachingTips` per hand in a single `1fr` column |
| **Fix** | Camera beside a two-column Left/Right grid; dense score cards so both fit in a normal window |
| **Prevention** | Live practice must keep camera + both hands' scores co-visible, side by side |

---

### E26 — GitHub README mermaid failed to render
| | |
|---|---|
| **When** | 2026-09-10 |
| **Stage** | README / GitHub Markdown preview |
| **Symptom** | `Unable to render rich display` / `undefined is not an object (evaluating 't.render')` on the How it works diagram |
| **Root cause** | GitHub's Mermaid renderer (especially Safari) crashes on `flowchart` subgraphs named `input`/`output` with edges that cross groups, unquoted `+`/`.` in labels, and chained `A --> B --> C` links |
| **Fix** | Rewrite as GitHub-documented `graph TD` with quoted labels, no subgraphs, no reserved IDs, one edge per line |
| **Prevention** | Keep GitHub mermaid diagrams to quoted labels and simple node-to-node edges; skip subgraphs when arrows leave the group |

---

### E27 — Safari native play button on looping landing videos
| | |
|---|---|
| **When** | 2026-09-10 |
| **Stage** | Landing page UI |
| **Symptom** | Autoplaying photo/video cards showed Safari’s native play-button / controls overlay even with `autoPlay muted playsInline` |
| **Root cause** | Safari Low Power Mode (macOS + iOS) always shows a native play overlay on `<video autoplay>` (WebKit 219889, WONTFIX). CSS `::-webkit-media-controls-*` cannot hide it. Nesting the clip in `<a>` and offering WebM first made `play()` fail more often. |
| **Fix** | Abandoned the canvas/`VideoPreview` workaround. Landing clips are plain `<video>` elements (not wrapped in links); Safari’s play overlay is accepted. |
| **Prevention** | Don’t wrap landing preview videos in `<a>`. Don’t spend time hiding Safari’s Low Power Mode play button. |

---

### E28 — Source videos and empty npm lockfile at repo root
| | |
|---|---|
| **When** | 2026-09-11 |
| **Stage** | Repo hygiene / directory organization |
| **Symptom** | Root held ~70 MB of unoptimized `photo_mode.mp4` / `video_mode.mp4` plus an empty `package-lock.json` from `npm` run outside `web/` |
| **Root cause** | Landing masters were committed next to deploy entry files; `npm install` at repo root (see E13) left a lockfile with `"packages": {}` |
| **Fix** | Untrack the root videos (keep local copies in `assets/source/`); delete the root lockfile; gitignore `assets/source/**` and root `package-lock.json` / `package.json` |
| **Prevention** | Do not commit source media at repo root. Optimized clips stay in `web/public/landing/`. All npm commands from `web/`. |

---

### E29 — Homebrew python3.11 missing `technique_titan`
| | |
|---|---|
| **When** | 2026-09-14 |
| **Stage** | Evaluation loop / batch CLI |
| **Symptom** | `ModuleNotFoundError: No module named 'technique_titan'` when running `python -m technique_titan.batch.process_folder` / `technique_titan.eval` |
| **Root cause** | Commands used system Homebrew `python3.11` without `pip install -e .` (package lives in `src/`; that interpreter has no editable install) |
| **Fix** | Create repo `.venv` with `python3.11 -m venv .venv`, then `.venv/bin/python -m pip install -e .` and `requirements-dev.txt`; document venv before CLI commands in the README |
| **Prevention** | Always run batch/eval via the repo `.venv` after an editable install. Do not assume Homebrew `python3.11` can import `technique_titan`. |

---

### E30 — Production signup `Invalid API key`
| | |
|---|---|
| **When** | 2026-09-17 |
| **Stage** | Vercel UI + Supabase Auth |
| **Symptom** | Create account / Google sign-in on production shows **Invalid API key** |
| **Root cause** | Vite bakes `VITE_SUPABASE_*` at build time. Production had the URL for one Supabase project and a truncated JWT anon key from another (header + payload only, a space after the first `.`, missing signature). GoTrue rejects that `apikey` header. |
| **Fix** | In Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the **same** dedicated Technique Titan project. Paste the full anon/publishable key as a single line with no quotes. Redeploy. Client now strips whitespace/quotes and refuses a 2-part JWT so this fails closed with a setup message instead of a cryptic API error. |
| **Prevention** | URL and key must share a project ref. Copy the key from the dashboard reveal (not a wrapped preview). Changing env vars requires a new Vercel build. |

---

### E31 — Email confirm opens `localhost:3000` / `otp_expired`
| | |
|---|---|
| **When** | 2026-09-17 |
| **Stage** | Supabase Auth email confirmation |
| **Symptom** | Safari: can’t connect to `localhost:3000/?error=access_denied&error_code=otp_expired…` after clicking the confirm-email link |
| **Root cause** | GoTrue **Site URL** defaulted to `http://localhost:3000` (Next.js). The confirmation `emailRedirectTo` (`/auth/callback` on Vite `:5173` or Vercel) was not in the redirect allow-list, so the email landed on Site URL. The token was already rejected (`otp_expired`) before the browser even tried to load that host. |
| **Fix** | Dashboard → Authentication → URL configuration: Site URL `https://technique-titan.vercel.app`; Redirect URLs `http://localhost:5173/auth/callback` and `https://technique-titan.vercel.app/auth/callback`. Discard the old email; resend confirmation. App maps `otp_expired` to a resend form and forwards `/?error=…` / `?code=` to `/auth/callback`. |
| **Prevention** | Never leave Site URL as `localhost:3000`. Allow-list must match `emailRedirectTo` exactly or GoTrue falls back to Site URL. |

---

### E32 — Google signup missing from `/admin`
| | |
|---|---|
| **When** | 2026-09-17 |
| **Stage** | Supabase Auth + admin stats |
| **Symptom** | A second Google account can sign in, but `/admin` account signups does not list it |
| **Root cause** | The page read `public.profiles`, which is filled only by `handle_new_user` on `auth.users` insert. If that trigger was missing, applied late, or the Google identity was linked onto an existing user, Auth has the account and `profiles` does not get a new row. |
| **Fix** | Backfill `profiles` from `auth.users`, upsert in the trigger, and list signups via `admin_list_signups()` (reads `auth.users`). Run [`supabase/migrations/20260917000002_admin_list_signups.sql`](../supabase/migrations/20260917000002_admin_list_signups.sql) on the production project and refresh `/admin`. |
| **Prevention** | Admin counts must follow `auth.users`, not assume the profiles trigger already ran. Same email + Google is one Auth user. |

---

## Appendix — minor / environment notes

| ID | Note |
|---|---|
| A1 | Early `HandTrackingModule.py` had a `def(main):` syntax issue in legacy prototype code; prefer `src/technique_titan/` and `scripts/`, not legacy copies. |
| A2 | MediaPipe can segfault (exit 139) inside restricted sandboxes; run CV tests with full permissions / outside sandbox. |

---

## How to append a new error

When a significant bug is found and fixed, add the next `E##` entry:

```markdown
### E33 — Short title
| | |
|---|---|
| **When** | YYYY-MM-DD |
| **Stage** | Where in the product lifecycle |
| **Symptom** | What the user/agent saw |
| **Root cause** | Why it happened |
| **Fix** | What changed (commit SHA if available) |
| **Prevention** | Rule so it is not repeated |
```

Also add a one-line rule to the **Quick checklist** if it is likely to recur.
