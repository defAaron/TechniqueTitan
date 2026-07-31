"""Technique Titan FastAPI application entrypoint."""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Allow `uvicorn api.main:app` from the repo root without editable install.
_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from api.deps import get_coaching_config, get_scoring_config, get_static_detector
from api.rate_limit import build_limiters_from_env, client_ip, limiter_bucket
from api.routes.analyze import router as analyze_router
from api.schemas import CRITERION_LABELS, PublicConfigResponse


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_scoring_config()
    get_coaching_config()
    get_static_detector()
    yield


app = FastAPI(
    title="Technique Titan API",
    version="0.1.0",
    description="Piano hand posture analysis: detect, score, and coach.",
    lifespan=lifespan,
)

_cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
).split(",")
_cors_origins = [o.strip() for o in _cors_origins if o.strip()]
_cors_wildcard = "*" in _cors_origins

app.add_middleware(
    CORSMiddleware,
    # Browsers forbid Access-Control-Allow-Origin: * with credentials.
    allow_origins=["*"] if _cors_wildcard else _cors_origins,
    allow_credentials=not _cors_wildcard,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_rate_limiters = build_limiters_from_env()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/v1/") and request.method == "POST":
        limiter = _rate_limiters[limiter_bucket(path)]
        try:
            limiter.check(client_ip(request))
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=dict(exc.headers) if exc.headers else None,
            )
    return await call_next(request)


@app.get("/v1/health")
def health() -> dict:
    return {"status": "ok", "service": "technique-titan-api"}


@app.get("/v1/config/public", response_model=PublicConfigResponse)
def public_config() -> PublicConfigResponse:
    return PublicConfigResponse(
        criterion_labels=CRITERION_LABELS,
        modes=["photo", "video", "live"],
    )


app.include_router(analyze_router)
