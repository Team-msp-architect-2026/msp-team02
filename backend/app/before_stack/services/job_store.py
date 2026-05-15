from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.app.db import SessionLocal
from backend.app.models import BeforeReviewJob


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_job_row(job: BeforeReviewJob) -> dict[str, Any]:
    return {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
        "run_directory": job.run_directory,
        "steps": job.steps,
        "error": job.error,
        "result": job.result,
    }


def create_job_record(
    *,
    job_id: str,
    status: str,
    steps: list[dict[str, Any]],
    user_id: str | None = None,
    run_directory: str | None = None,
    error: str | None = None,
    result: dict[str, Any] | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    if db is not None:
        return _create_job_record_in_session(
            db,
            job_id=job_id,
            status=status,
            steps=steps,
            user_id=user_id,
            run_directory=run_directory,
            error=error,
            result=result,
        )

    with SessionLocal() as session:
        return _create_job_record_in_session(
            session,
            job_id=job_id,
            status=status,
            steps=steps,
            user_id=user_id,
            run_directory=run_directory,
            error=error,
            result=result,
        )


def _create_job_record_in_session(
    session: Session,
    *,
    job_id: str,
    status: str,
    steps: list[dict[str, Any]],
    user_id: str | None,
    run_directory: str | None,
    error: str | None,
    result: dict[str, Any] | None,
) -> dict[str, Any]:
    job = BeforeReviewJob(
        job_id=job_id,
        user_id=user_id,
        status=status,
        run_directory=run_directory,
        steps=steps,
        error=error,
        result=result,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return serialize_job_row(job)


def get_job_record(job_id: str) -> dict[str, Any] | None:
    with SessionLocal() as session:
        job = session.get(BeforeReviewJob, job_id)
        if job is None:
            return None
        return serialize_job_row(job)


def count_job_records() -> int:
    with SessionLocal() as session:
        return session.query(BeforeReviewJob).count()


def update_job_record(
    job_id: str,
    *,
    status: str | None = None,
    active_step_key: str | None = None,
    active_step_status: str | None = None,
    active_step_message: str | None = None,
    error: str | None = None,
    result: dict[str, Any] | None = None,
    run_directory: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as session:
        job = session.get(BeforeReviewJob, job_id)
        if job is None:
            raise KeyError(f"before review job not found: {job_id}")

        if status is not None:
            job.status = status
        if error is not None:
            job.error = error
        if result is not None:
            job.result = result
        if run_directory is not None:
            job.run_directory = run_directory

        steps = [dict(step) for step in job.steps]
        if active_step_key:
            for step in steps:
                if step["key"] == active_step_key:
                    if active_step_status is not None:
                        step["status"] = active_step_status
                    if active_step_message is not None:
                        step["message"] = active_step_message
                elif active_step_status == "running" and step["status"] == "running":
                    step["status"] = "completed"
                    if step.get("message") is None:
                        step["message"] = "단계 완료"
            job.steps = steps

        job.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(job)
        return serialize_job_row(job)
