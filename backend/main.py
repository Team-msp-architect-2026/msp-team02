from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.before_stack.main import (
    app as before_app,
    _ensure_runtime_loaded as ensure_before_runtime_loaded,
)
from backend.app.routers import api_router

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mounted sub-app lifespan is not guaranteed to warm the cache before the first
    # external request, so preload the before runtime from the parent app startup.
    await ensure_before_runtime_loaded(before_app)
    yield

app = FastAPI(
    title="법대로(LawMainRoad) Retrieval API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=os.environ.get(
        "BACKEND_CORS_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1):(30[0-9]{2}|5090)",
    ),
    allow_credentials=False,
    allow_methods=["DELETE", "GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(api_router)
app.mount("/api/v1/before", before_app)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {
        "service": "retrieval",
        "status": "ok",
    }


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
