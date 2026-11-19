# Detection

Server-side hand landmarks. Live practice does not use this package; the browser runs MediaPipe Tasks and the API scores the points that come back. See [web/src/lib](../../../web/src/lib/README.md).

`hand_detector.py` wraps the legacy **`mp.solutions.hands`** API. That API disappeared in MediaPipe ≥ 0.10.35, so the project pins **`mediapipe==0.10.21`**. Do not upgrade the pin because a newer wheel exists.

## What one detection contains

`HandDetection`:

| Field | Meaning |
|---|---|
| `landmarks` | `(21, 3)` image coordinates. x and y are in `[0, 1]` of the frame. z is MediaPipe’s relative depth. |
| `world_landmarks` | `(21, 3)` in meters, origin at the hand center. Preferred for angles. `None` if that MediaPipe build omits them. |
| `handedness` | Anatomical `"Left"` or `"Right"` after the correction below. |
| `confidence` | Handedness classification score. Scoring treats low confidence as a quality flag (`outliers.min_confidence`, default 0.6). |

`max_hands` defaults to 2. `min_detection_confidence` defaults to 0.5. `static_image_mode=True` for photos and the batch CLI; video analysis uses `False` so MediaPipe can track across frames.

Input is BGR, as from `cv2.imread` / `VideoCapture`. The wrapper converts to RGB before `Hands.process`.

## Laterality

MediaPipe Hands is trained on mirrored selfie images. An unmirrored photo of the player’s right hand comes back as `"Left"`. Expert labels in Notion are anatomical.

`anatomical_handedness` swaps Left and Right. `HandDetector` does that when `invert_handedness=True` (the default). Callers that already mirrored the frame must pass `invert_handedness=False`. Streamlit’s live camera `cv2.flip`s the frame, so that path must not invert again. Batch, API photo, and API video images are unmirrored, so they keep the default.

A second, separate step lives in `analysis.resolve_labels`: if both detected hands still share one label, wrist x-position forces them apart. Detection does not do that.

## Tests

`tests/engine/test_detection.py`.
