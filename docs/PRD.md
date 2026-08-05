# Technique Titan — Product Requirements Document (PRD)

**Status:** Draft v1.1
**Owner:** Product / Engineering Lead
**Last updated:** 2026-08-05

---

## 1. Project Overview

### 1.1 Summary
Technique Titan is an AI-powered tool that evaluates piano hand posture from images and
video. It detects the player's hand(s), measures five posture criteria, scores each one,
and returns actionable, plain-language feedback so that students can self-correct between
lessons and teachers can review technique remotely.

The five evaluation criteria are:

1. **Wrist height** — vertical position of the wrist relative to the knuckles/keys (neither collapsed below nor lifted above a neutral line).
2. **Finger curvature** — whether fingers are naturally curved ("holding a bubble") rather than flat or over-clenched.
3. **Thumb position** — thumb resting on its side near the key surface, not tucked under or sticking up/out.
4. **Wrist lateral deviation** — sideways (ulnar/radial) bending of the wrist away from a straight forearm-to-hand line.
5. **Overall hand arch** — the dome formed by the knuckle bridge; a healthy arch versus a flat or collapsed hand.

### 1.2 Problem Statement
Good piano technique depends heavily on hand posture. Poor posture (collapsed wrists, flat
fingers, tucked thumbs) slows progress and, over time, can cause strain or repetitive-stress
injury. Today, posture is corrected almost exclusively during in-person lessons:

- **Infrequent feedback.** Students practice far more hours than they spend with a teacher, so bad habits set in between lessons.
- **No objective measurement.** Posture quality is described qualitatively ("rounder fingers"), which is hard for beginners to internalize or track.
- **Limited access.** Self-taught learners and students of remote/online teachers often get no posture feedback at all.

Technique Titan closes this gap by providing **objective, repeatable, on-demand posture
evaluation** that works from a standard camera, without specialized hardware.

### 1.3 Current State of the Repository (factual baseline)
As of 2026-08-05 the repository contains:

| Area | Status |
|---|---|
| Core engine (`src/technique_titan/`) | Shipped — detect → normalize → features → score → coach |
| Scoring / coaching config | Shipped — `config/scoring.yaml`, `config/coaching.yaml` |
| Product API (`api/`) | Shipped — FastAPI analyze + landmark score endpoints, rate limits |
| Product UI (`web/`) | Shipped — React photo / video / live / about; marketing home |
| Streamlit (`app.py`) | Shipped as interim / research UI (local live OpenCV) |
| Batch CLI | Shipped — `technique_titan.batch.process_folder` |
| Tests + CI | Shipped — pytest fixtures; GitHub Actions (Python 3.11 + Node 22 web build) |
| Accounts / session persistence / progress charts | **Not shipped** (Phase 3 remainder) |
| Piano-specific ML model / teacher roles | **Not shipped** (Phase 4) |

Primary user-facing surface: **React + FastAPI**. Streamlit remains useful for local
research and an optional Community Cloud demo.

---

## 2. Target Users and Use Cases

### 2.1 Primary Personas

| Persona | Description | Primary Goal |
|---|---|---|
| **Beginner student (self-taught)** | Adult or teen learning piano via apps/YouTube with no teacher to correct posture. | Get immediate, understandable feedback while practicing. |
| **Student of a teacher** | Takes regular lessons (in-person or online); practices independently between sessions. | Reinforce the teacher's corrections during solo practice; track improvement. |
| **Piano teacher** | Teaches multiple students, increasingly online. | Review students' posture asynchronously; assign and monitor corrections. |
| **Parent** | Oversees a young child's practice. | Confirm the child is practicing with healthy posture. |

### 2.2 Key Use Cases

- **UC-1 — Quick posture check (static image).** A student uploads or captures a single photo of their hand on the keys and receives a per-criterion score and feedback within seconds. **Shipped** (React `/photo`, Streamlit Photo, `POST /v1/analyze/image`).
- **UC-2 — Live practice mode (real-time).** A student turns on their camera and receives continuous feedback (visual overlays + summary) while playing. **Shipped** (React `/live` browser MediaPipe; local Streamlit OpenCV). Score update rate is throttled for API load (~2–4 Hz), not full video FPS.
- **UC-3 — Video review.** A student records a short practice clip; the tool analyzes it frame-by-frame and produces a timeline of posture quality. **Shipped** (React `/video` + Recharts timeline; Streamlit Video).
- **UC-4 — Progress tracking.** A returning user views their score trends per criterion over days/weeks. **Not shipped.**
- **UC-5 — Teacher review (later phase).** A teacher views a student's submitted sessions, leaves notes, and exports a report. **Not shipped.**

### 2.3 Out of Persona / Non-Goals for Users
- Professional concert pianists seeking biomechanical lab-grade analysis.
- Non-piano instruments (guitar, strings) — explicitly out of scope (see §6).

---

## 3. Functional Requirements

Requirements use the convention **MUST** (required for the release the requirement is tied
to), **SHOULD** (strongly desired), and **MAY** (optional/future). Each is tagged with an ID
for traceability against the roadmap.

### 3.1 Image / Video Input

- **FR-IN-1 (MUST):** The system MUST accept a single static image (JPEG/PNG) as input for posture analysis. ✅
- **FR-IN-2 (MUST):** The system MUST accept a live camera feed from the device camera. ✅ (browser and/or local OpenCV)
- **FR-IN-3 (SHOULD):** The system SHOULD accept a pre-recorded video file (MP4/MOV) for frame-by-frame analysis. ✅
- **FR-IN-4 (MUST):** The system MUST validate inputs (format, resolution, presence of at least one detectable hand) and return a clear, user-facing error when no hand is detected or the image is unusable. ✅ (API size/type checks + empty-hand responses)
- **FR-IN-5 (SHOULD):** The system SHOULD provide capture guidance (recommended camera angle, distance, and lighting) to maximize detection reliability. Partial — marketing/about copy; expand in-product.
- **FR-IN-6 (MAY):** The system MAY support analyzing both hands simultaneously and reporting per-hand results. ✅

### 3.2 Pose / Hand Detection

- **FR-PD-1 (MUST):** The system MUST extract the 21 standard hand landmarks per detected hand using MediaPipe Hands (or an equivalent landmark model), as implemented in `src/technique_titan/detection/hand_detector.py`. ✅
- **FR-PD-2 (MUST):** The system MUST determine hand laterality (left vs. right) to interpret thumb and lateral-deviation criteria correctly. ✅
- **FR-PD-3 (MUST):** The system MUST expose a confidence/quality signal per detection and suppress scoring when confidence is below a configurable threshold. Partial — confidence exposed; outlier flagging uses `min_confidence` in scoring config.
- **FR-PD-4 (SHOULD):** The system SHOULD normalize landmark coordinates (scale/translation invariant) so scoring is robust to camera distance and hand size. ✅
- **FR-PD-5 (SHOULD):** Detection logic SHOULD be encapsulated in a reusable, tested, importable module (`HandDetector`). ✅
- **FR-PD-6 (MAY):** The system MAY estimate camera/viewpoint angle and warn when the angle is unsuitable for a given criterion (e.g., wrist height needs a side view). Not shipped.

### 3.3 Per-Criterion Scoring

For each of the five criteria, the system computes a geometric feature from landmarks, maps
it to a normalized score, and assigns a severity band.

- **FR-SC-1 (MUST):** The system MUST produce a normalized score (e.g., 0–100) for each of the five criteria: wrist height, finger curvature, thumb position, wrist lateral deviation, and overall hand arch. ✅
- **FR-SC-2 (MUST):** The system MUST map each score to a severity band — **good**, **warning**, or **critical** — using documented, configurable thresholds. ✅
- **FR-SC-3 (MUST):** The system MUST produce a composite/overall posture score aggregating the five criteria, with documented weighting. ✅
- **FR-SC-4 (SHOULD):** Scoring thresholds SHOULD be externally configurable (config file) so they can be tuned without code changes and adapted to skill level (beginner vs. advanced tolerances). ✅ (`config/scoring.yaml`; skill-level profiles not yet)
- **FR-SC-5 (SHOULD):** The system SHOULD return the underlying geometric measurement alongside the score for transparency and debugging. ✅ (batch metrics JSON; API returns scores/severities + coaching)
- **FR-SC-6 (MUST):** Each criterion's scoring method MUST be documented with its landmark inputs and formula so results are explainable and auditable. ✅ ([SCORING_METHODS.md](./SCORING_METHODS.md))

> **Note on methodology:** Phase 1 uses **heuristic, landmark-geometry-based scoring** (joint
> angles, relative positions). A future phase MAY replace or augment heuristics with a model
> fine-tuned on piano-specific posture data (see Roadmap Phase 4). Heuristics MUST remain the
> documented fallback.

### 3.4 Feedback Generation

- **FR-FB-1 (MUST):** For every criterion not scored **good**, the system MUST generate a concise, plain-language critique describing what is wrong and how to fix it. ✅
- **FR-FB-2 (MUST):** Feedback MUST be tied to severity (good / warning / critical) and prioritized so the most important correction is surfaced first. ✅
- **FR-FB-3 (SHOULD):** Feedback SHOULD be encouraging and non-judgmental in tone, appropriate for beginners and children. ✅ (templated copy in `config/coaching.yaml`)
- **FR-FB-4 (SHOULD):** The system SHOULD provide a visual feedback overlay (annotated landmarks / highlighted problem area) in addition to text. ✅
- **FR-FB-5 (MAY):** The system MAY localize feedback into multiple languages. Not shipped.
- **FR-FB-6 (MAY):** The system MAY offer reference images/illustrations of correct posture for each criterion. Not shipped.

### 3.5 Progress Tracking

- **FR-PT-1 (SHOULD):** The system SHOULD persist analysis results (per-criterion scores, composite score, timestamp) per user/session. Not shipped.
- **FR-PT-2 (SHOULD):** The system SHOULD display score trends over time per criterion (charts). Not shipped (video timeline is per-session only).
- **FR-PT-3 (SHOULD):** The system SHOULD summarize a session (best/worst criterion, average composite score, most frequent issue). Partial — live/video surfaces rolling scores; no saved session summary.
- **FR-PT-4 (MAY):** The system MAY support user accounts and, later, teacher/student roles (see Roadmap Phase 4). Not shipped.
- **FR-PT-5 (MAY):** The system MAY export a session/progress report (PDF/CSV). Partial — batch CLI exports CSV/JSON; no user-facing session PDF.

---

## 4. Non-Functional Requirements

### 4.1 Performance / Latency
- **NFR-PERF-1:** Static image analysis MUST return results in **≤ 2 seconds** on a typical consumer laptop (no dedicated GPU).
- **NFR-PERF-2:** Real-time mode MUST sustain usable interactive feedback. Target: visual preview at camera rate; **score updates ≥ ~2–4 Hz** via throttled API calls (landmarks or frames). Full end-to-end landmark→score→overlay at ≥15 FPS remains a stretch goal for on-device scoring without per-frame API round-trips.
- **NFR-PERF-3:** Per-frame added latency from scoring + feedback (beyond landmark extraction) SHOULD be **≤ 30 ms** when scoring runs locally/in-process.

### 4.2 Accuracy
- **NFR-ACC-1:** Hand detection MUST achieve **≥ 95%** successful landmark extraction on in-spec inputs (adequate lighting, hand visible, recommended angle).
- **NFR-ACC-2:** Per-criterion severity classification SHOULD agree with expert (piano teacher) labels **≥ 85%** of the time on a curated validation set (see Roadmap Phase 1 DoD).
- **NFR-ACC-3:** The composite score SHOULD be **stable**: for a static, unchanging hand pose, repeated analyses MUST not vary by more than **±5 points** (out of 100).

### 4.3 Platform Support
- **NFR-PLAT-1:** The core engine MUST run on **Python 3.11** with MediaPipe `0.10.21`, OpenCV `4.10.x`, and NumPy `>=1.26,<2` (pinned for Streamlit Cloud / Docker / CI). `pyproject.toml` allows `>=3.9` but **3.11 is required in practice**.
- **NFR-PLAT-2:** The engine MUST run on **macOS** (current dev environment) and SHOULD run on **Windows and Linux**.
- **NFR-PLAT-3:** The product surface SHOULD be a web application accessible from modern desktop browsers (Chrome/Safari/Firefox/Edge), with mobile support as a later goal. ✅ (React SPA)
- **NFR-PLAT-4:** Camera access MUST handle OS permission flows gracefully. ✅ (Streamlit macOS messaging; browser permission prompts on React Live)

### 4.4 Accessibility
- **NFR-A11Y-1:** All text feedback MUST be screen-reader accessible; UI MUST meet **WCAG 2.1 AA** (contrast, focus order, keyboard navigation) for the web surface. In progress — severity text exists; full audit not done.
- **NFR-A11Y-2:** Feedback MUST not rely on color alone to convey severity (use text labels/icons in addition to color). Partial — score panels include severity labels.
- **NFR-A11Y-3:** The product SHOULD support reduced-motion and adjustable text size. Not verified.

### 4.5 Privacy & Security
- **NFR-SEC-1:** Camera frames and uploaded media MUST be processed with the minimum necessary retention; users MUST be informed if/where any media is stored. Current: API processes in-memory / request-scoped; no account storage.
- **NFR-SEC-2:** On-device/local processing SHOULD be the default for real-time analysis to minimize transmission of biometric/visual data. ✅ React Live landmarks mode posts landmarks, not video.
- **NFR-SEC-3:** Any stored user data MUST be access-controlled once accounts exist (Phase 4).

### 4.6 Maintainability & Quality
- **NFR-MAINT-1:** Scoring logic MUST be unit-tested against fixed landmark fixtures with known expected outcomes. ✅
- **NFR-MAINT-2:** The project MUST ship dependency manifests so the environment is reproducible. ✅ (`pyproject.toml`, `requirements*.txt`, `web/package-lock.json`)

---

## 5. Success Metrics

| Metric | Target |
|---|---|
| Landmark extraction success rate on in-spec inputs | ≥ 95% (NFR-ACC-1) |
| Severity classification agreement with expert labels | ≥ 85% (NFR-ACC-2) |
| Static image analysis latency | ≤ 2 s (NFR-PERF-1) |
| Live score update rate | ≥ ~2–4 Hz interactive feedback (NFR-PERF-2) |
| Score repeatability (static pose) | within ±5 / 100 (NFR-ACC-3) |
| User-perceived feedback usefulness | ≥ 80% rate feedback "helpful" in survey |
| Week-1 retention (returning to track progress) | ≥ 30% of new users return within 7 days |
| Measurable posture improvement | ≥ 50% of weekly-active users improve composite score ≥ 10 points over 4 weeks |

> Engagement/retention metrics become measurable only once persistence (Phase 3
> remainder) exists; accuracy and latency metrics are measurable from Phase 1 tooling.

---

## 6. Out of Scope

- Instruments other than piano/keyboard.
- Full-body or arm/shoulder posture analysis (the focus is the hand and wrist).
- Clinical/medical diagnosis or injury prevention claims (the tool gives technique guidance, **not** medical advice).
- Real-time multiplayer or live remote-lesson video conferencing.
- Automatic detection of musical correctness (notes, rhythm, dynamics) — Technique Titan evaluates **posture only**.
- Specialized hardware (depth cameras, gloves, sensors); the product targets standard RGB cameras.

---

## 7. Open Questions

| # | Question | Current decision / status |
|---|---|---|
| 1 | **Camera angle dependence.** Mandate angle, multi-angle, or infer? | Still open. Docs note side-view preference for wrist height; batch `outliers.csv` helps flag artifacts. |
| 2 | **Ground-truth labeling.** Who labels, how many samples? | Still open. `data/labels_template.csv` + batch merge exist; expert set not complete. |
| 3 | **Per-criterion thresholds.** Vary by skill/age/hand size? | Defaults in `scoring.yaml`; skill-level profiles deferred. |
| 4 | **Local vs. cloud processing.** | Live prefers on-device landmarks; photo/video upload to API. No media retention yet. |
| 5 | **Two-hand handling.** | **Resolved for v1:** simultaneous two-hand detection + per-hand scores. |
| 6 | **Feedback generation method.** Templates vs LLM? | **Resolved for v1:** YAML templates (`coaching.yaml`), not LLM. |
| 7 | **Definition of "neutral/correct" posture.** Which pedagogical school? | Still open; thresholds remain tunable. |
| 8 | **Monetization model.** | Still open (Phase 5). |

---

## 8. Appendix — Traceability Notes

- Landmark extraction: MediaPipe Hands + OpenCV in `src/technique_titan/detection/hand_detector.py`.
- Product surfaces: React (`web/`) + FastAPI (`api/`); Streamlit interim (`app.py`).
- Live browser path: `@mediapipe/tasks-vision` → `POST /v1/score/landmarks`.
- Deploy: Railway (API Docker), Vercel (web), optional Streamlit Community Cloud — see [DEPLOY.md](./DEPLOY.md).
