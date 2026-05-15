from __future__ import annotations

import logging

from fastapi import APIRouter

from backend.app.schemas.document_draft import (
    DocumentDraftRequest,
    DocumentDraftResponse,
)
from backend.app.services.after_artifact_store import persist_draft_artifacts
from backend.app.services.document_draft import build_document_draft

router = APIRouter(prefix="/api/v1/documents", tags=["document_draft"])
logger = logging.getLogger(__name__)


@router.post("/draft", response_model=DocumentDraftResponse)
def draft_document(payload: DocumentDraftRequest) -> DocumentDraftResponse:
    response = build_document_draft(payload)
    try:
        persist_draft_artifacts(payload, response)
    except Exception:
        logger.exception("document_draft.artifact_persist_failed")
    return response
