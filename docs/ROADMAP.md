# Technique Titan — Roadmap

**Status:** Draft v1.1
**Last updated:** 2026-08-05
**Companion document:** [`PRD.md`](./PRD.md)

This roadmap turns the PRD into a phased, milestone-based delivery plan. Each phase lists
**goals**, **key deliverables**, **dependencies**, **estimated duration**, and a
**definition of done (DoD)**. Durations assume a small team (roughly 1–2 engineers) and are
estimates, not commitments.

### Baseline (current)

| Area | Location | Status |
|---|---|---|
| Core engine | `src/technique_titan/` | Done |
| Scoring + coaching config | `config/*.yaml` | Done |
| Product API | `api/` | Done |
| Product UI | `web/` (photo / video / live / about) | Done (analyze UX) |
| Streamlit interim UI | `app.py` | Done |
| Batch CLI | `technique_titan.batch` | Done |
| CI | `.github/workflows/ci.yml` | Done (pytest + web build) |
| Session persistence / progress | — | Not started |
| Accounts / teacher roles / ML model | — | Not started |

---

## Phase 0 — Foundation

**Status:** Done

**Goals**
- Convert early prototypes into a maintainable, reproducible project.
- Establish tooling, structure, and a data-collection strategy before building features.

**Key Deliverables**
- Project structure (`src/`, `tests/`, `data/`, `docs/`, `config/`) with detection in `src/technique_titan/detection/hand_detector.py`. ✅
- Dependency manifests: `pyproject.toml`, `requirements.txt`, `requirements-api.txt`, `requirements-dev.txt`, `web/package-lock.json`. Practical runtime: **Python 3.11**, MediaPipe `0.10.21`, OpenCV `4.10.x`, NumPy `>=1.26,<2`. ✅
- CI pipeline: GitHub Actions runs pytest (Python 3.11) and `npm run build` (Node 22). ✅ (Python lint/pre-commit deferred; web lint via local `oxlint`)
- Test harness with landmark fixtures and API/engine tests. ✅
- Data intake layout + labeling template (`data/README.md`, `labels_template.csv`). ✅
- Sample raw images under `data/raw/` for batch smoke runs. ✅

**Definition of Done**
- A fresh checkout can install dependencies and run tests green in CI. ✅

---

## Phase 1 — Core Detection

**Status:** Done (heuristic engine shipped; expert ≥85% validation still ongoing as data accumulates)

**Goals**
- Extract reliable, normalized hand landmarks.
- Implement heuristic scoring for **all five** criteria.

**Key Deliverables**
- Robust landmark extraction: 21 landmarks per hand, laterality, confidence, normalization. ✅
- Heuristic scoring for all five criteria → 0–100 + severity, documented in [SCORING_METHODS.md](./SCORING_METHODS.md). ✅
- Composite score with documented weighting. ✅
- Externally configurable thresholds (`config/scoring.yaml`). ✅
- Unit tests against fixed landmark fixtures. ✅
- Validation against expert-labeled set — **in progress** as labels are collected via batch + `labels.csv`.

**Definition of Done**
- All five criteria produce scores + severities. ✅
- Severity agreement ≥ 85% with expert labels — **pending** larger labeled set.
- Landmark extraction ≥ 95% on in-spec inputs — target retained; measure on curated set.
- Score repeatability within ±5/100 for a static pose — target retained.
- Scoring methodology documented; tests green in CI. ✅

---

## Phase 2 — Feedback Engine

**Status:** Done

**Goals**
- Turn scores/severities into clear, prioritized, plain-language coaching.

**Shipped as** `src/technique_titan/coaching.py` + `config/coaching.yaml` + Streamlit and React coaching UI. **Templates chosen over LLM** (PRD Open Question 6): deterministic, offline-capable copy with direction-aware `too_low` / `too_high` / `generic` variants. Primary-tip landmark highlights draw on top of the whole-hand severity overlay.

**Key Deliverables**
- Feedback generator for each non-good criterion. ✅
- Severity-aware prioritization. ✅
- Encouraging beginner-appropriate tone via templates. ✅
- Message catalog per criterion and severity. ✅
- Visual feedback overlay / tip highlights. ✅
- Tests for message selection and ordering. ✅

**Definition of Done**
- Every criterion has good/warning/critical feedback content; output is correctly prioritized. ✅
- Overlay renders the flagged criterion on a sample image/frame. ✅

---

## Phase 3 — Product Surface

**Status:** In progress — analyze UX shipped; persistence next

**Goals**
- Deliver a usable web product with static, video, and live modes, then progress tracking.

### 3a — Analyze UX (shipped)

- React + TypeScript + Vite + Tailwind product UI (`web/`). ✅
- FastAPI backend (`api/`) with rate limits, CORS, healthcheck. ✅
- **Static image upload** → scores + coaching + overlay (`/photo`). ✅
- **Video analysis** with posture timeline (`/video` + Recharts). ✅
- **Live camera** in the browser: landmarks (fast) or frame upload (`/live`). ✅
- Marketing home, about page, brand assets. ✅
- Deploy path: Railway (API Docker) + Vercel (SPA). ✅ See [DEPLOY.md](./DEPLOY.md).
- Streamlit retained as interim / research surface. ✅

### 3b — Persistence & polish (next)

- Persistence of session results and **session history + progress charts** per criterion over time. *(PRD: FR-PT-1…FR-PT-3, UC-4)*
- Richer in-product capture guidance. *(PRD: FR-IN-5)*
- Accessibility pass to WCAG 2.1 AA basics (contrast, keyboard nav, non-color severity cues, screen-reader text). *(PRD: NFR-A11Y-1…3)*
- Optional: retire Streamlit Community Cloud once Vercel is the sole public URL.

**Dependencies**
- Phases 1 & 2 (engine + feedback). ✅

**Estimated Duration:** 4–6 weeks total (3a largely complete; 3b remaining)

**Definition of Done**
- A user can analyze a static image **and** run real-time mode in the browser and receive scored, prioritized feedback. ✅
- Interactive live score updates (throttled API path). ✅
- Sessions are saved and progress charts render historical trends. ❌ (remaining)
- Accessibility checklist passes for the core flows. ❌ (remaining)

---

## Phase 4 — Intelligence Upgrade

**Status:** Planned

**Goals**
- Improve accuracy with a piano-specific model and add multi-user/teacher capabilities.

**Key Deliverables**
- Model fine-tuned on piano-specific hand-posture data (augmenting or replacing heuristics), with heuristics retained as documented fallback. *(PRD §3.3 note)*
- Expanded, well-labeled training/validation datasets (built on the Phase 0 protocol).
- User accounts with **teacher/student roles**: students submit sessions; teachers review, annotate, and assign corrections. *(PRD: FR-PT-4, UC-5)*
- **Exportable reports** (PDF/CSV) of sessions and progress. *(PRD: FR-PT-5)*
- Access control and privacy handling for stored user data. *(PRD: NFR-SEC-3)*

**Dependencies**
- Phase 3b (product surface + persistence) and accumulated/labeled data.

**Estimated Duration:** 6–8 weeks

**Definition of Done**
- Fine-tuned model meets or exceeds heuristic accuracy on the held-out validation set (and improves agreement beyond the ≥85% baseline).
- Teacher and student roles work end-to-end (submit → review → annotate).
- Reports export correctly; stored data is access-controlled.

---

## Phase 5 — Scale & Polish

**Status:** Planned

**Goals**
- Optimize performance, harden accessibility, and prepare for sustainable growth.

**Key Deliverables**
- Performance optimization toward higher live FPS / lower cold-start (prefer more on-device scoring). *(PRD: NFR-PERF-2, NFR-PERF-3)*
- Full accessibility audit (WCAG 2.1 AA) with remediation. *(PRD: NFR-A11Y-*)*
- Monetization options implemented per chosen model (freemium/subscription/B2B — PRD Open Question 8).
- Community feedback loop: in-product feedback capture, issue triage, public changelog/roadmap.
- Reliability/observability: error tracking, basic analytics for the success metrics in PRD §5.

**Dependencies**
- Phase 4 (full feature set and accounts).

**Estimated Duration:** Ongoing (initial hardening 4–6 weeks, then continuous)

**Definition of Done**
- Real-time performance target met on reference hardware.
- Accessibility audit passed with no critical issues outstanding.
- At least one monetization path live; feedback loop operational with metrics dashboards tracking PRD success metrics.

---

## Cross-Phase Dependency Summary

| Phase | Depends on | Status | Unlocks |
|---|---|---|---|
| 0 — Foundation | Early prototypes | Done | Reproducible builds, data strategy |
| 1 — Core Detection | Phase 0 | Done* | Scored criteria |
| 2 — Feedback Engine | Phase 1 | Done | Actionable coaching |
| 3a — Analyze UX | Phases 1–2 | Done | Public web product |
| 3b — Persistence | Phase 3a | Next | Progress tracking |
| 4 — Intelligence Upgrade | Phase 3b + data | Planned | Better accuracy, teacher/student, reports |
| 5 — Scale & Polish | Phase 4 | Planned | Perf, a11y, monetization, community |

\*Expert-label validation targets remain active work as the dataset grows.

## Indicative Timeline
Phases 0–3a are complete. Remaining Phase 3b through end of Phase 4 is roughly
**10–14 weeks** of sequential work for a small team, with Phase 5 as ongoing
hardening thereafter. Documentation, testing, and data collection run continuously.
