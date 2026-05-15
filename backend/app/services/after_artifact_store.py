from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.app.db import SessionLocal
from backend.app.models.after_artifact_run import AfterArtifactRun
from backend.app.schemas.answer import AnswerRequest, AnswerResponse
from backend.app.schemas.document_draft import (
    DocumentDraftRequest,
    DocumentDraftResponse,
)

BACKEND_DIR = Path(__file__).resolve().parents[2]
AFTER_ARTIFACT_RUNS_DIR = BACKEND_DIR / "data" / "after_artifacts" / "runs"


@dataclass(frozen=True)
class AfterArtifactLinkage:
    user_id: str | None = None
    source_bridge_run_id: str | None = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _query_hash(query: str | None) -> str | None:
    if not query:
        return None
    normalized = query.strip()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def _new_run_id() -> str:
    return uuid4().hex


def _new_run_dir(stage: str, run_id: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    run_dir = AFTER_ARTIFACT_RUNS_DIR / f"{timestamp}_{run_id[:8]}_{stage}"
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def _write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _jsonable_payload(payload: object) -> object:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(mode="json")
    if isinstance(payload, Mapping):
        return dict(payload)
    return payload


def _insert_run_row(
    *,
    run_id: str,
    user_id: str | None,
    source_bridge_run_id: str | None,
    stage: str,
    status: str,
    query_hash: str | None,
    document_type: str | None,
    artifact_root: str,
    error: str | None,
) -> None:
    with SessionLocal() as db:
        db.add(
            AfterArtifactRun(
                run_id=run_id,
                user_id=user_id,
                source_bridge_run_id=source_bridge_run_id,
                stage=stage,
                status=status,
                query_hash=query_hash,
                document_type=document_type,
                artifact_root=artifact_root,
                error=error,
            )
        )
        db.commit()


def persist_answer_artifacts(
    payload: AnswerRequest,
    response: AnswerResponse,
    *,
    linkage: AfterArtifactLinkage | None = None,
) -> str:
    AFTER_ARTIFACT_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = _new_run_id()
    run_dir = _new_run_dir("answer", run_id)
    resolved_linkage = linkage or AfterArtifactLinkage()

    try:
        _write_text(run_dir / "user_statement.txt", payload.query)
        _write_json(run_dir / "answer_request.json", payload.model_dump(mode="json"))
        _write_json(run_dir / "answer_response.json", _jsonable_payload(response))
        _insert_run_row(
            run_id=run_id,
            user_id=resolved_linkage.user_id,
            source_bridge_run_id=resolved_linkage.source_bridge_run_id,
            stage="answer",
            status="completed",
            query_hash=_query_hash(payload.query),
            document_type=None,
            artifact_root=str(run_dir),
            error=None,
        )
    except Exception as exc:
        _insert_run_row(
            run_id=run_id,
            user_id=resolved_linkage.user_id,
            source_bridge_run_id=resolved_linkage.source_bridge_run_id,
            stage="answer",
            status="failed",
            query_hash=_query_hash(payload.query),
            document_type=None,
            artifact_root=str(run_dir),
            error=str(exc),
        )
        raise

    return run_id


def persist_draft_artifacts(
    payload: DocumentDraftRequest,
    response: DocumentDraftResponse,
) -> str:
    AFTER_ARTIFACT_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = _new_run_id()
    run_dir = _new_run_dir("draft", run_id)
    answer_query = payload.legal_basis.answer_query
    document_type = payload.case_intake.document_type.value

    try:
        if answer_query:
            _write_text(run_dir / "user_statement.txt", answer_query)
        _write_json(run_dir / "draft_request.json", payload.model_dump(mode="json"))
        _write_json(
            run_dir / "case_intake.json",
            payload.case_intake.model_dump(mode="json"),
        )
        _write_json(
            run_dir / "legal_basis.json",
            payload.legal_basis.model_dump(mode="json"),
        )
        _write_json(
            run_dir / "draft_response.json",
            _jsonable_payload(response),
        )
        _insert_run_row(
            run_id=run_id,
            user_id=None,
            source_bridge_run_id=None,
            stage="draft",
            status="completed",
            query_hash=_query_hash(answer_query),
            document_type=document_type,
            artifact_root=str(run_dir),
            error=None,
        )
    except Exception as exc:
        _insert_run_row(
            run_id=run_id,
            user_id=None,
            source_bridge_run_id=None,
            stage="draft",
            status="failed",
            query_hash=_query_hash(answer_query),
            document_type=document_type,
            artifact_root=str(run_dir),
            error=str(exc),
        )
        raise

    return run_id
