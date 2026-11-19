# Components

UI grouped by job. Pages compose these; scoring math is not reimplemented here.

## `layout/`

App chrome on every route.

| Piece | Role |
|---|---|
| `Layout.tsx` | Shell, outlet, providers’ children |
| `CinematicChrome.tsx` | Marketing-style frame used on the landing surface |
| `FloatingAppNav.tsx` | Mode links. Admin appears only when `is_admin()` is true for this session |
| `AuthControls.tsx` | Sign-in chip, avatar, links to profile and settings |
| `ApiStatusBanner.tsx` | Polls `/v1/health`. Render’s free tier can take 30–60 s to wake; the banner is that wait, not a scoring failure |
| `PageHeader` | Eyebrow + title used by settings and the analyze pages |

## `marketing/`

`CinematicHero.tsx` is the landing hero (stills and clips from `public/landing/`). Do not point it at `/hero-*` assets that are not in `public/`. Full-bleed sections cannot use `100vw` inside a clipped `max-w-*` parent; that combination scrolls sideways.

## `analyze/`

| Piece | Role |
|---|---|
| `ScorePanel.tsx` | Per-hand 0–100 scores, severity, composite |
| `CoachingTips.tsx` | Problem + fix for the current plan. Template text unless a validated model tip replaces it |
| `OverlayImage.tsx` | Annotated still returned for photo (and frame) analysis |
| `VideoLandmarkReplay.tsx` | Plays the user’s video in a `<video>` element and draws the skeleton for the frame nearest the playhead. The API sampled every 5th frame; the replay binary-searches `frame_index`. FPS falls back to 30 |

Colors follow severity: good, warning, critical. Both hands are labeled L/R.

## `coach/`

`CoachWordingToggle.tsx` is the Settings switch. It is mounted only when `VITE_COACH_MODEL_REPO` and `VITE_COACH_MODEL_REVISION` are both set. Turning it on starts the worker in [`../workers`](../workers/README.md). Turning it off, or any validator failure, leaves the YAML sentence in place.

## `progress/`

`AddToProgressButton.tsx` posts or inserts a draft. `ScoreDonutRing.tsx` is the dashboard ring, built on `ui/donut-chart.tsx`. The dashboard stylesheet is `pages/ProgressDashboard.css`.

## `auth/` `account/` `ui/`

`ProtectedRoute.tsx` is the sign-in (and optional admin) gate described in the [web README](../../README.md). `ProfileAvatar.tsx` renders the square JPEG from the `avatars` bucket. `ui/donut-chart.tsx` and `lib/cn.ts` are the shared visual primitives.
