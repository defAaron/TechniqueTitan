# Scripts

Runnable demos and early prototypes. These are **not** part of the installable
package — run them directly from the project root:

```bash
python scripts/live_webcam_demo.py
```

| Script | Description |
|---|---|
| `live_webcam_demo.py` | Opens the default webcam, draws MediaPipe hand landmarks, prints coordinates, shows FPS. |
| `hand_detector_prototype.py` | Early `handDetector` class wrapping MediaPipe Hands (superseded by `src/technique_titan/detection/hand_detector.py`). |
