from __future__ import annotations

import re
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, load_only

from backend.app.models.before_review_job import BeforeReviewJob
from backend.app.models.bridge_run import BridgeRun
from backend.app.models.user import User
from backend.app.schemas.bridge import OverallResult, Severity
from backend.app.schemas.scn001_history import (
    BeforeReviewJobHistoryDetail,
    BeforeReviewJobHistoryItem,
    BridgeRunHistoryItem,
)


VALID_OVERALL_RESULTS: set[OverallResult] = {"PASS", "WARNING", "VIOLATION"}
VALID_SEVERITIES: set[Severity] = {"NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"}


class Scn001HistoryError(Exception):
    """Base class for SCN-001 history service failures."""


class BeforeReviewJobHistoryNotFoundError(Scn001HistoryError):
    """Requested Before review job is missing or not owned by the current user."""


def list_before_review_jobs_for_user(
    db: Session,
    *,
    current_user: User,
    limit: int,
) -> list[BeforeReviewJobHistoryItem]:
    query = (
        select(BeforeReviewJob)
        .options(
            load_only(
                BeforeReviewJob.job_id,
                BeforeReviewJob.status,
                BeforeReviewJob.created_at,
                BeforeReviewJob.updated_at,
                BeforeReviewJob.result,
            )
        )
        .where(BeforeReviewJob.user_id == current_user.id)
        .where(BeforeReviewJob.user_hidden_at.is_(None))
        .order_by(
            BeforeReviewJob.updated_at.desc(),
            BeforeReviewJob.created_at.desc(),
            BeforeReviewJob.job_id.desc(),
        )
        .limit(limit)
    )
    jobs = list(db.execute(query).scalars().all())
    bridge_job_ids = _bridge_job_ids_for_jobs(
        db,
        current_user=current_user,
        before_review_job_ids=[job.job_id for job in jobs],
    )

    return [
        _before_job_history_from_row(
            job,
            has_bridge_run=job.job_id in bridge_job_ids,
        )
        for job in jobs
    ]


def get_before_review_job_history_for_user(
    db: Session,
    *,
    current_user: User,
    before_review_job_id: str,
) -> BeforeReviewJobHistoryDetail:
    query = (
        select(BeforeReviewJob)
        .options(
            load_only(
                BeforeReviewJob.job_id,
                BeforeReviewJob.user_id,
                BeforeReviewJob.status,
                BeforeReviewJob.created_at,
                BeforeReviewJob.updated_at,
                BeforeReviewJob.result,
            )
        )
        .where(
            BeforeReviewJob.job_id == before_review_job_id,
            BeforeReviewJob.user_hidden_at.is_(None),
        )
    )
    job = db.execute(query).scalar_one_or_none()
    if job is None or job.user_id != current_user.id:
        raise BeforeReviewJobHistoryNotFoundError("before review job not found")

    return BeforeReviewJobHistoryDetail(
        **_before_job_history_from_row(
            job,
            has_bridge_run=_has_bridge_run_for_job(
                db,
                current_user=current_user,
                before_review_job_id=job.job_id,
            ),
        ).model_dump()
    )


def list_bridge_runs_for_user(
    db: Session,
    *,
    current_user: User,
    limit: int,
) -> list[BridgeRunHistoryItem]:
    query = (
        select(BridgeRun)
        .options(
            load_only(
                BridgeRun.bridge_run_id,
                BridgeRun.before_review_job_id,
                BridgeRun.scenario_id,
                BridgeRun.source_scenario,
                BridgeRun.user_visible_summary,
                BridgeRun.issue_categories,
                BridgeRun.risk_tags,
                BridgeRun.law_refs,
                BridgeRun.recommended_next_actions,
                BridgeRun.created_at,
                BridgeRun.updated_at,
            )
        )
        .outerjoin(
            BeforeReviewJob,
            BridgeRun.before_review_job_id == BeforeReviewJob.job_id,
        )
        .where(BridgeRun.user_id == current_user.id)
        .where(BridgeRun.user_hidden_at.is_(None))
        .where(_source_before_job_is_visible_for_user(current_user))
        .order_by(
            BridgeRun.updated_at.desc(),
            BridgeRun.created_at.desc(),
            BridgeRun.bridge_run_id.desc(),
        )
        .limit(limit)
    )
    bridge_runs = db.execute(query).scalars().all()
    return [_bridge_history_from_row(bridge_run) for bridge_run in bridge_runs]


def _bridge_job_ids_for_jobs(
    db: Session,
    *,
    current_user: User,
    before_review_job_ids: list[str],
) -> set[str]:
    if not before_review_job_ids:
        return set()

    query = (
        select(BridgeRun.before_review_job_id)
        .where(
            BridgeRun.user_id == current_user.id,
            BridgeRun.before_review_job_id.in_(before_review_job_ids),
            BridgeRun.user_hidden_at.is_(None),
        )
        .distinct()
    )
    return {
        before_review_job_id
        for before_review_job_id in db.execute(query).scalars().all()
        if before_review_job_id is not None
    }


def _has_bridge_run_for_job(
    db: Session,
    *,
    current_user: User,
    before_review_job_id: str,
) -> bool:
    query = (
        select(BridgeRun.bridge_run_id)
        .where(
            BridgeRun.user_id == current_user.id,
            BridgeRun.before_review_job_id == before_review_job_id,
            BridgeRun.user_hidden_at.is_(None),
        )
        .limit(1)
    )
    return db.execute(query).first() is not None


def _source_before_job_is_visible_for_user(current_user: User):
    return or_(
        BridgeRun.before_review_job_id.is_(None),
        and_(
            BeforeReviewJob.job_id.is_not(None),
            BeforeReviewJob.user_id == current_user.id,
            BeforeReviewJob.user_hidden_at.is_(None),
        ),
    )


def _before_job_history_from_row(
    job: BeforeReviewJob,
    *,
    has_bridge_run: bool,
) -> BeforeReviewJobHistoryItem:
    result = _as_dict(job.result)
    return BeforeReviewJobHistoryItem(
        before_review_job_id=job.job_id,
        status=_safe_label(job.status) or "unknown",
        created_at=job.created_at,
        updated_at=job.updated_at,
        overall_result=_normalized_overall_result(result),
        overall_severity=_normalized_severity(result),
        summary=_before_summary(result),
        has_bridge_run=has_bridge_run,
    )


def _bridge_history_from_row(bridge_run: BridgeRun) -> BridgeRunHistoryItem:
    return BridgeRunHistoryItem(
        bridge_run_id=bridge_run.bridge_run_id,
        before_review_job_id=_safe_label(bridge_run.before_review_job_id),
        scenario_id=_safe_label(bridge_run.scenario_id) or "SCN-001",
        source_scenario=bridge_run.source_scenario,
        user_visible_summary=(
            _safe_text(bridge_run.user_visible_summary, max_chars=700)
            or "Bridge handoff summary is unavailable."
        ),
        issue_categories=_safe_label_list(
            bridge_run.issue_categories,
            max_items=8,
        ),
        risk_tags=_safe_label_list(bridge_run.risk_tags, max_items=12),
        law_refs=_safe_label_list(bridge_run.law_refs, max_items=12),
        recommended_next_actions=_safe_text_list(
            bridge_run.recommended_next_actions,
            max_items=5,
            max_chars=400,
        ),
        created_at=bridge_run.created_at,
        updated_at=bridge_run.updated_at,
    )


def _before_summary(result: dict[str, Any] | None) -> str | None:
    if result is None:
        return None

    explanation = _as_dict(result.get("user_explanation")) or {}
    for candidate in (
        result.get("summary"),
        explanation.get("headline"),
        explanation.get("plain_language_summary"),
    ):
        text = _safe_text(candidate, max_chars=700)
        text = _redact_known_parties(text, result)
        if text:
            return text
    return None


def _normalized_overall_result(
    result: dict[str, Any] | None,
) -> OverallResult | None:
    if result is None:
        return None
    value = result.get("overall_result")
    if value in VALID_OVERALL_RESULTS:
        return value
    return None


def _normalized_severity(result: dict[str, Any] | None) -> Severity | None:
    if result is None:
        return None
    value = result.get("overall_severity")
    if value in VALID_SEVERITIES:
        return value
    return None


def _redact_known_parties(text: str | None, result: dict[str, Any]) -> str | None:
    if not text:
        return text

    contract_info = _as_dict(result.get("contract_info")) or {}
    redacted = text
    for key, replacement in (
        ("employee", "근로자"),
        ("employer", "사용자"),
    ):
        value = _safe_text(contract_info.get(key), max_chars=80)
        if value and len(value) >= 2:
            redacted = redacted.replace(value, replacement)
    return redacted


def _safe_text(value: Any, *, max_chars: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = re.sub(r"\s+", " ", value).strip()
    if not text:
        return None
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _safe_label(value: Any, max_chars: int = 120) -> str | None:
    text = _safe_text(value, max_chars=max_chars)
    if text is None or "://" in text:
        return None
    return text


def _safe_label_list(value: Any, *, max_items: int) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for item in _as_list(value):
        label = _safe_label(item)
        if label is None or label in seen:
            continue
        labels.append(label)
        seen.add(label)
        if len(labels) >= max_items:
            break
    return labels


def _safe_text_list(
    value: Any,
    *,
    max_items: int,
    max_chars: int,
) -> list[str]:
    texts: list[str] = []
    seen: set[str] = set()
    for item in _as_list(value):
        text = _safe_text(item, max_chars=max_chars)
        if text is None or text in seen:
            continue
        texts.append(text)
        seen.add(text)
        if len(texts) >= max_items:
            break
    return texts


def _as_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []
