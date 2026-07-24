"""Technique Titan - simple posture review UI.

Run with:

    streamlit run app.py

Three modes (sidebar): analyze a photo, analyze a video, or open the live
camera. Live camera can run as a preview or record an annotated session with
per-hand average scores. Each mode reuses the same detect -> features -> score
pipeline as the batch CLI and shows an annotated landmark overlay, a
five-criterion score panel, and prioritized coaching tips from config/coaching.yaml.
"""

from __future__ import annotations

import sys
import tempfile
import shutil
from collections import defaultdict
from pathlib import Path
import platform
import os

# Allow imports without `pip install -e .` (required on Streamlit Cloud).
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import cv2
import numpy as np
import streamlit as st

from technique_titan.analysis import analyze_hands, draw_all_overlays, severity_color
from technique_titan.coaching import (
    annotate_with_coaching,
    generate_coaching,
    load_coaching_config,
    tip_for_label,
)
from technique_titan.detection import HandDetector
from technique_titan.scoring import load_config

CRITERION_LABELS = {
    "wrist_height": "Wrist height",
    "finger_curvature": "Finger curvature",
    "thumb_position": "Thumb position",
    "wrist_lateral": "Wrist lateral deviation",
    "hand_arch": "Overall hand arch",
}

# Shorter labels for the narrow live-feedback column.
CRITERION_LABELS_SHORT = {
    "wrist_height": "Wrist height",
    "finger_curvature": "Finger curve",
    "thumb_position": "Thumb",
    "wrist_lateral": "Wrist lateral",
    "hand_arch": "Hand arch",
}


@st.cache_resource
def get_config() -> dict:
    return load_config()


@st.cache_resource
def get_coaching_config() -> dict:
    return load_coaching_config()


def _inject_split_layout_css() -> None:
    """Camera stays in view; feedback column scrolls independently if needed."""
    st.markdown(
        """
        <style>
        /* Target the feedback column in the live/photo split layout. */
        div[data-testid="stHorizontalBlock"]:has(.tt-feedback-anchor)
          > div[data-testid="stColumn"]:last-child,
        div[data-testid="stHorizontalBlock"]:has(.tt-feedback-anchor)
          > div[data-testid="column"]:last-child {
            max-height: 78vh;
            overflow-y: auto;
            padding-left: 0.75rem;
            border-left: 1px solid rgba(49, 51, 63, 0.15);
        }
        .tt-score-row {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            margin: 0.2rem 0;
            font-size: 0.85rem;
            line-height: 1.2;
        }
        .tt-score-label { flex: 0 0 5.8rem; color: inherit; }
        .tt-score-badge { flex: 0 0 4.2rem; font-weight: 600; font-size: 0.75rem; }
        .tt-score-num { flex: 0 0 2.2rem; text-align: right; opacity: 0.85; }
        .tt-score-bar {
            flex: 1;
            height: 6px;
            border-radius: 3px;
            background: rgba(128, 128, 128, 0.25);
            overflow: hidden;
        }
        .tt-score-bar > span {
            display: block;
            height: 100%;
            border-radius: 3px;
        }
        .tt-composite {
            font-size: 1.35rem;
            font-weight: 700;
            margin: 0.15rem 0 0.45rem 0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_coaching(
    result,
    scoring_config: dict,
    coaching_config: dict,
    container=None,
    *,
    compact: bool = False,
) -> None:
    """Show prioritized coaching tips below the score breakdown."""
    target = container or st
    report = generate_coaching(
        result.scores,
        result.severities,
        result.criterion_metrics,
        scoring_config,
        coaching_config,
    )
    if report.encouragement:
        target.success(report.encouragement)
        return
    if not report.tips:
        return

    primary = report.primary
    labels = CRITERION_LABELS_SHORT if compact else CRITERION_LABELS
    label = labels.get(primary.criterion, primary.criterion)
    if compact:
        primary_text = f"**Focus: {label}** — {primary.problem} {primary.fix}"
    else:
        primary_text = f"**Focus first: {label}**\n\n{primary.problem}\n\n{primary.fix}"
    if primary.severity == "critical":
        target.error(primary_text)
    else:
        target.warning(primary_text)

    extras = report.tips[1:]
    if not extras:
        return
    lines = []
    for tip in extras:
        tip_label = labels.get(tip.criterion, tip.criterion)
        lines.append(f"- **{tip_label}** — {tip.problem} → {tip.fix}")
    if compact:
        with target.expander(f"More tips ({len(extras)})", expanded=False):
            st.markdown("\n".join(lines))
    else:
        target.markdown("\n".join(lines))


def _compact_score_rows_html(result) -> str:
    """One dense HTML block for all five criteria (saves vertical Streamlit widget chrome)."""
    parts = []
    for key, label in CRITERION_LABELS_SHORT.items():
        score = result.scores.get(key)
        sev = result.severities.get(key, "unknown")
        color = severity_color(sev, hex=True)
        pct = int(score) if isinstance(score, (int, float)) else 0
        num = f"{score:.0f}" if isinstance(score, (int, float)) else "—"
        parts.append(
            "<div class='tt-score-row'>"
            f"<span class='tt-score-label'>{label}</span>"
            f"<span class='tt-score-badge' style='color:{color}'>{sev.upper()}</span>"
            f"<span class='tt-score-num'>{num}</span>"
            f"<div class='tt-score-bar'><span style='width:{pct}%;background:{color}'></span></div>"
            "</div>"
        )
    return "".join(parts)


def render_scores(
    result,
    container=None,
    title=None,
    *,
    scoring_config: dict | None = None,
    coaching_config: dict | None = None,
    compact: bool = False,
) -> None:
    """Render the composite score plus a per-criterion breakdown panel."""
    target = container or st
    if title:
        if compact:
            target.markdown(f"**{title}**")
        else:
            target.markdown(f"#### {title}")
    composite = result.composite_score
    if compact:
        comp = f"{composite:.0f}" if composite is not None else "—"
        target.markdown(
            f"<div class='tt-composite'>{comp} <span style='font-size:0.85rem;"
            f"font-weight:500;opacity:0.7'>/ 100</span></div>",
            unsafe_allow_html=True,
        )
        target.markdown(_compact_score_rows_html(result), unsafe_allow_html=True)
    else:
        target.metric("Composite score", f"{composite:.0f} / 100" if composite is not None else "-")
        for key, label in CRITERION_LABELS.items():
            score = result.scores.get(key)
            sev = result.severities.get(key, "unknown")
            color = severity_color(sev, hex=True)
            badge = f"<span style='color:{color};font-weight:600'>{sev.upper()}</span>"

            if isinstance(score, (int, float)):
                target.markdown(
                    f"**{label}** &nbsp; {badge} &nbsp; ({score:.0f}/100)",
                    unsafe_allow_html=True,
                )
                target.progress(int(score))
            else:
                target.markdown(f"**{label}** &nbsp; {badge}", unsafe_allow_html=True)
                target.progress(0)

    if scoring_config is not None and coaching_config is not None:
        render_coaching(
            result,
            scoring_config,
            coaching_config,
            container=target,
            compact=compact,
        )


def bgr_to_rgb(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def _is_streamlit_cloud() -> bool:
    """Heuristic: hosted apps cannot access the server's (nonexistent) webcam."""
    host = os.environ.get("HOSTNAME", "") + os.environ.get("STREAMLIT_SERVER_ADDRESS", "")
    return "streamlit" in host.lower()


def _using_headless_opencv() -> bool:
    try:
        import importlib.metadata as meta
        meta.distribution("opencv-python-headless")
        try:
            meta.distribution("opencv-python")
            return False  # full build wins if both present
        except meta.PackageNotFoundError:
            return True
    except meta.PackageNotFoundError:
        return False


def open_camera():
    """Open the default webcam, using the macOS AVFoundation backend when available."""
    if platform.system() == "Darwin" and hasattr(cv2, "CAP_AVFOUNDATION"):
        cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)
        if cap.isOpened():
            return cap
        cap.release()
    cap = cv2.VideoCapture(0)
    return cap if cap.isOpened() else None


def camera_help_message() -> str:
    if _is_streamlit_cloud():
        return (
            "Live camera is not available on Streamlit Cloud (no webcam on the server). "
            "Use **Photo** or **Video** upload instead, or run locally with "
            "`streamlit run app.py`."
        )
    if _using_headless_opencv():
        return (
            "Live camera needs the full OpenCV build, not headless. "
            "Run: `pip uninstall opencv-python-headless -y && pip install opencv-python` "
            "then restart Streamlit."
        )
    if platform.system() == "Darwin":
        return (
            "Camera not available. On macOS, open **System Settings → Privacy & Security → "
            "Camera** and allow access for **Cursor**, **Terminal**, or whichever app "
            "launched Streamlit. Then restart the app."
        )
    return (
        "Camera not available. Check that a webcam is connected and not in use by "
        "another app, then try again."
    )


def hand_title(result, *, compact: bool = False) -> str:
    if compact:
        return f"{result.label} · {result.hand.confidence:.0%}"
    return f"{result.label} hand (confidence {result.hand.confidence:.0%})"


def render_hand_panels(
    results,
    container=None,
    *,
    scoring_config: dict | None = None,
    coaching_config: dict | None = None,
    compact: bool = False,
) -> None:
    """Render score panels per hand.

    Full mode places hands side by side. Compact mode stacks them so a narrow
    feedback column can show both hands without horizontal squeeze.
    """
    target = container or st
    ordered = sorted(results, key=lambda r: r.label)
    if compact:
        # Marker for CSS that makes this column independently scrollable.
        target.markdown("<div class='tt-feedback-anchor'></div>", unsafe_allow_html=True)
        for result in ordered:
            render_scores(
                result,
                container=target,
                title=hand_title(result, compact=True),
                scoring_config=scoring_config,
                coaching_config=coaching_config,
                compact=True,
            )
        return

    columns = target.columns(len(ordered))
    for col, result in zip(columns, ordered):
        render_scores(
            result,
            container=col,
            title=hand_title(result),
            scoring_config=scoring_config,
            coaching_config=coaching_config,
            compact=False,
        )


def accumulate_frame_scores(results, composites: dict, severity_tally: dict) -> None:
    """Append per-hand composite scores and warning/critical tallies from one frame."""
    for result in results:
        if result.composite_score is not None:
            composites[result.label].append(result.composite_score)
        for key, sev in result.severities.items():
            if sev in ("warning", "critical"):
                severity_tally[result.label][CRITERION_LABELS.get(key, key)] += 1


def render_session_summary(
    composites: dict,
    severity_tally: dict,
    *,
    heading: str = "Session summary",
    coaching_config: dict | None = None,
) -> None:
    """Show average / worst composites, top issues, and a score timeline chart."""
    if not composites:
        st.warning("No hands detected in the analyzed frames.")
        return

    st.markdown(f"### {heading}")
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
            if coaching_config is not None:
                tip = tip_for_label(coaching_config, worst, CRITERION_LABELS)
                if tip is not None:
                    st.caption(f"Tip: {tip.problem} {tip.fix}")

    st.markdown("#### Composite score over time")
    max_len = max(len(v) for v in composites.values())
    chart_data = {
        f"{label} hand": composites[label] + [None] * (max_len - len(composites[label]))
        for label in sorted(composites)
    }
    st.line_chart(chart_data)


def _empty_severity_tally() -> dict:
    return defaultdict(lambda: defaultdict(int))


def photo_mode(config: dict, coaching_config: dict) -> None:
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

    annotated = annotate_with_coaching(
        image_bgr, results, config, coaching_config, draw_all_overlays
    )
    labels = ", ".join(sorted(r.label for r in results))
    _inject_split_layout_css()
    cam_col, feed_col = st.columns([1.7, 1.0], gap="medium")
    with cam_col:
        st.image(
            bgr_to_rgb(annotated),
            caption=f"Detected {len(results)} hand(s): {labels}",
            use_container_width=True,
        )
    with feed_col:
        render_hand_panels(
            results,
            scoring_config=config,
            coaching_config=coaching_config,
            compact=True,
        )


def video_mode(config: dict, coaching_config: dict) -> None:
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
    severity_tally: dict = _empty_severity_tally()
    frame_idx = 0

    with HandDetector(static_image_mode=False) as detector:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % stride == 0:
                results = analyze_hands(frame, detector, config)
                if results:
                    frame = annotate_with_coaching(
                        frame, results, config, coaching_config, draw_all_overlays
                    )
                    accumulate_frame_scores(results, composites, severity_tally)
                frame_placeholder.image(bgr_to_rgb(frame), use_container_width=True)
                if total_frames:
                    progress.progress(min(frame_idx / total_frames, 1.0))
            frame_idx += 1

    cap.release()
    progress.progress(1.0)
    render_session_summary(composites, severity_tally, coaching_config=coaching_config)


def _init_live_session_state() -> None:
    defaults = {
        "live_running": False,
        "live_record_path": None,
        "live_composites": None,
        "live_severity_tally": None,
        "live_has_recording": False,
        "live_frame_dir": None,
        "live_frames_written": 0,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _clear_live_recording() -> None:
    path = st.session_state.get("live_record_path")
    if path and Path(path).exists():
        try:
            Path(path).unlink()
        except OSError:
            pass
    frame_dir = st.session_state.get("live_frame_dir")
    if frame_dir and Path(frame_dir).exists():
        try:
            shutil.rmtree(frame_dir)
        except OSError:
            pass
    st.session_state.live_record_path = None
    st.session_state.live_composites = None
    st.session_state.live_severity_tally = None
    st.session_state.live_has_recording = False
    st.session_state.live_frame_dir = None
    st.session_state.live_frames_written = 0


def _begin_live_recording() -> None:
    frame_dir = tempfile.mkdtemp(prefix="tt_live_frames_")
    st.session_state.live_frame_dir = frame_dir
    st.session_state.live_composites = {}
    st.session_state.live_severity_tally = {}
    st.session_state.live_frames_written = 0
    st.session_state.live_record_path = None
    st.session_state.live_has_recording = False


def _persist_live_recording_frame(frame_bgr: np.ndarray, results) -> None:
    """Save one annotated frame and append scores to session state."""
    composites = defaultdict(list, st.session_state.live_composites or {})
    severity_tally = _empty_severity_tally()
    if st.session_state.live_severity_tally:
        for label, counts in st.session_state.live_severity_tally.items():
            severity_tally[label] = defaultdict(int, counts)

    accumulate_frame_scores(results, composites, severity_tally)

    frame_dir = st.session_state.live_frame_dir
    if not frame_dir:
        return

    idx = st.session_state.live_frames_written
    cv2.imwrite(str(Path(frame_dir) / f"{idx:06d}.jpg"), frame_bgr)
    st.session_state.live_composites = {label: list(scores) for label, scores in composites.items()}
    st.session_state.live_severity_tally = {
        label: dict(counts) for label, counts in severity_tally.items()
    }
    st.session_state.live_frames_written = idx + 1


def _finalize_live_recording() -> bool:
    """Build the annotated video and mark the session ready for summary/download."""
    if st.session_state.live_has_recording:
        return True

    frame_dir = st.session_state.live_frame_dir
    if not frame_dir or st.session_state.live_frames_written == 0:
        return False

    frames = sorted(Path(frame_dir).glob("*.jpg"))
    if not frames:
        return False

    sample = cv2.imread(str(frames[0]))
    if sample is None:
        return False

    height, width = sample.shape[:2]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        out_path = tmp.name

    writer = _open_video_writer(sample, out_path)
    if writer is None:
        return False

    try:
        for frame_path in frames:
            frame = cv2.imread(str(frame_path))
            if frame is not None:
                writer.write(frame)
    finally:
        writer.release()

    if not Path(out_path).exists():
        return False

    st.session_state.live_record_path = out_path
    st.session_state.live_has_recording = True

    try:
        shutil.rmtree(frame_dir)
    except OSError:
        pass
    st.session_state.live_frame_dir = None
    return True


def _open_video_writer(frame: np.ndarray, path: str) -> cv2.VideoWriter | None:
    height, width = frame.shape[:2]
    fps = 20.0
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, fps, (width, height))
    return writer if writer.isOpened() else None


def live_mode(config: dict, coaching_config: dict) -> None:
    st.subheader("Live camera review")
    st.caption("Real-time posture feedback from your default camera.")

    if _is_streamlit_cloud():
        st.warning(
            "Live camera only works when you run the app **locally** "
            "(`streamlit run app.py`). On Streamlit Cloud, use Photo or Video upload."
        )
        return

    _init_live_session_state()

    session_type = st.radio(
        "Session type",
        ("Live preview", "Record session"),
        horizontal=True,
        help=(
            "Live preview shows real-time feedback only. "
            "Record session saves an annotated video and averages scores per hand."
        ),
    )
    recording = session_type == "Record session"

    col_start, col_stop = st.columns(2)
    if col_start.button("Start camera", type="primary"):
        if recording:
            _clear_live_recording()
            _begin_live_recording()
        st.session_state.live_running = True
    if col_stop.button("Stop camera"):
        st.session_state.live_running = False
        if recording:
            _finalize_live_recording()

    if st.session_state.live_has_recording and not st.session_state.live_running:
        composites = st.session_state.live_composites or {}
        severity_tally = st.session_state.live_severity_tally or {}
        if composites:
            render_session_summary(
                composites,
                severity_tally,
                heading="Recording summary",
                coaching_config=coaching_config,
            )
        else:
            st.markdown("### Recording summary")
            st.warning("No hands detected during the recording.")
        path = st.session_state.live_record_path
        if path and Path(path).exists():
            with open(path, "rb") as f:
                st.download_button(
                    "Download annotated video",
                    data=f.read(),
                    file_name="technique_titan_session.mp4",
                    mime="video/mp4",
                )
        if st.button("Clear recording"):
            _clear_live_recording()
            st.rerun()

    if not st.session_state.live_running:
        if not st.session_state.live_has_recording:
            if recording:
                st.write("Press **Start camera** to begin recording with landmarks.")
            else:
                st.write("Press **Start camera** to begin.")
        return

    if recording:
        st.error("Recording… Stop the camera when you are done.")
    else:
        st.info("Live preview running.")

    cap = open_camera()
    if cap is None:
        st.session_state.live_running = False
        st.error(camera_help_message())
        return

    # Split viewport: large camera left, compact coaching/scores right.
    # Feedback column scrolls on its own so the camera stays visible.
    _inject_split_layout_css()
    cam_col, feed_col = st.columns([1.7, 1.0], gap="medium")
    frame_placeholder = cam_col.empty()
    scores_placeholder = feed_col.empty()

    try:
        with HandDetector(static_image_mode=False) as detector:
            while st.session_state.live_running:
                ok, frame = cap.read()
                if not ok:
                    st.warning("Lost the camera feed.")
                    break
                frame = cv2.flip(frame, 1)  # mirror for a natural selfie view
                results = analyze_hands(frame, detector, config)
                if results:
                    frame = annotate_with_coaching(
                        frame, results, config, coaching_config, draw_all_overlays
                    )
                    if recording:
                        _persist_live_recording_frame(frame, results)
                elif recording:
                    frame_dir = st.session_state.live_frame_dir
                    if frame_dir:
                        idx = st.session_state.live_frames_written
                        cv2.imwrite(str(Path(frame_dir) / f"{idx:06d}.jpg"), frame)
                        st.session_state.live_frames_written = idx + 1

                frame_placeholder.image(bgr_to_rgb(frame), use_container_width=True)
                if results:
                    with scores_placeholder.container():
                        render_hand_panels(
                            results,
                            scoring_config=config,
                            coaching_config=coaching_config,
                            compact=True,
                        )
                else:
                    scores_placeholder.info("No hand detected in view.")
    finally:
        cap.release()
        if recording and not st.session_state.live_has_recording:
            if _finalize_live_recording():
                st.rerun()


def main() -> None:
    st.set_page_config(page_title="Technique Titan", layout="wide")
    st.title("Technique Titan")
    st.write("Piano hand posture review")

    config = get_config()
    coaching_config = get_coaching_config()
    mode = st.sidebar.radio(
        "Mode",
        ("Photo", "Video", "Live camera"),
        help="Choose how you want to submit a hand for review.",
    )

    if mode == "Photo":
        photo_mode(config, coaching_config)
    elif mode == "Video":
        video_mode(config, coaching_config)
    else:
        live_mode(config, coaching_config)


if __name__ == "__main__":
    main()
