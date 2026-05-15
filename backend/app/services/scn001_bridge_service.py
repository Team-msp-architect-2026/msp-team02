from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.before_review_job import BeforeReviewJob
from backend.app.models.bridge_run import BridgeRun
from backend.app.models.user import User
from backend.app.schemas.bridge import (
    ArtifactRef,
    BeforeHandoffDTO,
    BridgeRunResponse,
    CreateBridgeRunRequest,
    DetectedIssue,
    EvidenceItemSummary,
    OverallResult,
    Severity,
)


COMPLETED_BEFORE_JOB_STATUSES = {"completed", "succeeded"}
DEFAULT_SCENARIO_ID = "SCN-001"
PHASE4_SOURCE_SCENARIO = "before_review"


class BridgeServiceError(Exception):
    """Base class for SCN-001 bridge service failures."""


class BridgeRunNotFoundError(BridgeServiceError):
    """Requested bridge run does not exist."""


class BeforeReviewJobNotFoundError(BridgeServiceError):
    """Requested Before review job does not exist."""


class BeforeReviewJobForbiddenError(BridgeServiceError):
    """Before review job is not linked to the current internal user."""


class BeforeReviewJobNotReadyError(BridgeServiceError):
    """Before review job has not reached a terminal success state."""


class BeforeHandoffExtractionError(BridgeServiceError):
    """Before review result cannot produce a safe handoff DTO."""


def create_bridge_run_from_before_job(
    db: Session,
    *,
    current_user: User,
    payload: CreateBridgeRunRequest,
) -> BridgeRunResponse:
    job = db.get(BeforeReviewJob, payload.before_review_job_id)
    if job is None:
        raise BeforeReviewJobNotFoundError("before review job not found")

    _ensure_before_job_access(job, current_user)
    _ensure_before_job_visible(job)
    _ensure_before_job_completed(job)

    handoff = extract_before_handoff(job)
    after_query_seed = build_after_query_seed(handoff)
    after_query_seed_hash = hashlib.sha256(
        after_query_seed.encode("utf-8")
    ).hexdigest()
    bridge_run_id = uuid.uuid4().hex
    artifact_refs = [
        *handoff.artifact_refs,
        ArtifactRef(kind="bridge_run", ref=bridge_run_id),
    ]

    bridge_run = BridgeRun(
        bridge_run_id=bridge_run_id,
        user_id=current_user.id,
        before_review_job_id=job.job_id,
        scenario_id=handoff.scenario_id,
        source_scenario=PHASE4_SOURCE_SCENARIO,
        preset_id=None,
        user_visible_summary=_build_user_visible_summary(handoff),
        issue_categories=_issue_categories(handoff),
        risk_tags=handoff.risk_tags,
        detected_issues=[
            issue.model_dump(mode="json") for issue in handoff.detected_issues
        ],
        law_refs=handoff.law_refs,
        recommended_next_actions=handoff.recommended_next_actions,
        after_query_seed_hash=after_query_seed_hash,
        artifact_refs=[ref.model_dump(mode="json") for ref in artifact_refs],
    )
    db.add(bridge_run)
    db.commit()
    db.refresh(bridge_run)

    return _bridge_response_from_row(
        bridge_run,
        after_query_seed=after_query_seed,
    )


def get_bridge_run_for_user(
    db: Session,
    *,
    current_user: User,
    bridge_run_id: str,
) -> BridgeRunResponse:
    bridge_run = get_visible_bridge_run_row_for_user(
        db,
        current_user=current_user,
        bridge_run_id=bridge_run_id,
    )
    return _bridge_response_from_row(bridge_run, after_query_seed=None)


def get_visible_bridge_run_row_for_user(
    db: Session,
    *,
    current_user: User,
    bridge_run_id: str,
) -> BridgeRun:
    bridge_run = db.get(BridgeRun, bridge_run_id)
    if (
        bridge_run is None
        or bridge_run.user_id != current_user.id
        or bridge_run.user_hidden_at is not None
    ):
        raise BridgeRunNotFoundError("bridge run not found")

    if bridge_run.before_review_job_id is not None:
        source_job = db.get(BeforeReviewJob, bridge_run.before_review_job_id)
        if (
            source_job is None
            or source_job.user_id != current_user.id
            or source_job.user_hidden_at is not None
        ):
            raise BridgeRunNotFoundError("bridge run not found")

    return bridge_run


def extract_before_handoff(job: BeforeReviewJob) -> BeforeHandoffDTO:
    result = _as_dict(job.result)
    if result is None:
        raise BeforeHandoffExtractionError("before review job has no result")

    review_id = _safe_label(result.get("review_id"))
    if review_id is None:
        raise BeforeHandoffExtractionError("before review result is missing review_id")

    scenario_tags = _safe_label_list(result.get("scenario_tags"), max_items=12)
    overall_result = _normalize_overall_result(result.get("overall_result"))
    overall_severity = _normalize_severity(result.get("overall_severity"))
    detected_issues = _extract_detected_issues(result, overall_result)
    law_refs = _extract_law_refs(result, detected_issues)
    contract_summary = _build_contract_summary(
        result,
        overall_result=overall_result,
        overall_severity=overall_severity,
        detected_issues=detected_issues,
    )

    return BeforeHandoffDTO(
        before_review_job_id=job.job_id,
        review_id=review_id,
        scenario_id=DEFAULT_SCENARIO_ID,
        scenario_tags=scenario_tags,
        contract_summary=contract_summary,
        overall_result=overall_result,
        overall_severity=overall_severity,
        risk_tags=_extract_risk_tags(result, scenario_tags),
        detected_issues=detected_issues,
        law_refs=law_refs,
        recommended_next_actions=_extract_recommended_actions(result),
        evidence_items_summary=_extract_evidence_summaries(result),
        artifact_refs=[
            ArtifactRef(kind="before_review_job", ref=job.job_id),
            ArtifactRef(kind="before_review_result", ref=review_id),
        ],
        created_at=datetime.now(timezone.utc),
    )


def build_after_query_seed(handoff: BeforeHandoffDTO) -> str:
    lines = [
        "외국인 근로계약 Before 검토 결과를 바탕으로 권리와 대응 방안을 설명해 주세요.",
        f"검토 요약: {handoff.contract_summary}",
        f"전체 판정: {handoff.overall_result} / {handoff.overall_severity}",
    ]

    if handoff.risk_tags:
        lines.append(f"위험 태그: {', '.join(handoff.risk_tags[:6])}")
    if handoff.law_refs:
        lines.append(f"관련 법령 후보: {', '.join(handoff.law_refs[:6])}")
    if handoff.detected_issues:
        lines.append("주요 이슈:")
        for issue in handoff.detected_issues[:4]:
            law_suffix = f" ({issue.law_ref})" if issue.law_ref else ""
            lines.append(f"- {issue.title}: {issue.description}{law_suffix}")
    if handoff.recommended_next_actions:
        lines.append("우선 조치:")
        for action in handoff.recommended_next_actions[:3]:
            lines.append(f"- {action}")

    return _clip_text("\n".join(lines), max_chars=1000)


def _bridge_response_from_row(
    bridge_run: BridgeRun,
    *,
    after_query_seed: str | None,
) -> BridgeRunResponse:
    return BridgeRunResponse(
        bridge_run_id=bridge_run.bridge_run_id,
        before_review_job_id=bridge_run.before_review_job_id or "",
        scenario_id=bridge_run.scenario_id,
        source_scenario=bridge_run.source_scenario,
        preset_id=bridge_run.preset_id,
        user_visible_summary=bridge_run.user_visible_summary,
        issue_categories=bridge_run.issue_categories or [],
        risk_tags=bridge_run.risk_tags or [],
        detected_issues=bridge_run.detected_issues or [],
        law_refs=bridge_run.law_refs or [],
        recommended_next_actions=bridge_run.recommended_next_actions or [],
        after_query_seed=after_query_seed,
        after_query_seed_hash=bridge_run.after_query_seed_hash,
        artifact_refs=bridge_run.artifact_refs or [],
        created_at=bridge_run.created_at,
    )


def _ensure_before_job_access(job: BeforeReviewJob, current_user: User) -> None:
    if job.user_id != current_user.id:
        raise BeforeReviewJobForbiddenError(
            "before review job is not linked to current user"
        )


def _ensure_before_job_visible(job: BeforeReviewJob) -> None:
    if job.user_hidden_at is not None:
        raise BeforeReviewJobNotFoundError("before review job not found")


def _ensure_before_job_completed(job: BeforeReviewJob) -> None:
    if (job.status or "").lower() not in COMPLETED_BEFORE_JOB_STATUSES:
        raise BeforeReviewJobNotReadyError("before review job is not completed")


def _build_user_visible_summary(handoff: BeforeHandoffDTO) -> str:
    if handoff.detected_issues:
        issue_titles = ", ".join(issue.title for issue in handoff.detected_issues[:3])
        return _clip_text(f"{handoff.contract_summary} 주요 이슈: {issue_titles}", 1000)
    return handoff.contract_summary


def _issue_categories(handoff: BeforeHandoffDTO) -> list[str]:
    labels = [issue.title for issue in handoff.detected_issues]
    return _dedupe_labels(labels, max_items=8)


def _build_contract_summary(
    result: dict[str, Any],
    *,
    overall_result: OverallResult,
    overall_severity: Severity,
    detected_issues: list[DetectedIssue],
) -> str:
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

    if detected_issues:
        titles = ", ".join(issue.title for issue in detected_issues[:3])
        return f"Before 검토에서 {overall_result}/{overall_severity} 결과와 {titles} 이슈가 확인되었습니다."
    return f"Before 검토에서 {overall_result}/{overall_severity} 결과가 확인되었습니다."


def _extract_risk_tags(
    result: dict[str, Any],
    scenario_tags: list[str],
) -> list[str]:
    labels: list[str] = list(scenario_tags)

    risk_summary = _as_dict(result.get("risk_summary")) or {}
    for bucket, value in risk_summary.items():
        items = _as_list(value)
        if not items:
            continue
        labels.append(str(bucket))
        for item in items:
            item_dict = _as_dict(item) or {}
            labels.extend(
                str(item_dict.get(key))
                for key in ("issue_type", "risk_bucket")
                if item_dict.get(key)
            )

    explanation = _as_dict(result.get("user_explanation")) or {}
    for item in _as_list(explanation.get("important_points")):
        item_dict = _as_dict(item) or {}
        labels.extend(
            str(item_dict.get(key))
            for key in ("issue_type", "risk_bucket")
            if item_dict.get(key)
        )

    redacted_labels = [
        redacted
        for label in labels
        if (redacted := _redact_known_parties(label, result))
    ]
    return _dedupe_labels(redacted_labels, max_items=20)


def _extract_detected_issues(
    result: dict[str, Any],
    overall_result: OverallResult,
) -> list[DetectedIssue]:
    issues: list[DetectedIssue] = []
    seen: set[tuple[str, str | None]] = set()

    explanation = _as_dict(result.get("user_explanation")) or {}
    for item in _as_list(explanation.get("important_points")):
        _append_issue(issues, seen, item, result=result)

    risk_summary = _as_dict(result.get("risk_summary")) or {}
    for value in risk_summary.values():
        for item in _as_list(value):
            _append_issue(issues, seen, item, result=result)

    if not issues:
        rule_check = _as_dict(result.get("rule_check")) or {}
        for key, value in rule_check.items():
            item = _as_dict(value) or {}
            if item.get("status") == "PASS":
                continue
            _append_issue(
                issues,
                seen,
                {
                    "title": str(key),
                    "severity": item.get("severity"),
                    "law_ref": item.get("law_ref"),
                    "description": item.get("message"),
                },
                result=result,
            )

    if not issues and overall_result != "PASS":
        summary = _safe_text(result.get("summary"), max_chars=280)
        _append_issue(
            issues,
            seen,
            {
                "title": "계약 조건 추가 확인 필요",
                "severity": result.get("overall_severity"),
                "description": summary or "Before 검토 결과에 따라 추가 확인이 필요합니다.",
            },
            result=result,
        )

    return issues[:8]


def _append_issue(
    issues: list[DetectedIssue],
    seen: set[tuple[str, str | None]],
    item: Any,
    *,
    result: dict[str, Any],
) -> None:
    item_dict = _as_dict(item) or {}
    title = _safe_label(
        item_dict.get("title")
        or item_dict.get("issue_type")
        or item_dict.get("risk_bucket")
        or "계약 조건 확인 필요"
    )
    title = _redact_known_parties(title, result)
    if title is None:
        return

    law_ref = _normalize_law_ref(item_dict.get("law_ref"))
    key = (title, law_ref)
    if key in seen:
        return

    description = _safe_text(
        item_dict.get("description") or item_dict.get("comment") or title,
        max_chars=500,
    )
    if description is None:
        description = title
    description = _redact_known_parties(description, result) or title

    issues.append(
        DetectedIssue(
            title=title,
            severity=_normalize_severity(item_dict.get("severity")),
            law_ref=law_ref,
            description=description,
        )
    )
    seen.add(key)


def _extract_law_refs(
    result: dict[str, Any],
    detected_issues: list[DetectedIssue],
) -> list[str]:
    refs: list[str] = [
        issue.law_ref for issue in detected_issues if issue.law_ref is not None
    ]

    risk_summary = _as_dict(result.get("risk_summary")) or {}
    for value in risk_summary.values():
        for item in _as_list(value):
            item_dict = _as_dict(item) or {}
            if item_dict.get("law_ref"):
                refs.append(str(item_dict["law_ref"]))

    rule_check = _as_dict(result.get("rule_check")) or {}
    for value in rule_check.values():
        item = _as_dict(value) or {}
        if item.get("law_ref"):
            refs.append(str(item["law_ref"]))

    content_check = _as_dict(result.get("content_check")) or {}
    for value in content_check.values():
        item = _as_dict(value) or {}
        for issue in _as_list(item.get("issues")):
            issue_dict = _as_dict(issue) or {}
            if issue_dict.get("law_ref"):
                refs.append(str(issue_dict["law_ref"]))

    normalized = [_normalize_law_ref(ref) for ref in refs]
    return _dedupe_labels(
        [ref for ref in normalized if ref is not None],
        max_items=12,
    )


def _extract_recommended_actions(result: dict[str, Any]) -> list[str]:
    explanation = _as_dict(result.get("user_explanation")) or {}
    actions: list[str] = []
    for item in _as_list(explanation.get("recommended_actions")):
        text = _safe_text(item, max_chars=400)
        text = _redact_known_parties(text, result)
        if text:
            actions.append(text)
    if not actions:
        actions.append("계약서 원본과 실제 근무조건을 함께 확인하고 필요한 수정 사항을 서면으로 요청하세요.")
    return _dedupe_text(actions, max_items=5)


def _extract_evidence_summaries(result: dict[str, Any]) -> list[EvidenceItemSummary]:
    explanation = _as_dict(result.get("user_explanation")) or {}
    summaries: list[EvidenceItemSummary] = []
    for item in _as_list(explanation.get("evidence"))[:4]:
        item_dict = _as_dict(item) or {}
        title = _safe_label(item_dict.get("title"))
        title = _redact_known_parties(title, result)
        if title is None:
            continue
        summaries.append(
            EvidenceItemSummary(
                title=title,
                summary=(
                    f"Before 검토에서 '{title}' 관련 근거가 확인되었습니다. "
                    "원문 발췌는 bridge handoff에 포함하지 않았습니다."
                ),
            )
        )
    return summaries


def _normalize_overall_result(value: Any) -> OverallResult:
    if value in {"PASS", "WARNING", "VIOLATION"}:
        return value
    return "WARNING"


def _normalize_severity(value: Any) -> Severity:
    if value in {"NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        return value
    return "MEDIUM"


def _normalize_law_ref(value: Any) -> str | None:
    label = _safe_label(value, max_chars=120)
    if label is None:
        return None
    return label.split("\n", 1)[0].strip()


def _redact_known_parties(text: str | None, result: dict[str, Any]) -> str | None:
    """Best-effort exact-match redaction for known contract party names."""
    if not text:
        return text
    contract_info = _as_dict(result.get("contract_info")) or {}
    replacements = {
        "employee": "근로자",
        "employer": "사용자",
    }
    redacted = text
    for key, replacement in replacements.items():
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
    return _clip_text(text, max_chars=max_chars)


def _safe_label(value: Any, max_chars: int = 120) -> str | None:
    text = _safe_text(value, max_chars=max_chars)
    if text is None:
        return None
    if "://" in text:
        return None
    return text


def _safe_label_list(value: Any, *, max_items: int) -> list[str]:
    return _dedupe_labels([str(item) for item in _as_list(value)], max_items=max_items)


def _dedupe_labels(values: list[str], *, max_items: int) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for value in values:
        label = _safe_label(value)
        if label is None or label in seen:
            continue
        labels.append(label)
        seen.add(label)
        if len(labels) >= max_items:
            break
    return labels


def _dedupe_text(values: list[str], *, max_items: int) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _safe_text(value, max_chars=400)
        if text is None or text in seen:
            continue
        items.append(text)
        seen.add(text)
        if len(items) >= max_items:
            break
    return items


def _clip_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _as_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []
