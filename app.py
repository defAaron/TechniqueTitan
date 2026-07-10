"""Technique Titan - simple posture review UI.

Run with:

    streamlit run app.py

Three modes (sidebar): analyze a photo, analyze a video, or open the live
camera. Each mode reuses the same detect -> features -> score pipeline as the
batch CLI and shows an annotated landmark overlay plus a five-criterion score
panel.
"""

from __future__ import annotations

import sys
import tempfile
from collections import defaultdict
from pathlib import Path

# Allow imports without `pip install -e .` (required on Streamlit Cloud).
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import cv2
import numpy as np
import streamlit as st

from technique_titan.analysis import analyze_hands, draw_all_overlays, severity_color
from technique_titan.detection import HandDetector
from technique_titan.scoring import load_config

CRITERION_LABELS = {
    "wrist_height": "Wrist height",
    "finger_curvature": "Finger curvature",
    "thumb_position": "Thumb position",
    "wrist_lateral": "Wrist lateral deviation",
    "hand_arch": "Overall hand arch",
}


@st.cache_resource
def get_config() -> dict:
    return load_config()


def render_scores(result, container=None, title=None) -> None:
    """Render the composite score plus a per-criterion breakdown panel."""
    target = container or st
    if title:
        target.markdown(f"#### {title}")
    composite = result.composite_score
    target.metric("Composite score", f"{composite:.0f} / 100" if composite is not None else "-")

    for key, label in CRITERION_LABELS.items():
        score = result.scores.get(key)
        sev = result.severities.get(key, "unknown")
        color = severity_color(sev, hex=True)
        badge = f"<span style='color:{color};font-weight:600'>{sev.upper()}</span>"

        if isinstance(score, (int, float)):
            target.markdown(f"**{label}** &nbsp; {badge} &nbsp; ({score:.0f}/100)",
                            unsafe_allow_html=True)
            target.progress(int(score))
        else:
            target.markdown(f"**{label}** &nbsp; {badge}", unsafe_allow_html=True)
            target.progress(0)


def bgr_to_rgb(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def hand_title(result) -> str:
    return f"{result.label} hand (confidence {result.hand.confidence:.0%})"


def render_hand_panels(results, container=None) -> None:
    """Render one score panel per hand, side by side."""
    target = container or st
    ordered = sorted(results, key=lambda r: r.label)
    columns = target.columns(len(ordered))
    for col, result in zip(columns, ordered):
        render_scores(result, container=col, title=hand_title(result))


def photo_mode(config: dict) -> None:
    st.subheader("Photo review")
    st.caption("Upload a single image of a hand on the keys.")
    upload = st.file_uploader("Choose an image", type=["png", "jpg", "jpeg"])
    if upload is None:
        return

    data = np.frombuffer(upload.getvalue(), np.uint8)
    image_bgr = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image_bgr is None:
        st.error("Could not read that image file.")
        return

    with HandDetector(static_image_mode=True) as detector:
        results = analyze_hands(image_bgr, detector, config)

    if not results:
        st.warning("No hand detected. Try a clearer, well-lit image with the hand fully visible.")
        st.image(bgr_to_rgb(image_bgr), caption="Uploaded image", use_container_width=True)
        return

    annotated = draw_all_overlays(image_bgr, results)
    labels = ", ".join(sorted(r.label for r in results))
    st.image(
        bgr_to_rgb(annotated),
        caption=f"Detected {len(results)} hand(s): {labels}",
        use_container_width=True,
    )
    render_hand_panels(results)


def video_mode(config: dict) -> None:
    st.subheader("Video review")
    st.caption("Upload a short clip; frames are analyzed to build a posture timeline.")
    upload = st.file_uploader("Choose a video", type=["mp4", "mov", "avi", "m4v"])
    stride = st.slider("Analyze every Nth frame", min_value=1, max_value=15, value=5,
                       help="Higher values are faster but coarser.")
    if upload is None:
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(upload.getvalue())
        tmp_path = tmp.name

    cap = cv2.VideoCapture(tmp_path)
    if not cap.isOpened():
        st.error("Could not open that video file.")
        return

    frame_placeholder = st.empty()
    progress = st.progress(0.0)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    composites: dict = defaultdict(list)
    severity_tally: dict = defaultdict(lambda: defaultdict(int))
    frame_idx = 0

    with HandDetector(static_image_mode=False) as detector:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % stride == 0:
                results = analyze_hands(frame, detector, config)
                if results:
                    frame = draw_all_overlays(frame, results)
                    for result in results:
                        if result.composite_score is not None:
                            composites[result.label].append(result.composite_score)
                        for key, sev in result.severities.items():
                            if sev in ("warning", "critical"):
                                severity_tally[result.label][CRITERION_LABELS.get(key, key)] += 1
                frame_placeholder.image(bgr_to_rgb(frame), use_container_width=True)
                if total_frames:
                    progress.progress(min(frame_idx / total_frames, 1.0))
            frame_idx += 1

    cap.release()
    progress.progress(1.0)

    if not composites:
        st.warning("No hands detected in the analyzed frames.")
        return

    st.markdown("### Session summary")
    for label in sorted(composites):
        series = composites[label]
        st.markdown(f"#### {label} hand")
        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Frames scored", len(series))
        col_b.metric("Average composite", f"{np.mean(series):.0f}")
        col_c.metric("Worst composite", f"{np.min(series):.0f}")
        issues = severity_tally.get(label)
        if issues:
            worst = max(issues, key=issues.get)
            st.info(f"Most frequent issue: **{worst}** ({issues[worst]} flagged frames)")

    st.markdown("#### Composite score over time")
    max_len = max(len(v) for v in composites.values())
    chart_data = {
        f"{label} hand": composites[label] + [None] * (max_len - len(composites[label]))
        for label in sorted(composites)
    }
    st.line_chart(chart_data)


def live_mode(config: dict) -> None:
    st.subheader("Live camera review")
    st.caption("Real-time posture feedback from your default camera.")

    if "live_running" not in st.session_state:
        st.session_state.live_running = False

    col_start, col_stop = st.columns(2)
    if col_start.button("Start camera", type="primary"):
        st.session_state.live_running = True
    if col_stop.button("Stop camera"):
        st.session_state.live_running = False

    if not st.session_state.live_running:
        st.write("Press **Start camera** to begin.")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        st.session_state.live_running = False
        st.error(
            "Camera not available. On macOS, go to System Settings > "
            "Privacy & Security > Camera and allow access for the terminal "
            "or app running Streamlit."
        )
        return

    frame_placeholder = st.empty()
    scores_placeholder = st.empty()

    with HandDetector(static_image_mode=False) as detector:
        while st.session_state.live_running:
            ok, frame = cap.read()
            if not ok:
                st.warning("Lost the camera feed.")
                break
            frame = cv2.flip(frame, 1)  # mirror for a natural selfie view
            results = analyze_hands(frame, detector, config)
            if results:
                frame = draw_all_overlays(frame, results)
            frame_placeholder.image(bgr_to_rgb(frame), use_container_width=True)
            if results:
                with scores_placeholder.container():
                    render_hand_panels(results)
            else:
                scores_placeholder.info("No hand detected in view.")

    cap.release()


def main() -> None:
    st.set_page_config(page_title="Technique Titan", layout="wide")
    st.title("Technique Titan")
    st.write("Piano hand posture review")

    config = get_config()
    mode = st.sidebar.radio(
        "Mode",
        ("Photo", "Video", "Live camera"),
        help="Choose how you want to submit a hand for review.",
    )

    if mode == "Photo":
        photo_mode(config)
    elif mode == "Video":
        video_mode(config)
    else:
        live_mode(config)


if __name__ == "__main__":
    main()
