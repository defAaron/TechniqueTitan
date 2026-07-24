# Technique Titan — Roadmap

**Status:** Draft v1.0
**Last updated:** 2026-06-15
**Companion document:** [`PRD.md`](./PRD.md)

This roadmap turns the PRD into a phased, milestone-based delivery plan. Each phase lists
**goals**, **key deliverables**, **dependencies**, **estimated duration**, and a
**definition of done (DoD)**. Durations assume a small team (roughly 1–2 engineers) and are
estimates, not commitments.

### Baseline (what exists today)
The repository currently contains a proven hand-landmarking prototype and a
bulk geometry pipeline:

- `scripts/live_webcam_demo.py` — live webcam → MediaPipe Hands → drawn landmarks + FPS overlay
- `scripts/hand_detector_prototype.py` — early `handDetector` class
- `src/technique_titan/` — installable package (detection, geometry, features, scoring, batch CLI)
- `tests/` — unit tests with synthetic landmark fixtures
- `config/scoring.yaml` — tunable scoring thresholds

There is **no feedback engine, persistence layer, UI, or CI yet.** The roadmap
builds outward from this baseline.

---

## Phase 0 — Foundation

**Goals**
- Convert the existing loose scripts into a maintainable, reproducible project.
- Establish tooling, structure, and a data-collection strategy before building features.

**Key Deliverables**
- Project structure (`src/`, `tests/`, `data/`, `docs/`, `scripts/`, `config/`) with the existing prototype refactored into a clean, importable detection module (evolving `scripts/hand_detector_prototype.py`; originals preserved in `scripts/` and `legacy/`).
- Dependency manifests pinned to the versions already in the `venv` (`requirements.txt` and/or `pyproject.toml`): Python 3.9+, MediaPipe ~0.10.x, OpenCV ~4.x, NumPy ~2.x.
- Tooling: formatter + linter (e.g., black/ruff), pre-commit hooks, and a minimal CI pipeline that runs lint + tests.
- Test harness with at least one smoke test that loads a sample image and extracts landmarks.
- **Data collection strategy** for hand-landmark datasets: define capture protocol (angles, lighting, hand sizes, left/right, skill levels), labeling schema for the 5 criteria (good/warning/critical), consent/privacy handling, and storage layout. Identify candidate public datasets and the plan for collecting piano-specific samples.
- Sample dataset stub (a small set of labeled reference images) to enable Phase 1 validation.

**Dependencies**
- None beyond the existing prototype and environment.

**Estimated Duration:** 1–2 weeks

**Definition of Done**
- A fresh checkout can install dependencies from the manifest and run the detection module + smoke test green in CI.
- Documented data-collection and labeling protocol is committed.
- A small labeled validation set exists for Phase 1.

---

## Phase 1 — Core Detection

**Goals**
- Extract reliable, normalized hand landmarks.
- Implement heuristic scoring for **all five** criteria.

**Key Deliverables**
- Robust landmark extraction module: 21 landmarks per hand, laterality (left/right) detection, confidence signal, and coordinate normalization (scale/translation invariant). *(PRD: FR-PD-1…FR-PD-5)*
- Heuristic, geometry-based scoring for each criterion, each producing a normalized 0–100 score + severity band, with documented landmark inputs and formulas: *(PRD: FR-SC-1…FR-SC-6)*
  1. Wrist height
  2. Finger curvature
  3. Thumb position
  4. Wrist lateral deviation
  5. Overall hand arch
- Composite score with documented weighting.
- Externally configurable thresholds (config file).
- Unit tests against fixed landmark fixtures with known expected scores. *(PRD: NFR-MAINT-1)*
- Validation report comparing scores/severity against the Phase 0 labeled set.

**Dependencies**
- Phase 0 (structure, manifests, labeled validation set).

**Estimated Duration:** 3–4 weeks

**Definition of Done**
- All five criteria produce scores + severities on the validation set.
- Severity classification agreement with expert labels **≥ 85%** *(PRD: NFR-ACC-2)*.
- Landmark extraction success **≥ 95%** on in-spec inputs *(PRD: NFR-ACC-1)*.
- Score repeatability within **±5/100** for a static pose *(PRD: NFR-ACC-3)*.
- Scoring methodology documented; tests green in CI.

---

## Phase 2 — Feedback Engine

**Goals**
- Turn scores/severities into clear, prioritized, plain-language coaching.

**Status:** Shipped as an additive layer (`src/technique_titan/coaching.py` +
`config/coaching.yaml` + Streamlit UI). **Templates chosen over LLM** (PRD Open
Question 6): deterministic, offline-capable copy with direction-aware
`too_low` / `too_high` / `generic` variants. Primary-tip landmark highlights are
drawn on top of the existing whole-hand severity overlay without changing core
scoring or `draw_all_overlays` behavior.

**Key Deliverables**
- Feedback generator that, for each non-good criterion, emits a concise critique describing the problem and the fix. *(PRD: FR-FB-1)*
- Severity-aware prioritization (good / warning / critical), surfacing the most important correction first. *(PRD: FR-FB-2)*
- Encouraging, beginner/child-appropriate tone, validated against examples. *(PRD: FR-FB-3)*
- Message catalog / templates per criterion and severity (deterministic, offline-capable). Decision recorded on templated vs. LLM-based generation (PRD Open Question 6).
- Visual feedback overlay: annotated landmarks / highlighted problem region. *(PRD: FR-FB-4)*
- Tests asserting correct message selection and ordering for representative score inputs.

**Dependencies**
- Phase 1 (scores + severities).

**Estimated Duration:** 2–3 weeks

**Definition of Done**
- Every criterion has good/warning/critical feedback content; output is correctly prioritized.
- Overlay renders the flagged criterion on a sample image/frame.
- A small user/teacher review confirms feedback is understandable and actionable.

---

## Phase 3 — Product Surface

**Goals**
- Deliver a usable interface with both real-time and static modes, plus progress tracking.

**Key Deliverables**
- Web UI (per PRD NFR-PLAT-3) with:
  - **Static image upload** mode → per-criterion scores + feedback. *(PRD: UC-1, FR-IN-1)*
  - **Real-time camera mode** with live overlay + rolling summary. *(PRD: UC-2, FR-IN-2)*
  - (SHOULD) video-file analysis with a posture timeline. *(PRD: UC-3, FR-IN-3)*
- Input validation + capture guidance and graceful camera-permission handling across platforms. *(PRD: FR-IN-4, FR-IN-5, NFR-PLAT-4)*
- Persistence of session results and **session history + progress charts** per criterion over time. *(PRD: FR-PT-1…FR-PT-3, UC-4)*
- Accessibility pass to WCAG 2.1 AA basics (contrast, keyboard nav, non-color severity cues, screen-reader text). *(PRD: NFR-A11Y-1…3)*

**Dependencies**
- Phases 1 & 2 (engine + feedback).

**Estimated Duration:** 4–6 weeks

**Definition of Done**
- A user can analyze a static image **and** run real-time mode in the browser and receive scored, prioritized feedback.
- Real-time mode sustains **≥ 15 FPS** end-to-end; static analysis returns in **≤ 2 s** *(PRD: NFR-PERF-1, NFR-PERF-2)*.
- Sessions are saved and progress charts render historical trends.
- Accessibility checklist passes for the core flows.

---

## Phase 4 — Intelligence Upgrade

**Goals**
- Improve accuracy with a piano-specific model and add multi-user/teacher capabilities.

**Key Deliverables**
- Model fine-tuned on piano-specific hand-posture data (augmenting or replacing heuristics), with heuristics retained as documented fallback. *(PRD §3.3 note)*
- Expanded, well-labeled training/validation datasets (built on the Phase 0 protocol).
- User accounts with **teacher/student roles**: students submit sessions; teachers review, annotate, and assign corrections. *(PRD: FR-PT-4, UC-5)*
- **Exportable reports** (PDF/CSV) of sessions and progress. *(PRD: FR-PT-5)*
- Access control and privacy handling for stored user data. *(PRD: NFR-SEC-3)*

**Dependencies**
- Phase 3 (product surface + persistence) and accumulated/labeled data.

**Estimated Duration:** 6–8 weeks

**Definition of Done**
- Fine-tuned model meets or exceeds heuristic accuracy on the held-out validation set (and improves agreement beyond the ≥85% baseline).
- Teacher and student roles work end-to-end (submit → review → annotate).
- Reports export correctly; stored data is access-controlled.

---

## Phase 5 — Scale & Polish

**Goals**
- Optimize performance, harden accessibility, and prepare for sustainable growth.

**Key Deliverables**
- Performance optimization toward the 24–30 FPS real-time target and faster cold-start/load. *(PRD: NFR-PERF-2, NFR-PERF-3)*
- Full accessibility audit (WCAG 2.1 AA across the product, not just core flows) with remediation. *(PRD: NFR-A11Y-*)*
- Monetization options implemented per chosen model (freemium/subscription/B2B — PRD Open Question 8).
- Community feedback loop: in-product feedback capture, issue triage process, and a public changelog/roadmap.
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

| Phase | Depends on | Unlocks |
|---|---|---|
| 0 — Foundation | Existing prototype + env | Reproducible builds, data strategy |
| 1 — Core Detection | Phase 0 | Scored criteria |
| 2 — Feedback Engine | Phase 1 | Actionable coaching |
| 3 — Product Surface | Phases 1–2 | Real users, persistence, tracking |
| 4 — Intelligence Upgrade | Phase 3 + data | Better accuracy, teacher/student, reports |
| 5 — Scale & Polish | Phase 4 | Performance, a11y, monetization, community |

## Indicative Timeline
Sequential execution totals roughly **20–29 weeks** to end of Phase 4, with Phase 5 as
ongoing hardening thereafter. Phases are sequential by dependency, though documentation,
testing, and data collection run continuously across all phases.
