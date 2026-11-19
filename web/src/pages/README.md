# Pages

One route component each. Wiring is `web/src/App.tsx`. Chrome (nav, auth chip, API-down banner) wraps every route in `components/layout`.

| Route | File | Gate | Behavior |
|---|---|---|---|
| `/` | `HomePage.tsx` | public | Cinematic landing: hero, the practice-without-a-teacher problem, the detect → score → coach pipeline, cards into the three modes. |
| `/photo` | `PhotoAnalyze.tsx` | signed in | JPEG/PNG upload → `POST /v1/analyze/image`. Overlay, per-hand scores, coaching, optional “Add to progress.” |
| `/video` | `VideoAnalyze.tsx` | signed in | MP4/MOV → `POST /v1/analyze/video`. Recharts timeline of composite score, plus `VideoLandmarkReplay` drawing the returned landmarks on the playing file. |
| `/live` | `LivePractice.tsx` | signed in | Camera. Prefers browser MediaPipe and `POST /v1/score/landmarks`. Falls back to JPEG `POST /v1/analyze/frame`. Holds the last good scores while the next response is in flight. Both hands stay on screen together. |
| `/progress` | `ProgressPage.tsx` | public shell | Loads `practice_sessions` for the signed-in user, syncs `coach_focus`, 30-day stats, donut, area chart, session detail. No user → empty list. |
| `/about` | `AboutPage.tsx` | public | Plain-language scoring overview. |
| `/login` `/signup` | `AuthPage.tsx` | public | Email/password or Google. `?next=` is passed through `safeNextPath` (a leading slash is not enough; backslashes and encoded `//` are rejected). |
| `/auth/callback` | `AuthCallbackPage.tsx` | public | PKCE return from Supabase. |
| `/profile` | `EditProfilePage.tsx` | signed in | Display name and square avatar upload to the public `avatars` bucket. |
| `/settings` | `SettingsPage.tsx` | signed in | Email, provider, password change for email identities, and the wording toggle when both coach-model env vars are set. |
| `/admin` | `AdminStatsPage.tsx` | admin | Signup counts from `admin_list_signups()`. |

Unknown paths redirect to `/`.

## Live details worth knowing

- The Tasks model is the float16 hand landmarker from Google storage; the WASM runtime comes from jsDelivr. GPU delegate first, then CPU.
- Landmark posts are compact JSON. The image is not uploaded in the fast path.
- Score smoothing runs in the page (`lib/scoreSmooth.ts`) before a coach plan is requested, so the sentence tracks the dwell-gated severity.
- That live plan posts `history: []` and `locked_focus: null`. The weekly lock is computed on `/progress`, not inside this page.
- The wording worker runs only when the Settings toggle is on and `plan_key` changes.

## Progress details worth knowing

“Add to progress” (`components/progress/AddToProgressButton.tsx`) shows up on photo, video, and live after a successful analyze. Video responses already include `progress_draft`. Live builds ticks and calls `POST /v1/progress/reduce`. The insert is `lib/progress.ts` under the user JWT. Nothing in these pages writes media into Supabase.
