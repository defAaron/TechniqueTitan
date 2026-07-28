"""Analyze routes: image, frame, video, landmarks."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..deps import get_coaching_config, get_scoring_config, get_static_detector
from ..schemas import AnalyzeResponse, ScoreLandmarksRequest, VideoAnalyzeResponse
from .. import service

router = APIRouter(prefix="/v1", tags=["analyze"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 40 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/octet-stream"}
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/avi",
    "application/octet-stream",
}


def _check_size(data: bytes, limit: int, kind: str) -> None:
    if len(data) > limit:
        mb = limit // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"{kind} too large (max {mb} MB)")


@router.post("/analyze/image", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
    include_overlay: bool = Form(True),
) -> AnalyzeResponse:
    if file.content_type and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Expected JPEG or PNG image")
    data = await file.read()
    _check_size(data, MAX_IMAGE_BYTES, "Image")
    try:
        image = service.decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return service.analyze_image_bgr(
        image,
        get_static_detector(),
        get_scoring_config(),
        get_coaching_config(),
        include_overlay=include_overlay,
    )


@router.post("/analyze/frame", response_model=AnalyzeResponse)
async def analyze_frame(
    file: UploadFile = File(...),
    include_overlay: bool = Form(True),
) -> AnalyzeResponse:
    """Same contract as /analyze/image; intended for live/video sampled frames."""
    return await analyze_image(file=file, include_overlay=include_overlay)


@router.post("/analyze/video", response_model=VideoAnalyzeResponse)
async def analyze_video(
    file: UploadFile = File(...),
    stride: int = Form(5),
    max_frames: int = Form(120),
) -> VideoAnalyzeResponse:
    if file.content_type and file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=415, detail="Expected MP4/MOV/AVI video upload"
        )
    if stride < 1 or stride > 30:
        raise HTTPException(status_code=400, detail="stride must be 1–30")
    if max_frames < 1 or max_frames > 300:
        raise HTTPException(status_code=400, detail="max_frames must be 1–300")

    data = await file.read()
    _check_size(data, MAX_VIDEO_BYTES, "Video")
    name = (file.filename or "clip.mp4").lower()
    suffix = ".mov" if name.endswith(".mov") else ".mp4"
    if name.endswith(".avi"):
        suffix = ".avi"

    try:
        return service.analyze_video_bytes(
            data,
            get_scoring_config(),
            get_coaching_config(),
            stride=stride,
            max_frames=max_frames,
            suffix=suffix,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/score/landmarks", response_model=AnalyzeResponse)
async def score_landmarks(body: ScoreLandmarksRequest) -> AnalyzeResponse:
    if not body.hands:
        raise HTTPException(status_code=400, detail="Provide at least one hand")
    if len(body.hands) > 2:
        raise HTTPException(status_code=400, detail="At most two hands supported")
    try:
        return service.score_landmark_hands(
            body.hands,
            get_scoring_config(),
            get_coaching_config(),
            include_overlay=body.include_overlay,
            image_width=body.image_width,
            image_height=body.image_height,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
