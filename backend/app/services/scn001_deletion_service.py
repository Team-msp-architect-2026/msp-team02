from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.before_review_job import BeforeReviewJob
from backend.app.models.bridge_run import BridgeRun
from backend.app.models.user import User


def hide_before_review_job_for_user(
    db: Session,
    *,
    current_user: User,
    before_review_job_id: str,
) -> None:
    job = db.get(BeforeReviewJob, before_review_job_id)
    if (
        job is None
        or job.user_id != current_user.id
        or job.user_hidden_at is not None
    ):
        return

    job.user_hidden_at = _utcnow()
    job.user_hidden_by_user_id = current_user.id
    db.commit()


def hide_bridge_run_for_user(
    db: Session,
    *,
    current_user: User,
    bridge_run_id: str,
) -> None:
    bridge_run = db.get(BridgeRun, bridge_run_id)
    if (
        bridge_run is None
        or bridge_run.user_id != current_user.id
        or bridge_run.user_hidden_at is not None
    ):
        return

    bridge_run.user_hidden_at = _utcnow()
    bridge_run.user_hidden_by_user_id = current_user.id
    db.commit()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
