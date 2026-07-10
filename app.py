"""Technique Titan - simple posture review UI.

Run with:

    streamlit run app.py

Three modes (sidebar): analyze a photo, analyze a video, or open the live
camera. Each mode reuses the same detect -> features -> score pipeline as the
batch CLI and shows an annotated landmark overlay plus a five-criterion score
panel.
"""

from __future__ import annotations

import tempfile
from collections import Counter

import cv2
import numpy as np
import streamlit as st

from technique_titan.analysis import analyze_frame, draw_overlay, severity_color
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


def render_scores(result, container=None) -> None:
    """Render the composite score plus a per-criterion breakdown panel."""
    target = container or st
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
        result = analyze_frame(image_bgr, detector, config)

    if result is None:
        st.warning("No hand detected. Try a clearer, well-lit image with the hand fully visible.")
        st.image(bgr_to_rgb(image_bgr), caption="Uploaded image", use_container_width=True)
        return

    annotated = draw_overlay(image_bgr, result.hand, result.composite_severity)
    col_img, col_scores = st.columns([3, 2])
    with col_img:
        st.image(
            bgr_to_rgb(annotated),
            caption=f"Detected {result.hand.handedness} hand "
            f"(confidence {result.hand.confidence:.0%})",
            use_container_width=True,
        )
    with col_scores:
        render_scores(result)


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

    composites: list = []
    severity_tally: Counter = Counter()
    frame_idx = 0

    with HandDetector(static_image_mode=False) as detector:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % stride == 0:
                result = analyze_frame(frame, detector, config)
                if result is not None:
                    frame = draw_overlay(frame, result.hand, result.composite_severity)
                    if result.composite_score is not None:
                        composites.append(result.composite_score)
                    for key, sev in result.severities.items():
                        if sev in ("warning", "critical"):
                            severity_tally[CRITERION_LABELS.get(key, key)] += 1
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
    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Frames scored", len(composites))
    col_b.metric("Average composite", f"{np.mean(composites):.0f}")
    col_c.metric("Worst composite", f"{np.min(composites):.0f}")

    if severity_tally:
        worst = severity_tally.most_common(1)[0][0]
        st.info(f"Most frequent issue: **{worst}** "
                f"({severity_tally[worst]} flagged frames)")

    st.markdown("#### Composite score over time")
    st.line_chart({"composite": composites})


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
            result = analyze_frame(frame, detector, config)
            if result is not None:
                frame = draw_overlay(frame, result.hand, result.composite_severity)
            frame_placeholder.image(bgr_to_rgb(frame), use_container_width=True)
            if result is not None:
                with scores_placeholder.container():
                    render_scores(result)
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
