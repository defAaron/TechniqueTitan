"""Analyze routes: image, frame, video, landmarks."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ..deps import (
    get_coaching_config,
    get_scoring_config,
    get_static_detector,
    public_value_error_detail,
)
from ..schemas import AnalyzeResponse, ScoreLandmarksRequest, VideoAnalyzeResponse
from .. import service

router = APIRouter(prefix="/v1", tags=["analyze"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 40 * 1024 * 1024
# Multipart framing (boundaries, part headers, small form fields) sits outside
# the file bytes. The stream cap allows that overhead; the file itself is still
# rejected above MAX_*_BYTES.
UPLOAD_FRAMING_SLACK = 64 * 1024
_READ_CHUNK = 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/octet-stream"}
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/avi",
    "application/octet-stream",
}


def too_large_detail(limit: int, kind: str) -> str:
    mb = limit // (1024 * 1024)
    return f"{kind} too large (max {mb} MB)"


def upload_body_limit(path: str) -> tuple[int, str] | None:
    """Return the file-byte cap and 413 label for an upload route."""
    if not isinstance(path, str):
        return None
    normalized = path.rstrip("/") or "/"
    if normalized in {"/v1/analyze/image", "/v1/analyze/frame"}:
        return MAX_IMAGE_BYTES, "Image"
    if normalized == "/v1/analyze/video":
        return MAX_VIDEO_BYTES, "Video"
    return None


def _declared_content_length(headers: Headers) -> int | None:
    raw = headers.get("content-length")
    if raw is None:
        return None
    try:
        value = int(raw)
    except ValueError:
        return None
    if value < 0:
        return None
    return value


class UploadBodyLimitMiddleware:
    """Reject oversized upload bodies before the multipart parser buffers them.

    Content-Length is enforced before the body is read. Chunked requests, and
    requests whose declared length understates the body, stop once the byte
    count passes the file cap plus a small framing allowance.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return
        limited = upload_body_limit(scope.get("path", ""))
        if limited is None:
            await self.app(scope, receive, send)
            return
        limit, kind = limited
        max_body = limit + UPLOAD_FRAMING_SLACK
        detail = too_large_detail(limit, kind)
        declared = _declared_content_length(Headers(scope=scope))
        if declared is not None and declared > max_body:
            response = JSONResponse(status_code=413, content={"detail": detail})
            await response(scope, receive, send)
            return

        received = 0
        too_large = False
        started = False

        async def limited_receive() -> Message:
            nonlocal received, too_large
            if too_large:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_body:
                    too_large = True
                    return {"type": "http.disconnect"}
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            started = True
            await send(message)

        await self.app(scope, limited_receive, tracking_send)
        if too_large and not started:
            response = JSONResponse(status_code=413, content={"detail": detail})
            await response(scope, receive, send)


async def _read_limited(
    request: Request,
    file: UploadFile,
    limit: int,
    kind: str,
) -> bytes:
    """Read an upload in chunks and reject once the file exceeds ``limit``."""
    declared = _declared_content_length(request.headers)
    if declared is not None and declared > limit + UPLOAD_FRAMING_SLACK:
        raise HTTPException(status_code=413, detail=too_large_detail(limit, kind))
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            await file.close()
            raise HTTPException(status_code=413, detail=too_large_detail(limit, kind))
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/analyze/image", response_model=AnalyzeResponse)
async def analyze_image(
    request: Request,
    file: UploadFile = File(...),
    include_overlay: bool = Form(True),
) -> AnalyzeResponse:
    if file.content_type and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Expected JPEG or PNG image")
    data = await _read_limited(request, file, MAX_IMAGE_BYTES, "Image")
    try:
        image = service.decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=public_value_error_detail(exc, "Could not decode image bytes"),
        ) from exc

    return service.analyze_image_bgr(
        image,
        get_static_detector(),
        get_scoring_config(),
        get_coaching_config(),
        include_overlay=include_overlay,
    )


@router.post("/analyze/frame", response_model=AnalyzeResponse)
async def analyze_frame(
    request: Request,
    file: UploadFile = File(...),
    include_overlay: bool = Form(True),
) -> AnalyzeResponse:
    """Same contract as /analyze/image; intended for live/video sampled frames."""
    return await analyze_image(
        request=request, file=file, include_overlay=include_overlay
    )


@router.post("/analyze/video", response_model=VideoAnalyzeResponse)
async def analyze_video(
    request: Request,
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

    data = await _read_limited(request, file, MAX_VIDEO_BYTES, "Video")
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
        raise HTTPException(
            status_code=400,
            detail=public_value_error_detail(exc, "Could not open video file"),
        ) from exc


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
        raise HTTPException(
            status_code=400,
            detail=public_value_error_detail(exc, "Could not score landmarks"),
        ) from exc
