# Progress

Turns a burst of scored frames into one row the browser can store. This package does not talk to Supabase. The API exposes `POST /v1/progress/reduce`; the signed-in client inserts the draft. Photos, video bytes, and landmarks are not part of the draft.

## Why the draft is small

Supabase’s free tier is a 500 MB database and pauses when idle. A live camera can emit several scores a second. Storing every tick would fill the quota with duplicate posture. The reducer keeps a shape of the take:

| Constant | Value | Meaning |
|---|---|---|
| `FLICKER_MS` | 300 | Changes shorter than this are dropped |
| `HEARTBEAT_MS` | 1000 | A sample is kept at least this often while the hand is present |
| `MAX_SAMPLES_PER_HAND` | 120 | Cap after decimation |
| `MAX_SAMPLES_JSON_BYTES` | 32 KiB | `enforce_samples_size` rejects a larger `samples` blob |

`ScoreSmoother` from `coach/temporal.py` runs over the ticks before samples are chosen, so the stored curve is the same dwell-gated series the UI was willing to speak.

## What a draft contains

`build_session_draft` returns a `SessionDraft`:

- source (`photo`, `video`, or `live`), duration, frames seen
- per hand: mean composite, mean score per criterion, fraction of ticks in warning and critical, primary issue, and the tip problem/fix captured for that issue
- `samples`: downsampled `{t_ms, hand, confidence, composite, scores, severities}`

Hands under `outliers.min_confidence` (default 0.6) fail `passes_quality_gate` and are omitted. If every hand fails, the API returns 400 and tells the player to fix lighting and keep the hand in frame.

`draft_from_analyze_hands` and `draft_from_video_frames` adapt photo results and the video frame list. Video analysis builds a draft inside `api/service.py` so the client can offer “Add to progress” without a second reduce call. Live sends its own tick list to `/v1/progress/reduce`.

## Caps enforced again in Postgres

The migration adds a 32 KB check, clears `samples` on older rows beyond the 20 most recent sessions, and refuses a 401st session per user. Those rules are in [`supabase/README.md`](../../../../supabase/README.md). The Python reducer is the first gate; the trigger is the second.

## Tests

`tests/engine/test_progress.py`.
