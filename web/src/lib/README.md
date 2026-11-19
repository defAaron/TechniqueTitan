# Client library

Browser-side contracts. If a behavior exists in both Python and TypeScript, the Python module is authoritative for anything the server stores or returns, and this folder mirrors it for paint-time checks.

| File | Role |
|---|---|
| `api.ts` | `fetch` wrapper for `/v1/*`. Types for analyze responses, landmark posts, video frames, criterion labels. Base URL is `VITE_API_BASE_URL` or same-origin (the Vite proxy). |
| `mediapipe.ts` | Lazy `HandLandmarker`, `numHands: 2`, `runningMode: 'VIDEO'`. Model asset is the float16 hand landmarker; WASM is `@mediapipe/tasks-vision` 0.10.32 on jsDelivr. GPU delegate, then CPU. Also draws overlays (`drawHandOverlays`, `severityHex`) for live and for video replay. |
| `scoreSmooth.ts` | Port of `technique_titan.coach.temporal`. Default `alpha` 0.35, `dwellMs` 1200, bands 80 / 50. Cases in `tests/fixtures/temporal_cases.json` are shared with pytest. |
| `coachPlan.ts` | Client view of `CoachPlan` / `plan_key`. Asks `POST /v1/coach/plan` when history or the smoothed hand changes. Does not invent the criterion. |
| `coachFocus.ts` | Reads and upserts the one `coach_focus` row for `auth.uid()`. Burden JSON is the five numbers only. |
| `coachValidate.ts` | Port of `technique_titan.coach.validate`. Same allow-words, deny-words, length caps, direction guards. Cases: `tests/fixtures/coach_validator_cases.json`. |
| `coachModel.ts` | Opt-in store for the wording worker. Status: `off`, `unsupported` (no WebGPU), `loading`, `ready`, `failed`. Generation aborts at **2500 ms**. A tip that fails `validateTip` is discarded. |
| `coachModelProtocol.ts` | Message types shared with the worker. System prompt matches `data/coach/accepted.jsonl`. The model user message is only `{criterion, severity, direction, score, tip_kind}`. |
| `progress.ts` | List, get, insert, delete `practice_sessions` and `session_hands` with the user JWT. `last30DayStats` is computed in the client from those rows. |
| `auth.tsx` | Supabase session, Google and email, `is_admin()` via RPC. |
| `profile.tsx` / `profileModel.ts` | Display name. `avatarImage.ts` crops to a square JPEG before upload. |
| `supabase.ts` | Client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. `null` when either is missing, which is how CI builds. |
| `cn.ts` | Class name join. |

`safeNextPath` (in `auth.tsx`) refuses off-site redirects. A path has to stay on this origin; `/\\evil.com`, encoded double slashes, and backslashes do not count as local. A missing or rejected `next` lands on `/progress`.

Env for the optional model, both required or the toggle stays hidden:

```
VITE_COACH_MODEL_REPO=
VITE_COACH_MODEL_REVISION=
```

Those are a public Hugging Face repo id and a commit SHA, not secrets. Weights are not in this repository and not in the Vercel bundle.
