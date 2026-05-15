from __future__ import annotations

from fastapi import APIRouter

from .answer import router as answer_router
from .auth import router as auth_router
from .document_draft import router as document_draft_router
from .retrieval import router as retrieval_router
from .scn001 import router as scn001_router

api_router = APIRouter()
api_router.include_router(retrieval_router)
api_router.include_router(auth_router)
api_router.include_router(scn001_router)
api_router.include_router(answer_router)
api_router.include_router(document_draft_router)

__all__ = ["api_router"]
