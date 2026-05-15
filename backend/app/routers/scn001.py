from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.dependencies.auth import require_current_user
from backend.app.models.user import User
from backend.app.routers.answer import generate_answer_response
from backend.app.schemas.answer import AnswerRequest, AnswerResponse
from backend.app.schemas.bridge import CreateBridgeRunRequest, BridgeRunResponse
from backend.app.schemas.scn001_history import (
    BeforeReviewJobHistoryDetail,
    BeforeReviewJobHistoryItem,
    BridgeRunHistoryItem,
)
from backend.app.services.after_artifact_store import AfterArtifactLinkage
from backend.app.services.scn001_bridge_service import (
    BeforeHandoffExtractionError,
    BeforeReviewJobForbiddenError,
    BeforeReviewJobNotFoundError,
    BeforeReviewJobNotReadyError,
    BridgeRunNotFoundError,
    create_bridge_run_from_before_job,
    get_bridge_run_for_user,
    get_visible_bridge_run_row_for_user,
)
from backend.app.services.scn001_deletion_service import (
    hide_before_review_job_for_user,
    hide_bridge_run_for_user,
)
from backend.app.services.scn001_history_service import (
    BeforeReviewJobHistoryNotFoundError,
    get_before_review_job_history_for_user,
    list_before_review_jobs_for_user,
    list_bridge_runs_for_user,
)

router = APIRouter(prefix="/api/v1/scn001", tags=["scn001"])
HistoryLimit = Annotated[int, Query(ge=1, le=50)]


@router.get(
    "/before-review-jobs",
    response_model=list[BeforeReviewJobHistoryItem],
)
def list_before_review_jobs(
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: HistoryLimit = 20,
) -> list[BeforeReviewJobHistoryItem]:
    try:
        return list_before_review_jobs_for_user(
            db,
            current_user=current_user,
            limit=limit,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="before review job store is unavailable",
        ) from exc


@router.get(
    "/before-review-jobs/{before_review_job_id}",
    response_model=BeforeReviewJobHistoryDetail,
)
def read_before_review_job(
    before_review_job_id: str,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BeforeReviewJobHistoryDetail:
    try:
        return get_before_review_job_history_for_user(
            db,
            current_user=current_user,
            before_review_job_id=before_review_job_id,
        )
    except BeforeReviewJobHistoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="before review job not found",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="before review job store is unavailable",
        ) from exc


@router.delete(
    "/before-review-jobs/{before_review_job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_before_review_job(
    before_review_job_id: str,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        hide_before_review_job_for_user(
            db,
            current_user=current_user,
            before_review_job_id=before_review_job_id,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="before review job store is unavailable",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/bridge-runs",
    response_model=BridgeRunResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_bridge_run(
    payload: CreateBridgeRunRequest,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BridgeRunResponse:
    try:
        return create_bridge_run_from_before_job(
            db,
            current_user=current_user,
            payload=payload,
        )
    except BeforeReviewJobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="before review job not found",
        ) from exc
    except BeforeReviewJobForbiddenError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="before review job not found",
        ) from exc
    except BeforeReviewJobNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="before review job is not completed",
        ) from exc
    except BeforeHandoffExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc) or "before review result cannot be converted",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bridge run store is unavailable",
        ) from exc


@router.get(
    "/bridge-runs",
    response_model=list[BridgeRunHistoryItem],
)
def list_bridge_runs(
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: HistoryLimit = 20,
) -> list[BridgeRunHistoryItem]:
    try:
        return list_bridge_runs_for_user(
            db,
            current_user=current_user,
            limit=limit,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bridge run store is unavailable",
        ) from exc


@router.post(
    "/bridge-runs/{bridge_run_id}/answer",
    response_model=AnswerResponse,
)
def answer_from_bridge_run(
    bridge_run_id: str,
    payload: AnswerRequest,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnswerResponse:
    try:
        bridge_run = get_visible_bridge_run_row_for_user(
            db,
            current_user=current_user,
            bridge_run_id=bridge_run_id,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bridge run store is unavailable",
        ) from exc
    except BridgeRunNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bridge run not found",
        ) from exc

    return generate_answer_response(
        payload,
        linkage=AfterArtifactLinkage(
            user_id=current_user.id,
            source_bridge_run_id=bridge_run.bridge_run_id,
        ),
        fail_on_artifact_error=True,
    )


@router.delete(
    "/bridge-runs/{bridge_run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_bridge_run(
    bridge_run_id: str,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        hide_bridge_run_for_user(
            db,
            current_user=current_user,
            bridge_run_id=bridge_run_id,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bridge run store is unavailable",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/bridge-runs/{bridge_run_id}",
    response_model=BridgeRunResponse,
)
def read_bridge_run(
    bridge_run_id: str,
    current_user: Annotated[User, Depends(require_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BridgeRunResponse:
    try:
        return get_bridge_run_for_user(
            db,
            current_user=current_user,
            bridge_run_id=bridge_run_id,
        )
    except BridgeRunNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bridge run not found",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bridge run store is unavailable",
        ) from exc
