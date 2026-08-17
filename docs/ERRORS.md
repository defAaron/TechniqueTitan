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
| Railway CORS | Set **`CORS_ORIGINS`** to the Vercel origin. Never pair `*` with `allow_credentials=True`. |
| Trust proxy | Set **`TRUST_PROXY=1`** only behind Railway/reverse proxy. |
| Venvs | Ignore all `venv*` / `.venv*`. Recreate after Python upgrades; don’t trust stale `venv/`. |
| Streamlit state | Persist incrementally across reruns; don’t rely on `finally` after Stop. |
| Live UI | Hold last good scores between async responses; keep camera + primary feedback co-visible. |
| Theme tokens | Renaming CSS vars requires updating TS/`getComputedStyle` consumers. |
| Assets | Don’t reference `/hero-*.jpg|mp4` unless files exist under `web/public/`. |
| Full-bleed layout | Don’t put `100vw` breakouts under a clipped `max-w-*` + `overflow-x-clip` parent. |
| Tests | Synthetic hand fixtures must be non-collinear for plane fits. |
| Railway gone | UI **Load failed** / **Failed to fetch** = API host 404 `Application not found`. Recreate the Railway public domain; update `VITE_API_BASE_URL` if it changed and redeploy Vercel. |

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

## Appendix — minor / environment notes

| ID | Note |
|---|---|
| A1 | Early `HandTrackingModule.py` had a `def(main):` syntax issue in legacy prototype code; prefer `src/technique_titan/` and `scripts/`, not legacy copies. |
| A2 | MediaPipe can segfault (exit 139) inside restricted sandboxes; run CV tests with full permissions / outside sandbox. |

---

## How to append a new error

When a significant bug is found and fixed, add the next `E##` entry:

```markdown
### E23 — Short title
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
