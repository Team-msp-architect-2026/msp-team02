"""
app.py — Phase B-5 (FastAPI 통합)
모든 Phase 를 통합해 REST API 로 노출한다.

실행:
    cd pipeline_before/
    GOOGLE_APPLICATION_CREDENTIALS=<path> GCP_PROJECT_ID=<id> \\
    uvicorn main:app --reload --port 8000

엔드포인트:
    POST /api/v1/contract/review  — 계약서 이미지 → 검토 결과 JSON
    GET  /health                  — 서버 상태 확인

의존성:
    pip install -r requirements.txt
"""

import asyncio
import json
import multiprocessing as mp
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

import yaml
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.dependencies.auth import get_optional_current_user
from backend.app.models.user import User
from backend.app.before_stack.core.settings import (
    BEFORE_LAW_SOURCE,
    LAW_CHUNKS_PATH,
    MIN_WAGE_YAML_PATH,
    STANDARD_MAP_PATH,
    TEST_RUNS_DIR,
    check_required_files,
)
from backend.app.before_stack.services.content_checker import (
    check_all_sections,
    summarize_content_results,
)
from backend.app.before_stack.services.accessibility_recommendation import (
    build_accessibility_recommendation,
)
from backend.app.before_stack.services.explanation_builder import build_user_explanation
from backend.app.before_stack.services.job_store import (
    count_job_records,
    create_job_record,
    get_job_record,
    update_job_record,
)
from backend.app.before_stack.services.law_chunk_cache import (
    load_all_chunks_from_db,
    load_all_chunks_from_file,
)
from backend.app.before_stack.services.law_retriever import build_extra_law_map
from backend.app.before_stack.services.llm_client import get_llm_client
from backend.app.before_stack.services.ocr_pipeline import (
    run_pipeline as _run_ocr_pipeline,
    run_pipeline_pages as _run_ocr_pipeline_pages,
)
from backend.app.before_stack.services.rule_validator import (
    parse_days_per_week,
    parse_wage_info,
    parse_working_hours,
    validate_all,
)
from backend.app.before_stack.services.section_comparator import (
    compare_sections,
    get_section_by_roles,
)


# ── OCR 오류 알려진 필드 목록 ──────────────────────────────────────────────────

OCR_KNOWN_ISSUES: list[dict] = [
    {
        "field":  "working_hours.daily_hours",
        "note":   "structured 값 신뢰 불가 — raw_sections 재계산 사용",
        "action": "rule_validator.parse_working_hours() 결과 사용",
    },
    {
        "field":  "working_hours.weekly_hours",
        "note":   "structured 값 신뢰 불가 — raw_sections 재계산 사용",
        "action": "rule_validator.calc_monthly_hours() 결과 사용",
    },
]


# ── 애플리케이션 lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 1회 로드. 매 요청마다 파일을 읽지 않는다."""
    await _ensure_runtime_loaded(app)
    yield
    # shutdown 정리 작업


app = FastAPI(
    title="근로계약서 법령 검토 API",
    version="0.2.0",
    description="계약서 이미지 → OCR → 누락·수치·내용 위반 자동 탐지",
    lifespan=lifespan,
)

BEFORE_ACCESSIBILITY_CATALOG: dict[str, dict[str, Any]] = {
    "visual": {
        "disability_type": "visual",
        "disability_label": "시각",
        "overview": "계약 내용을 음성, 점자, 확대 텍스트 등 접근 가능한 형식으로 다시 확인할 수 있는지가 중요합니다.",
        "cards": [
            {
                "id": "visual-1",
                "kind": "support",
                "title": "읽기 가능한 형식 요청",
                "description": "계약서를 텍스트 파일, 확대 문서, 스크린리더 호환 문서로 다시 요청할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제21조"],
                "action_hint": "원문 PDF만 받은 경우 텍스트본이나 확대본 제공 가능 여부를 먼저 요청하세요.",
            },
            {
                "id": "visual-2",
                "kind": "right",
                "title": "핵심 조항 음성 설명 요청",
                "description": "임금, 휴게시간, 해고 조항처럼 중요한 부분은 구두 또는 음성 방식으로 다시 설명받을 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "visual-3",
                "kind": "question",
                "title": "확인해야 할 질문",
                "description": "계약 내용을 스스로 확인 가능한 형식으로 받았는지, 추후 변경도 같은 방식으로 받을 수 있는지 점검하세요.",
                "law_refs": ["장애인차별금지법 제21조"],
            },
        ],
        "legal_basis": ["장애인차별금지법 제21조"],
    },
    "hearing": {
        "disability_type": "hearing",
        "disability_label": "청각",
        "overview": "구두 안내 대신 문자, 메신저, 이메일처럼 기록 가능한 방식으로 계약 설명을 요청하는 것이 중요합니다.",
        "cards": [
            {
                "id": "hearing-1",
                "kind": "right",
                "title": "서면 설명 요청",
                "description": "중요한 계약 설명과 변경 사항을 서면 또는 문자로 받도록 요청할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "hearing-2",
                "kind": "support",
                "title": "기록 가능한 연락 방식 확보",
                "description": "전화 안내보다 문자, 이메일, 메신저처럼 나중에 다시 볼 수 있는 안내 방식을 확보하는 것이 좋습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "hearing-3",
                "kind": "question",
                "title": "확인해야 할 질문",
                "description": "계약 변경, 출근 스케줄, 임금 안내가 모두 기록 가능한 방식으로 남는지 확인하세요.",
                "law_refs": ["근로기준법 제17조"],
            },
        ],
        "legal_basis": ["장애인차별금지법 제20조"],
    },
    "mobility": {
        "disability_type": "mobility",
        "disability_label": "지체",
        "overview": "근무 장소, 동선, 설비 접근성 같은 현실 조건을 계약 설명과 함께 검토해야 합니다.",
        "cards": [
            {
                "id": "mobility-1",
                "kind": "support",
                "title": "근무환경 조정 요청",
                "description": "업무 수행에 필요한 좌석, 동선, 설비 조정을 협의할 수 있습니다.",
                "law_refs": ["장애인고용촉진법 제5조의2"],
            },
            {
                "id": "mobility-2",
                "kind": "right",
                "title": "이동·접근 조건 사전 확인",
                "description": "출입구, 계단, 화장실, 작업대 높이처럼 실제 근무 지속에 필요한 조건을 계약 설명 단계에서 확인할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제4조"],
            },
            {
                "id": "mobility-3",
                "kind": "law",
                "title": "환경 조정 관련 근거",
                "description": "합리적 편의제공은 업무 수행 자체를 가능하게 하는 범위까지 포함될 수 있습니다.",
                "law_refs": ["장애인차별금지법 제11조"],
            },
        ],
        "legal_basis": ["장애인고용촉진법 제5조의2"],
    },
    "cognitive": {
        "disability_type": "cognitive",
        "disability_label": "인지",
        "overview": "복잡한 계약 문구는 쉬운 설명과 단계별 안내로 다시 확인하는 것이 좋습니다.",
        "cards": [
            {
                "id": "cognitive-1",
                "kind": "question",
                "title": "쉬운 설명 재요청",
                "description": "핵심 조항을 쉬운 문장으로 다시 설명해 달라고 요청할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "cognitive-2",
                "kind": "support",
                "title": "단계별 확인 방식 요청",
                "description": "한 번에 전체 계약을 설명받기보다 항목별로 나누어 설명받는 방식이 도움이 될 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "cognitive-3",
                "kind": "question",
                "title": "확인해야 할 질문",
                "description": "본인이 이해한 내용과 실제 계약 조항이 같은지, 중요한 조건을 다시 말해볼 수 있는지 확인하세요.",
                "law_refs": ["근로기준법 제17조"],
            },
        ],
        "legal_basis": ["장애인차별금지법 제20조"],
    },
    "mental": {
        "disability_type": "mental",
        "disability_label": "정신",
        "overview": "압박 상황에서 즉시 서명하지 않고 충분한 검토 시간을 확보하는 것이 중요합니다.",
        "cards": [
            {
                "id": "mental-1",
                "kind": "question",
                "title": "검토 시간 확보",
                "description": "즉시 서명 대신 검토 시간을 요청하고, 신뢰할 수 있는 사람과 함께 확인할 수 있습니다.",
                "law_refs": ["근로기준법 제17조"],
                "action_hint": "압박을 느끼는 상황이라면 즉시 동의 대신 검토 후 답변하겠다고 남겨 두는 것이 좋습니다.",
            },
            {
                "id": "mental-2",
                "kind": "support",
                "title": "동반 확인 요청",
                "description": "계약 확인 시 가족, 활동지원인, 조력자와 함께 내용을 확인하는 방식을 요청할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조"],
            },
            {
                "id": "mental-3",
                "kind": "law",
                "title": "중요 조항 재설명 근거",
                "description": "이해하기 어려운 설명 방식만으로 계약 내용을 확정하는 것은 분쟁 위험을 높일 수 있습니다.",
                "law_refs": ["근로기준법 제17조"],
            },
        ],
        "legal_basis": ["근로기준법 제17조"],
    },
    "complex": {
        "disability_type": "complex",
        "disability_label": "중복",
        "overview": "접근 가능한 형식, 설명 방식, 환경 조정을 함께 요청하는 복합 접근이 필요할 수 있습니다.",
        "cards": [
            {
                "id": "complex-1",
                "kind": "support",
                "title": "복합 지원 요청",
                "description": "읽기 형식, 설명 방식, 근무환경 조정을 함께 요청할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제20조", "장애인차별금지법 제21조"],
            },
            {
                "id": "complex-2",
                "kind": "right",
                "title": "지원 방식 병행 요청",
                "description": "문서 형식, 설명 전달, 근무환경 조정을 하나씩 분리하지 않고 함께 요청하는 방식이 더 적절할 수 있습니다.",
                "law_refs": ["장애인차별금지법 제11조"],
            },
            {
                "id": "complex-3",
                "kind": "question",
                "title": "확인해야 할 질문",
                "description": "현재 필요한 지원이 무엇인지 스스로 정리하기 어렵다면, 우선 불편한 지점을 사례로 설명하는 것부터 시작하세요.",
                "law_refs": ["장애인차별금지법 제20조", "장애인차별금지법 제21조"],
            },
        ],
        "legal_basis": ["장애인차별금지법 제20조", "장애인차별금지법 제21조"],
    },
}

TEST_RUNS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=TEST_RUNS_DIR), name="before-artifacts")


async def _ensure_runtime_loaded(app: FastAPI) -> None:
    """mounted sub-app 환경에서도 필요한 runtime state 를 지연 로드한다."""
    if getattr(app.state, "runtime_loaded", False):
        return

    check_required_files()
    app.state.standard_map = json.loads(STANDARD_MAP_PATH.read_text(encoding="utf-8"))
    app.state.min_wage = yaml.safe_load(MIN_WAGE_YAML_PATH.read_text(encoding="utf-8"))["minimum_wage"]
    if BEFORE_LAW_SOURCE == "db":
        app.state.all_chunks = load_all_chunks_from_db()
    else:
        app.state.all_chunks = load_all_chunks_from_file(LAW_CHUNKS_PATH)
    app.state.all_chunks_source = BEFORE_LAW_SOURCE
    app.state.runtime_loaded = True


def _get_llm_client(app: FastAPI):
    llm_client = getattr(app.state, "llm_client", None)
    if llm_client is None:
        llm_client = get_llm_client()
        app.state.llm_client = llm_client
    return llm_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


DEFAULT_BEFORE_OCR_TIMEOUT_SECONDS = 120.0
DEFAULT_REVIEW_JOB_STALE_TIMEOUT_SECONDS = 180.0
DEFAULT_BEFORE_OCR_TERMINATE_GRACE_SECONDS = 1.0
STALE_REVIEW_JOB_MESSAGE = (
    "OCR 응답 시간이 초과되어 분석을 중단했습니다. 잠시 후 다시 시도해주세요."
)


def _resolve_positive_float_env(name: str, default: float) -> float:
    raw_value = os.environ.get(name, "").strip()
    if not raw_value:
        return default

    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive number of seconds.") from exc

    if value <= 0:
        raise ValueError(f"{name} must be greater than 0.")
    return value


def _resolve_review_job_stale_timeout_seconds() -> float:
    return _resolve_positive_float_env(
        "BEFORE_REVIEW_JOB_STALE_TIMEOUT_SECONDS",
        DEFAULT_REVIEW_JOB_STALE_TIMEOUT_SECONDS,
    )


def _resolve_before_ocr_timeout_seconds() -> float:
    return _resolve_positive_float_env(
        "BEFORE_OCR_TIMEOUT_SECONDS",
        DEFAULT_BEFORE_OCR_TIMEOUT_SECONDS,
    )


def _get_process_context() -> mp.context.BaseContext:
    if "fork" in mp.get_all_start_methods():
        return mp.get_context("fork")
    return mp.get_context("spawn")


def _build_default_steps() -> list[dict[str, Any]]:
    return [
        {"key": "upload", "label": "업로드 파일 확인", "order": 1, "status": "pending", "message": None},
        {"key": "ocr", "label": "OCR 추출", "order": 2, "status": "pending", "message": None},
        {"key": "rules", "label": "계약 항목 비교와 수치 검증", "order": 3, "status": "pending", "message": None},
        {"key": "explanation", "label": "설명 생성", "order": 4, "status": "pending", "message": None},
        {"key": "finalize", "label": "결과 정리", "order": 5, "status": "pending", "message": None},
    ]


def _update_job(
    app: FastAPI,
    job_id: str,
    *,
    status: str | None = None,
    active_step_key: str | None = None,
    active_step_status: str | None = None,
    active_step_message: str | None = None,
    error: str | None = None,
    result: dict[str, Any] | None = None,
    run_directory: str | None = None,
) -> None:
    update_job_record(
        job_id,
        status=status,
        active_step_key=active_step_key,
        active_step_status=active_step_status,
        active_step_message=active_step_message,
        error=error,
        result=result,
        run_directory=run_directory,
    )


def _exception_message(error: Exception) -> str:
    if isinstance(error, HTTPException):
        detail = error.detail
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        if detail is not None:
            return str(detail)
    return str(error) or type(error).__name__


def _parse_job_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _mark_stale_review_job_failed(job: dict[str, Any]) -> dict[str, Any]:
    steps = job.get("steps") or []
    active_step = next(
        (step for step in steps if step.get("status") == "running"),
        None,
    )
    if active_step is None:
        active_step = next(
            (step for step in steps if step.get("status") == "pending"),
            None,
        )

    return update_job_record(
        job["job_id"],
        status="failed",
        active_step_key=active_step.get("key") if active_step else "ocr",
        active_step_status="failed",
        active_step_message=STALE_REVIEW_JOB_MESSAGE,
        error=STALE_REVIEW_JOB_MESSAGE,
    )


def _fail_stale_review_job_if_needed(job: dict[str, Any]) -> dict[str, Any]:
    if job.get("status") not in {"queued", "running"}:
        return job

    updated_at = _parse_job_datetime(job.get("updated_at"))
    if updated_at is None:
        return job

    stale_after = timedelta(seconds=_resolve_review_job_stale_timeout_seconds())
    if datetime.now(timezone.utc) - updated_at < stale_after:
        return job

    return _mark_stale_review_job_failed(job)


async def _execute_review_job(
    app: FastAPI,
    job_id: str,
    page_files: list[tuple[bytes, str, str]],
) -> None:
    try:
        _update_job(
            app,
            job_id,
            status="running",
            active_step_key="upload",
            active_step_status="completed",
            active_step_message="업로드 원본을 수집했습니다.",
        )
        _update_job(
            app,
            job_id,
            active_step_key="ocr",
            active_step_status="running",
            active_step_message="계약서 이미지를 읽고 텍스트를 추출하는 중입니다.",
        )
        response = await run_contract_review_pipeline(app, page_files)
        current_job = get_job_record(job_id)
        if current_job is not None and current_job.get("status") == "failed":
            return
        _update_job(app, job_id, active_step_key="ocr", active_step_status="completed", active_step_message="OCR 추출 완료")
        _update_job(
            app,
            job_id,
            active_step_key="rules",
            active_step_status="completed",
            active_step_message="계약 항목 비교와 수치 검증을 완료했습니다.",
        )
        _update_job(
            app,
            job_id,
            active_step_key="explanation",
            active_step_status="completed",
            active_step_message="사용자 설명을 생성했습니다.",
        )
        _update_job(
            app,
            job_id,
            status="completed",
            active_step_key="finalize",
            active_step_status="completed",
            active_step_message="결과를 정리했습니다.",
            result=response,
            run_directory=response.get("run_directory"),
        )
    except Exception as error:  # pragma: no cover - background task boundary
        message = _exception_message(error)
        _update_job(app, job_id, status="failed", error=message)
        job = get_job_record(job_id)
        if job is not None:
            for step in job["steps"]:
                if step["status"] == "running":
                    update_job_record(
                        job_id,
                        active_step_key=step["key"],
                        active_step_status="failed",
                        active_step_message=message,
                    )
                    break


# ── OCR 입력 수집 / 래퍼 ─────────────────────────────────────────────────────

def _collect_uploads(
    image: UploadFile | None,
    images: list[UploadFile] | None,
) -> list[UploadFile]:
    """단일 image 와 다중 images 필드를 하나의 업로드 목록으로 정규화한다."""
    uploads: list[UploadFile] = []
    if image is not None:
        uploads.append(image)
    if images:
        uploads.extend(images)
    return uploads


MAX_IMAGE_UPLOADS = 5
MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024


def _validate_uploads(uploads: list[UploadFile]) -> list[tuple[UploadFile, str]]:
    """업로드 목록의 형식과 조합을 검증하고 확장자를 반환한다."""
    if not uploads:
        raise HTTPException(status_code=422, detail="업로드된 파일이 없습니다.")

    allowed = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "application/pdf": ".pdf",
    }

    normalized: list[tuple[UploadFile, str]] = []
    has_pdf = False
    has_image = False

    for upload in uploads:
        suffix = allowed.get(upload.content_type or "")
        if suffix is None:
            raise HTTPException(
                status_code=422,
                detail=f"지원하지 않는 파일 형식: {upload.content_type}. jpg/png/pdf 만 허용.",
            )
        if suffix == ".pdf":
            has_pdf = True
        else:
            has_image = True
        normalized.append((upload, suffix))

    if has_image and len(normalized) > MAX_IMAGE_UPLOADS:
        raise HTTPException(
            status_code=422,
            detail=f"이미지는 최대 {MAX_IMAGE_UPLOADS}장까지 업로드할 수 있습니다.",
        )
    if has_pdf and len(normalized) > 1:
        raise HTTPException(
            status_code=422,
            detail="PDF는 단일 파일만 업로드할 수 있습니다. 여러 페이지 계약서는 이미지 여러 장 또는 PDF 1개만 허용합니다.",
        )
    if has_pdf and has_image:
        raise HTTPException(
            status_code=422,
            detail="PDF와 이미지 파일을 동시에 업로드할 수 없습니다.",
        )

    return normalized


async def _read_page_files(
    validated_uploads: list[tuple[UploadFile, str]],
) -> list[tuple[bytes, str, str]]:
    """업로드 파일을 읽고 개별/총 용량 제한을 검증한다."""
    page_files: list[tuple[bytes, str, str]] = []
    total_bytes = 0

    for upload, suffix in validated_uploads:
        file_bytes = await upload.read()
        if not file_bytes:
            raise HTTPException(
                status_code=422,
                detail=f"빈 파일입니다: {upload.filename or 'unnamed'}",
            )

        file_size = len(file_bytes)
        if file_size > MAX_SINGLE_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"{upload.filename or 'unnamed'} 파일이 너무 큽니다. "
                    f"파일당 최대 용량은 {MAX_SINGLE_FILE_BYTES // (1024 * 1024)}MB입니다."
                ),
            )

        total_bytes += file_size
        if total_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"업로드 총 용량이 너무 큽니다. "
                    f"전체 업로드 최대 용량은 {MAX_TOTAL_UPLOAD_BYTES // (1024 * 1024)}MB입니다."
                ),
            )

        page_files.append((file_bytes, suffix, upload.filename or "page"))

    return page_files


def _create_run_dir() -> Path:
    """실행 시각 기준으로 결과 저장 폴더를 생성한다."""
    TEST_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run_dir = TEST_RUNS_DIR / datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def _safe_upload_filename(index: int, filename: str, suffix: str) -> str:
    """업로드 파일명을 저장용 안전 이름으로 정규화한다."""
    stem = Path(filename or f"page_{index}").stem
    safe_stem = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", stem).strip("_") or f"page_{index}"
    return f"{index:02d}_{safe_stem}{suffix}"


def _persist_uploaded_files(
    files: list[tuple[bytes, str, str]],
    run_dir: Path,
) -> list[str]:
    """업로드 원본을 실행 폴더에 저장하고 저장 경로 목록을 반환한다."""
    saved_paths: list[str] = []

    for index, (file_bytes, suffix, filename) in enumerate(files, start=1):
        saved_name = _safe_upload_filename(index, filename, suffix)
        saved_path = run_dir / saved_name
        saved_path.write_bytes(file_bytes)
        saved_paths.append(str(saved_path))

    return saved_paths


def run_ocr(saved_paths: list[str]) -> dict:
    """저장된 업로드 파일 경로를 기준으로 OCR을 1회 수행한다."""
    if len(saved_paths) == 1:
        return _run_ocr_pipeline(saved_paths[0])
    return _run_ocr_pipeline_pages(saved_paths)


def _ocr_process_entry(saved_paths: list[str], result_conn: Any) -> None:
    try:
        payload = run_ocr(saved_paths)
    except BaseException as exc:  # pragma: no cover - subprocess boundary
        result_conn.send(
            {
                "status": "error",
                "error_type": type(exc).__name__,
                "message": str(exc),
            }
        )
    else:
        result_conn.send({"status": "ok", "payload": payload})
    finally:
        result_conn.close()


async def _run_ocr_with_timeout(saved_paths: list[str]) -> dict:
    timeout_seconds = _resolve_before_ocr_timeout_seconds()
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds
    ctx = _get_process_context()
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    process = ctx.Process(
        target=_ocr_process_entry,
        args=(saved_paths, child_conn),
    )
    process.start()
    child_conn.close()

    try:
        while process.is_alive():
            remaining = deadline - loop.time()
            if remaining <= 0:
                process.terminate()
                process.join(DEFAULT_BEFORE_OCR_TERMINATE_GRACE_SECONDS)
                if process.is_alive():
                    process.kill()
                    process.join(DEFAULT_BEFORE_OCR_TERMINATE_GRACE_SECONDS)
                raise TimeoutError(STALE_REVIEW_JOB_MESSAGE)
            await asyncio.sleep(min(0.25, remaining))

        process.join(DEFAULT_BEFORE_OCR_TERMINATE_GRACE_SECONDS)
        if not parent_conn.poll(DEFAULT_BEFORE_OCR_TERMINATE_GRACE_SECONDS):
            raise RuntimeError(
                "OCR provider process exited without returning a result. "
                f"exitcode={process.exitcode}"
            )
        result = parent_conn.recv()
    finally:
        parent_conn.close()

    if result["status"] == "ok":
        return result["payload"]

    message = str(result.get("message") or "OCR provider call failed.")
    raise RuntimeError(message)


def _save_run_artifacts(run_dir: Path, output: dict, response: dict) -> None:
    """OCR 결과와 리뷰 결과, 사용자 설명 마크다운을 실행 폴더에 저장한다."""
    (run_dir / "ocr_output.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (run_dir / "review_result.json").write_text(
        json.dumps(response, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    user_markdown = response.get("user_explanation", {}).get("markdown", "")
    if user_markdown:
        (run_dir / "user_explanation.md").write_text(
            user_markdown,
            encoding="utf-8",
        )


# ── OCR 경고 생성 ─────────────────────────────────────────────────────────────

def build_ocr_warnings(output: dict, rule_results: dict) -> list[dict]:
    """structured 값과 실제 계산값의 차이를 ocr_warnings 목록으로 반환."""
    warnings: list[dict] = []

    # 근무시간 불일치
    wh = rule_results.get("working_hours", {})
    stated  = wh.get("stated_daily")
    actual  = wh.get("actual_daily")
    if stated is not None and actual is not None:
        try:
            if abs(float(stated) - float(actual)) > 0.1:
                warnings.append({
                    "field":      "working_hours.daily_hours",
                    "structured": stated,
                    "corrected":  actual,
                    "note":       "OCR 오류 또는 계약서 기재 오류 — 재계산값 사용",
                })
        except (TypeError, ValueError):
            pass

    # 이름 불일치 (structured vs preamble 원문)
    s_name  = output["structured"].get("employee_party_name", "")
    preamble = output["raw_sections"].get("preamble") or ""
    raw_name_match = re.search(r'과\(와\)\s+(\S+)\s+\(이하', preamble)
    if raw_name_match:
        raw_name = raw_name_match.group(1)
        if s_name and s_name != raw_name:
            warnings.append({
                "field":      "employee_party_name",
                "structured": s_name,
                "raw":        raw_name,
                "note":       "OCR 오류 — 원본 이미지 직접 확인 필요",
            })

    return warnings


def _extract_critical_field_snapshot(output: dict, section_result: dict, rule_result: dict) -> dict:
    """리뷰에 실제 사용된 OCR 핵심 필드 스냅샷을 반환."""
    role_mapping = section_result.get("role_mapping", {})
    wh_section = get_section_by_roles(
        output, role_mapping, ("소정근로시간", "근로일 및 근로일별 근로시간", "근로시간")
    )
    wage_section = get_section_by_roles(
        output, role_mapping, ("임금", "임금지급일")
    )
    day_section = get_section_by_roles(
        output, role_mapping, ("근무일/휴일", "근로일 및 근로일별 근로시간", "휴일")
    )

    wh_text = wh_section.get("full_text", "") if wh_section else ""
    wage_text = wage_section.get("full_text", "") if wage_section else ""
    day_text = day_section.get("full_text", "") if day_section else ""

    raw_wh = parse_working_hours(wh_text) if wh_text else {}
    raw_wage = parse_wage_info(wage_text) if wage_text else {}
    raw_days = parse_days_per_week(day_text) if day_text else None

    return {
        "meta": {
            "source_files": output.get("_meta", {}).get("source_files")
                           or [output.get("_meta", {}).get("source_file")],
            "page_count": output.get("_meta", {}).get("page_count", 1),
            "contract_type": output.get("_meta", {}).get("contract_type"),
            "worker_group": output.get("_meta", {}).get("worker_group"),
            "worker_group_confidence": output.get("_meta", {}).get("worker_group_confidence"),
            "contract_form_type": output.get("_meta", {}).get("contract_form_type"),
            "foreign_worker_signals": output.get("_meta", {}).get("foreign_worker_signals", {}),
            "dormitory_info": output.get("_meta", {}).get("dormitory_info", {}),
            "high_risk_clauses": output.get("_meta", {}).get("high_risk_clauses", {}),
            "schema_class": output.get("_meta", {}).get("schema_class"),
        },
        "critical_fields": {
            "working_hours": {
                "structured": output.get("structured", {}).get("working_hours"),
                "raw_parsed": raw_wh,
                "resolved": rule_result.get("working_hours", {}),
                "evidence": wh_text[:400] if wh_text else None,
            },
            "wage": {
                "structured": output.get("structured", {}).get("wage"),
                "raw_parsed": raw_wage,
                "resolved": rule_result.get("minimum_wage", {}),
                "evidence": wage_text[:400] if wage_text else None,
            },
            "work_days": {
                "structured": output.get("structured", {}).get("work_days"),
                "raw_parsed": {"days_per_week": raw_days},
                "resolved": {
                    "days_per_week": rule_result.get("minimum_wage", {}).get("days_per_week")
                },
                "evidence": day_text[:400] if day_text else None,
            },
            "payment_day": {
                "structured": output.get("structured", {}).get("wage", {}).get("payment_day"),
                "resolved": rule_result.get("payment_day", {}),
                "evidence": wage_text[:400] if wage_text else None,
            },
        },
    }


def build_ocr_conflicts(output: dict, section_result: dict, rule_result: dict) -> list[dict]:
    """structured 와 raw 파싱/규칙 결과가 충돌하는 핵심 필드를 반환."""
    conflicts: list[dict] = []
    structured = output.get("structured", {})
    structured_wage = structured.get("wage", {})
    structured_wh = structured.get("working_hours", {})

    resolved_wage = rule_result.get("minimum_wage", {})
    if structured_wage.get("wage_amount") is not None and resolved_wage.get("stated_amount") is not None:
        if float(structured_wage["wage_amount"]) != float(resolved_wage["stated_amount"]):
            conflicts.append({
                "field": "wage.wage_amount",
                "structured": structured_wage.get("wage_amount"),
                "resolved": resolved_wage.get("stated_amount"),
                "note": "structured 임금과 raw_sections 기반 파싱 결과가 다릅니다.",
            })

    if structured_wage.get("payment_day") and rule_result.get("payment_day", {}).get("payment_day") is not None:
        if str(structured_wage["payment_day"]) != str(rule_result["payment_day"]["payment_day"]):
            conflicts.append({
                "field": "wage.payment_day",
                "structured": structured_wage.get("payment_day"),
                "resolved": rule_result["payment_day"].get("payment_day"),
                "note": "structured 지급일과 raw_sections 기반 파싱 결과가 다릅니다.",
            })

    if structured_wh.get("daily_hours") is not None and rule_result.get("working_hours", {}).get("actual_daily") is not None:
        try:
            if abs(float(structured_wh["daily_hours"]) - float(rule_result["working_hours"]["actual_daily"])) > 0.1:
                conflicts.append({
                    "field": "working_hours.daily_hours",
                    "structured": structured_wh.get("daily_hours"),
                    "resolved": rule_result["working_hours"].get("actual_daily"),
                    "note": "structured 근로시간과 raw_sections 재파싱 결과가 다릅니다.",
                })
        except (TypeError, ValueError):
            pass

    return conflicts


# ── 결과 통합 ─────────────────────────────────────────────────────────────────

_SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
_STATUS_ORDER   = {"VIOLATION": 0, "WARNING": 1, "PASS": 2}
_RISK_BUCKET_ORDER = {
    "immediate_illegal": 0,
    "mandatory_missing": 1,
    "deduction_risk": 2,
    "enforceability_risk": 3,
    "other": 4,
}


def _worst_severity(*severities: str) -> str:
    return min(severities, key=lambda s: _SEVERITY_ORDER.get(s, 99), default="NONE")


def _worst_status(*statuses: str) -> str:
    return min(statuses, key=lambda s: _STATUS_ORDER.get(s, 99), default="PASS")


def _build_scenario_tags(output: dict) -> list[str]:
    tags: list[str] = []
    meta = output.get("_meta", {})
    if meta.get("worker_group") == "foreign_worker" and meta.get("worker_group_confidence") == "confirmed":
        tags.append("foreign_worker")
    elif meta.get("worker_group") == "foreign_worker" and meta.get("worker_group_confidence") == "suspected":
        tags.append("foreign_worker_suspected")
    if meta.get("contract_form_type") == "custom_form":
        tags.append("custom_form")
    if "foreign_worker" in tags and meta.get("dormitory_info", {}).get("provided"):
        tags.append("dormitory")
    if "foreign_worker" in tags and meta.get("high_risk_clauses", {}).get("passport_custody"):
        tags.append("passport_custody")
    if "foreign_worker" in tags and meta.get("high_risk_clauses", {}).get("mobility_restriction"):
        tags.append("mobility_restriction")
    return tags


def _build_risk_summary(output: dict, section_result: dict, content_result: dict) -> dict:
    """외국인 시나리오를 포함한 핵심 위험을 우선순위 버킷으로 요약한다."""
    buckets = {
        "immediate_illegal": [],
        "mandatory_missing": [],
        "deduction_risk": [],
        "enforceability_risk": [],
    }

    meta = output.get("_meta", {})
    is_confirmed_foreign = (
        meta.get("worker_group") == "foreign_worker"
        and meta.get("worker_group_confidence") == "confirmed"
    )

    if is_confirmed_foreign and meta.get("contract_form_type") == "custom_form":
        buckets["immediate_illegal"].append({
            "title": "표준근로계약서 미사용",
            "issue_type": "standard_form_misuse",
            "law_ref": "외국인근로자의 고용 등에 관한 법률 제9조 (근로계약)",
            "description": "외국인 근로자 계약서가 자체 양식으로 보이며 고용허가제 표준근로계약서 사용 여부를 즉시 확인해야 합니다.",
        })

    dormitory_info = meta.get("dormitory_info", {})
    if is_confirmed_foreign and dormitory_info.get("provided") and not dormitory_info.get("written_disclosed", True):
        buckets["deduction_risk"].append({
            "title": "기숙사 정보 누락",
            "issue_type": "dormitory_missing_info",
            "law_ref": "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등)",
            "description": "숙소·기숙사 정보를 서면에 적지 않고 별도 안내로 돌리고 있어 공제와 주거환경 분쟁 위험이 큽니다.",
        })

    if is_confirmed_foreign and meta.get("high_risk_clauses", {}).get("passport_custody"):
        buckets["immediate_illegal"].append({
            "title": "여권·외국인등록증 보관 조항",
            "issue_type": "passport_custody",
            "law_ref": "근로기준법 제7조 (강제 근로의 금지)",
            "description": "여권 또는 외국인등록증을 회사가 보관하는 조항은 중대한 권리침해 위험이 있습니다.",
        })

    if is_confirmed_foreign and (
        meta.get("high_risk_clauses", {}).get("mobility_restriction")
        or meta.get("high_risk_clauses", {}).get("liquidated_damages")
    ):
        buckets["immediate_illegal"].append({
            "title": "이직 제한·손해배상 예정 조항",
            "issue_type": "mobility_restriction",
            "law_ref": "근로기준법 제20조 (위약 예정의 금지)",
            "description": "사업장 변경이나 이직을 제한하고 손해배상을 예정하는 문구는 외국인 근로자의 권리를 과도하게 제한할 수 있습니다.",
        })

    missing_titles = {item.get("title") for item in section_result.get("missing", []) if isinstance(item, dict)}
    mandatory_markers = ("근로시간", "휴게", "휴일", "임금", "지급")
    if any(any(marker in (title or "") for marker in mandatory_markers) for title in missing_titles):
        buckets["mandatory_missing"].append({
            "title": "필수 근로조건 서면 누락",
            "issue_type": "mandatory_terms_missing",
            "law_ref": "근로기준법 제17조 (근로조건의 명시)",
            "description": "근로시간, 휴게, 휴일, 임금 지급 관련 핵심 정보가 계약서에 충분히 명시되지 않았을 가능성이 높습니다.",
        })

    for result in content_result.values():
        issues = result.get("issues") or []
        for issue in issues:
            risk_bucket = issue.get("risk_bucket") or result.get("risk_bucket") or "other"
            if risk_bucket not in buckets:
                continue
            buckets[risk_bucket].append({
                "title": result.get("comment") or result.get("issue_type") or "추가 위험",
                "issue_type": issue.get("issue_type") or result.get("issue_type") or "other",
                "law_ref": issue.get("law_ref"),
                "description": issue.get("description"),
            })

    for bucket, items in buckets.items():
        deduped: list[dict] = []
        seen_keys: set[tuple[str, str]] = set()
        for item in items:
            key = (item.get("issue_type", "other"), item.get("law_ref", "") or "")
            if key in seen_keys:
                continue
            seen_keys.add(key)
            deduped.append(item)
        deduped.sort(key=lambda item: _RISK_BUCKET_ORDER.get(bucket, 99))
        buckets[bucket] = deduped[:5]

    return buckets


def aggregate_results(
    output: dict,
    section_result: dict,
    rule_result: dict,
    content_result: dict,
    standard_map: dict,
) -> dict:
    """Phase 2/3/4 결과를 통합해 최종 응답 dict 를 반환한다."""

    rule_statuses   = [v["status"]   for v in rule_result.values()]
    rule_severities = [v["severity"] for v in rule_result.values() if "severity" in v]
    content_summary = summarize_content_results(content_result)

    overall_status = _worst_status(
        "VIOLATION" if section_result["has_issues"] else "PASS",
        *rule_statuses,
        content_summary["overall_status"],
    )
    overall_severity = _worst_severity(
        *rule_severities,
        content_summary["overall_severity"],
    )

    # 계약서 기본 정보 (raw_sections 우선 사용)
    preamble        = output["raw_sections"].get("preamble") or ""
    employer_match  = re.search(r'^(\S+)\s+\(이하', preamble)
    employee_match  = re.search(r'과\(와\)\s+(\S+)\s+\(이하', preamble)

    contract_info = {
        "type":       output["_meta"]["contract_type"],
        "employer":   employer_match.group(1) if employer_match else output["structured"].get("employer_party_name", ""),
        "employee":   employee_match.group(1) if employee_match else output["structured"].get("employee_party_name", ""),
        "start_date": output["structured"].get("start_date", ""),
    }
    scenario_tags = _build_scenario_tags(output)
    risk_summary = _build_risk_summary(output, section_result, content_result)

    # 요약 문장
    summary_parts: list[str] = []
    for check_name, res in rule_result.items():
        if res["status"] == "VIOLATION":
            summary_parts.append(f"{check_name} 위반({res.get('severity','HIGH')})")
        elif res["status"] == "WARNING":
            summary_parts.append(f"{check_name} 주의({res.get('severity','MEDIUM')})")
    for sec_no in content_summary["violation_sections"]:
        summary_parts.append(f"{sec_no}항 내용 위반")
    for sec_no in content_summary["warning_sections"]:
        summary_parts.append(f"{sec_no}항 주의 필요")

    summary = ("문제 없음." if not summary_parts
               else ", ".join(summary_parts) + " 발견.")

    ocr_snapshot = _extract_critical_field_snapshot(output, section_result, rule_result)
    ocr_conflicts = build_ocr_conflicts(output, section_result, rule_result)
    ocr_warnings = build_ocr_warnings(output, rule_result)
    user_explanation = build_user_explanation(
        contract_info=contract_info,
        overall_result=overall_status,
        overall_severity=overall_severity,
        section_result=section_result,
        rule_result=rule_result,
        content_result=content_result,
        ocr_snapshot=ocr_snapshot,
        standard_map=standard_map,
    )

    return {
        "review_id":        str(uuid.uuid4()),
        "reviewed_at":      datetime.now(timezone.utc).isoformat(),
        "contract_info":    contract_info,
        "scenario_tags":    scenario_tags,
        "ocr_snapshot":     ocr_snapshot,
        "ocr_conflicts":    ocr_conflicts,
        "ocr_warnings":     ocr_warnings,
        "overall_result":   overall_status,
        "overall_severity": overall_severity,
        "section_check": {
            "missing":    section_result["missing"],
            "extra":      section_result["extra"],
            "mismatches": section_result["mismatches"],
        },
        "rule_check":    rule_result,
        "content_check": content_result,
        "risk_summary":  risk_summary,
        "summary":       summary,
        "user_explanation": user_explanation,
    }


async def build_review_response_from_output(app: FastAPI, output: dict) -> dict:
    """저장된 OCR 결과 dict 를 기준으로 Phase B-2 ~ B-5 를 수행한다."""
    await _ensure_runtime_loaded(app)
    section_result = await asyncio.to_thread(
        compare_sections, output, app.state.standard_map
    )

    rule_result = await asyncio.to_thread(
        validate_all,
        output,
        section_result["role_mapping"],
        app.state.min_wage,
    )

    extra_law_map = await asyncio.to_thread(
        build_extra_law_map,
        section_result["extra"],
        app.state.all_chunks,
        {
            "worker_group": output.get("_meta", {}).get("worker_group", "general"),
            "worker_group_confidence": output.get("_meta", {}).get("worker_group_confidence", "general"),
        },
    )

    content_result = await check_all_sections(
        output=output,
        standard_map=app.state.standard_map,
        role_mapping=section_result["role_mapping"],
        rule_results=rule_result,
        llm_client=_get_llm_client(app),
        extra_law_map=extra_law_map,
    )

    return aggregate_results(
        output,
        section_result,
        rule_result,
        content_result,
        app.state.standard_map,
    )


async def run_contract_review_pipeline(
    app: FastAPI,
    page_files: list[tuple[bytes, str, str]],
) -> dict:
    """
    업로드 저장부터 OCR, 리뷰 JSON 생성, 마크다운 저장까지 한 번에 수행한다.

    파이프라인 산출물:
    - 업로드 원본
    - `ocr_output.json`
    - `review_result.json`
    - `user_explanation.md`
    """
    run_dir = _create_run_dir()
    saved_paths = _persist_uploaded_files(page_files, run_dir)

    try:
        output = await _run_ocr_with_timeout(saved_paths)
    except TimeoutError as error:
        message = str(error) or STALE_REVIEW_JOB_MESSAGE
        (run_dir / "error.txt").write_text(
            f"OCR 실패: {message}",
            encoding="utf-8",
        )
        raise HTTPException(status_code=504, detail=message) from error
    except Exception as error:
        (run_dir / "error.txt").write_text(
            f"OCR 실패: {error}",
            encoding="utf-8",
        )
        raise HTTPException(status_code=500, detail=f"OCR 실패: {error}") from error

    try:
        response = await build_review_response_from_output(app, output)
    except Exception as error:
        (run_dir / "ocr_output.json").write_text(
            json.dumps(output, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (run_dir / "error.txt").write_text(
            f"리뷰 생성 실패: {error}",
            encoding="utf-8",
        )
        raise HTTPException(status_code=500, detail=f"리뷰 생성 실패: {error}") from error

    response["run_directory"] = str(run_dir)
    response["uploaded_files"] = [
        {
            "name": Path(saved_path).name,
            "url": f"/api/v1/before/artifacts/{run_dir.name}/{Path(saved_path).name}",
        }
        for saved_path in saved_paths
    ]
    _save_run_artifacts(run_dir, output, response)
    return response


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@app.post("/review")
async def review_contract(
    image: UploadFile | None = File(None),
    images: list[UploadFile] | None = File(None),
):
    """
    계약서 이미지 또는 페이지 묶음을 업로드해 법령 검토 결과를 반환한다.

    - Content-Type: multipart/form-data
    - 파일 필드명: image (단일) 또는 images (다중)
    - 지원 형식: jpg, png, pdf
    - 다중 업로드는 같은 계약서의 페이지 순서대로 전송해야 한다.
    """
    # ── 1. 입력 검증 ──────────────────────────────────────────────────────────
    await _ensure_runtime_loaded(app)
    uploads = _collect_uploads(image, images)
    validated_uploads = _validate_uploads(uploads)
    page_files = await _read_page_files(validated_uploads)

    # ── 2. OCR ~ 설명 마크다운 저장 파이프라인 (B-1 ~ B-5) ────────────────
    response = await run_contract_review_pipeline(app, page_files)
    return JSONResponse(content=response)


@app.post("/review/jobs")
async def create_review_job(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
    db: Annotated[Session, Depends(get_db)],
    image: UploadFile | None = File(None),
    images: list[UploadFile] | None = File(None),
):
    await _ensure_runtime_loaded(app)
    uploads = _collect_uploads(image, images)
    validated_uploads = _validate_uploads(uploads)
    page_files = await _read_page_files(validated_uploads)

    job_id = uuid.uuid4().hex
    job = create_job_record(
        job_id=job_id,
        status="queued",
        steps=_build_default_steps(),
        user_id=current_user.id if current_user is not None else None,
        db=db,
    )
    asyncio.create_task(_execute_review_job(app, job_id, page_files))
    return JSONResponse(content=job)


@app.get("/review/jobs/{job_id}")
async def get_review_job(job_id: str):
    await _ensure_runtime_loaded(app)
    job = get_job_record(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="before review job not found")
    job = _fail_stale_review_job_if_needed(job)
    return JSONResponse(content=job)


@app.post("/accessibility/recommendations")
async def get_accessibility_recommendations(payload: dict[str, Any]):
    disability_type = str(payload.get("disability_type", "")).strip().lower()
    job_traits = payload.get("job_traits", [])
    if not isinstance(job_traits, list):
        job_traits = []

    try:
        recommendation = build_accessibility_recommendation(disability_type, job_traits)
    except ValueError:
        raise HTTPException(status_code=422, detail="지원하지 않는 장애 유형입니다.")
    return JSONResponse(content=recommendation)


@app.get("/health")
async def health():
    """서버 상태 확인."""
    return {
        "status": "ok",
        "runtime_loaded": getattr(app.state, "runtime_loaded", False),
        "standard_map_loaded": hasattr(app.state, "standard_map"),
        "all_chunks_loaded": hasattr(app.state, "all_chunks"),
        "all_chunks_source": getattr(app.state, "all_chunks_source", None),
        "all_chunks_count": len(app.state.all_chunks) if hasattr(app.state, "all_chunks") else 0,
        "llm_provider": type(app.state.llm_client).__name__ if hasattr(app.state, "llm_client") else None,
        "job_count": count_job_records(),
    }
