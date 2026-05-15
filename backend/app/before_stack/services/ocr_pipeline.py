"""
ocr_pipeline.py — Phase B-1 (Vertex AI Vision OCR)
계약서 이미지를 받아 structured + raw_sections + _meta 를 반환한다.

legacy contract_ocr_pipeline.py 를 현재 Vertex AI 방식으로 대체한 구현.
공용 Pydantic 스키마는 schemas.py 에서 불러온다.

사용:
    from backend.app.before_stack.services.ocr_pipeline import run_pipeline
    result = run_pipeline("/path/to/contract.jpg")
    # result["structured"], result["raw_sections"], result["_meta"]

    from backend.app.before_stack.services.ocr_pipeline import run_pipeline_pages
    result = run_pipeline_pages(["/path/to/page1.jpg", "/path/to/page2.jpg"])
    # 여러 장 이미지를 같은 계약서 페이지 묶음으로 처리

환경변수 (Phase B):
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa_key.json
    GCP_PROJECT_ID=your_project_id
    GCP_LOCATION=us-central1  (선택, 기본값)
"""

import json
import re
from pathlib import Path
from typing import Sequence

import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

from backend.app.before_stack.core.settings import (
    GCP_PROJECT_ID,
    GCP_LOCATION,
    VERTEX_MODEL,
    require_phase_b_env,
)
from backend.app.before_stack.schemas.contract import (
    ContractType,
    NoFixedTermContractData,
    SCHEMA_BY_CONTRACT_TYPE,
    REQUIRED_FIELDS_BY_CONTRACT_TYPE,
)


# ── Vertex AI 초기화 (모듈 로드 시 1회) ──────────────────────────────────────

_vertex_initialized = False

def _init_vertex() -> None:
    global _vertex_initialized
    if not _vertex_initialized:
        require_phase_b_env()
        vertexai.init(project=GCP_PROJECT_ID, location=GCP_LOCATION)
        _vertex_initialized = True


# ── Layer 1: 구조화 추출 ──────────────────────────────────────────────────────

_LAYER1_PROMPT = """당신은 한국 표준근로계약서 OCR 전문가입니다.
이미지에서 빈칸에 기재된 값만 정확히 추출하여 JSON으로 반환하세요.

규칙:
- 빈칸이 비어있으면 null
- 숫자는 숫자형으로 (문자 제거: "300,000원" → 300000)
- 날짜는 YYYY-MM-DD 형식
- 체크박스: 체크된 것만 true
- 절대 추론하거나 없는 값을 만들지 말 것
- 외국인 근로자 계약서로 보이면 비자, 국적, 여권, 외국인등록증, 숙소/기숙사 관련 정보를 별도 필드에 채울 것
- 자체 양식 계약서처럼 보여도 표준서식이 아닌 경우 contract_form_type 에 반영할 것

반환 JSON 스키마:
{
  "employer_party_name": "사업주 상호 (전문)",
  "employee_party_name": "근로자 성명 (전문)",
  "start_date": "YYYY-MM-DD",
  "workplace": "근무장소",
  "job_description": "업무내용",
  "working_hours": {
    "start": "HH:MM",
    "end": "HH:MM",
    "break_start": "HH:MM",
    "break_end": "HH:MM",
    "daily_hours": 숫자,
    "weekly_hours": 숫자
  },
  "work_days": {
    "days_per_week": 숫자,
    "work_days_detail": ["월","화",...] 또는 null,
    "weekly_holiday_day": "요일"
  },
  "wage": {
    "wage_type": "월급|일급|시간급",
    "wage_amount": 숫자,
    "bonus_exists": true/false,
    "bonus_amount": 숫자 또는 null,
    "extra_allowance_exists": true/false,
    "allowance_1": {"name": "수당명", "amount": 숫자},
    "allowance_2": {"name": "수당명", "amount": 숫자},
    "payment_cycle": "매월|매주|매일",
    "payment_day": "일",
    "payment_method_direct": true/false,
    "payment_method_transfer": true/false
  },
  "social_insurance": {
    "exception_note": "예외사유 또는 null"
  },
  "signed_date": "YYYY-MM-DD",
  "employer": {
    "company_name": "사업체명",
    "phone": "전화번호",
    "address": "주소",
    "representative": "대표자 성명"
  },
  "employee": {
    "name": "성명",
    "address": "주소",
    "contact": "연락처"
  },
  "contract_form_type": "standard_foreign_worker|standard_general|custom_form|unknown",
  "foreign_worker_signals": {
    "visa_type": "E-9 등 또는 null",
    "nationality": "국적 또는 null",
    "passport_mentioned": true/false,
    "alien_registration_mentioned": true/false
  },
  "dormitory_info": {
    "provided": true/false/null,
    "location": "기숙사 위치 또는 null",
    "facility_type": "주택/컨테이너/비닐하우스/가건물 등 또는 null",
    "area": "면적 또는 null",
    "deduction_amount": 숫자 또는 null,
    "written_disclosed": true/false/null
  },
  "high_risk_clauses": {
    "passport_custody": true/false,
    "mobility_restriction": true/false,
    "liquidated_damages": true/false,
    "blanket_company_rules": true/false
  }
}

위 스키마에 맞는 JSON만 반환하세요."""

_LAYER2_PROMPT = """당신은 한국 표준근로계약서 OCR 전문가입니다.
이미지에서 번호가 붙은 각 조항의 전체 원문을 추출하여 JSON으로 반환하세요.

규칙:
- 인쇄된 텍스트와 기재된 값을 모두 포함
- 줄바꿈은 \\n 으로 표현
- 항목 번호와 제목 포함
- 전문(서두)과 서명 블록도 포함
- 번호가 없거나 OCR 상 번호가 불분명해도 sections 배열에는 반드시 각 항목의 "number"를 "1", "2", "3"처럼 순번 문자열로 채울 것
- "number"를 null 로 두지 말 것
- 자체 양식 계약서라도 "기본 정보", "임금 조건", "근무 조건", "특약사항" 같은 블록을 각각 하나의 section 으로 분리할 것
- 외국인 근로자 계약서로 보이는 경우 비자/국적/숙소/여권 관련 문구가 있는 section 을 빠뜨리지 말 것

반환 형식:
{
  "contract_title": "계약서 제목",
  "preamble": "전문 원문 (사업주 ~ 근로계약을 체결한다.)",
  "sections": [
    {"number": "1", "title": "항목 제목", "full_text": "1. 항목제목 : 내용 전체"},
    {"number": "2", "title": "항목 제목", "full_text": "2. 항목제목 : 내용 전체"},
    ...
  ],
  "signature_block": "날짜 및 서명 블록 원문"
}

위 형식의 JSON만 반환하세요."""


def _image_to_part(image_path: str) -> Part:
    """이미지 파일을 Vertex AI Part 객체로 변환."""
    path = Path(image_path)
    ext = path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".png": "image/png", ".pdf": "application/pdf"}
    mime_type = mime_map.get(ext, "image/jpeg")

    with open(path, "rb") as f:
        image_bytes = f.read()

    return Part.from_data(data=image_bytes, mime_type=mime_type)


def _build_contents(image_parts: Sequence[Part], prompt: str) -> list[Part | str]:
    """여러 장 이미지를 같은 계약서 페이지 순서로 전달하기 위한 contents 구성."""
    if len(image_parts) == 1:
        return [image_parts[0], prompt]

    page_guide = (
        f"다음 {len(image_parts)}개 이미지는 같은 근로계약서의 순서대로 촬영된 페이지입니다. "
        "앞에서 뒤 순서대로 읽고, 모든 페이지 내용을 합쳐 하나의 JSON으로 반환하세요. "
        "페이지마다 중복되는 문구는 하나로 정리하되, 특정 페이지에만 있는 정보는 누락하지 마세요."
    )
    return [page_guide, *image_parts, prompt]


def _parse_json_response(text: str) -> dict:
    """LLM 응답에서 JSON 파싱. 마크다운 코드블록 처리 포함."""
    code_block = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if code_block:
        text = code_block.group(1)
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match:
        return json.loads(obj_match.group())
    return json.loads(text)


def _detect_contract_type(title: str, preamble: str) -> str:
    """계약서 제목 또는 전문에서 계약서 유형을 탐지한다."""
    combined = f"{title or ''} {preamble or ''}".lower()
    if "단시간" in combined:
        return ContractType.PART_TIME.value
    if "연소" in combined:
        return ContractType.MINOR_WORKER.value
    if "건설일용" in combined or "건설" in combined:
        return ContractType.CONSTRUCTION.value
    if "외국인" in combined:
        return ContractType.FOREIGN_WORKER.value
    if "기간의 정함이 없" in combined or "기간의_정함이_없" in combined:
        return ContractType.NO_FIXED_TERM.value
    if "기간의 정함이 있" in combined or "기간의_정함이_있" in combined:
        return ContractType.FIXED_TERM.value
    return ContractType.NO_FIXED_TERM.value  # 기본값


def _normalize_section_number(raw_number: object, fallback_index: int, title: str, full_text: str) -> str:
    """OCR section number 를 문자열 번호로 정규화한다."""
    if raw_number is not None:
        normalized = str(raw_number).strip()
        digit_match = re.search(r"\d+", normalized)
        if digit_match:
            return digit_match.group(0)

    for candidate in (title, full_text):
        digit_match = re.match(r"\s*(\d+)[\.\)]?", candidate or "")
        if digit_match:
            return digit_match.group(1)

    return str(fallback_index)


def _normalize_raw_sections(raw_sections: dict) -> dict:
    """sections 번호와 제목을 후처리해 downstream 단계에서 안정적으로 사용하게 만든다."""
    sections = raw_sections.get("sections", [])
    normalized_sections: list[dict] = []
    seen_numbers: set[str] = set()

    for index, sec in enumerate(sections, start=1):
        title = (sec.get("title") or "").strip()
        full_text = (sec.get("full_text") or "").strip()
        number = _normalize_section_number(sec.get("number"), index, title, full_text)

        while number in seen_numbers:
            number = f"{number}_{index}"
        seen_numbers.add(number)

        normalized_sections.append({
            "number": number,
            "title": title or f"{index}항",
            "full_text": full_text,
        })

    normalized = dict(raw_sections)
    normalized["contract_title"] = (raw_sections.get("contract_title") or "").strip()
    normalized["preamble"] = (raw_sections.get("preamble") or "").strip()
    normalized["signature_block"] = (raw_sections.get("signature_block") or "").strip()
    normalized["sections"] = normalized_sections
    return normalized


def _collect_foreign_worker_signals(structured: dict, raw_sections: dict) -> dict:
    """외국인근로자 여부를 추정할 수 있는 신호를 OCR 결과에서 수집한다."""
    section_text = "\n".join(sec.get("full_text", "") for sec in raw_sections.get("sections", []))
    combined = " ".join([
        raw_sections.get("contract_title", ""),
        raw_sections.get("preamble", ""),
        section_text,
        structured.get("employee_party_name", "") or "",
    ])

    visa_match = re.search(r"\b([A-Z]-\d{1,2})\b", combined)
    nationality_match = re.search(r"국\s*적\s*[:：]?\s*([A-Za-z가-힣 ]+)", combined)

    return {
        "visa_type": visa_match.group(1) if visa_match else None,
        "nationality": nationality_match.group(1).strip() if nationality_match else None,
        "passport_mentioned": any(keyword in combined for keyword in ("여권", "passport")),
        "alien_registration_mentioned": any(
            keyword in combined for keyword in ("외국인등록", "alien registration", "등록증")
        ),
    }


def _collect_dormitory_info(structured: dict, raw_sections: dict) -> dict:
    """숙식/기숙사 관련 OCR 신호를 구조화한다."""
    section_text = "\n".join(sec.get("full_text", "") for sec in raw_sections.get("sections", []))
    combined = " ".join([
        section_text,
        raw_sections.get("preamble", ""),
    ])

    deduction_match = re.search(r"(?:숙소비|기숙사비|숙박시설.*부담금액|식사 제공 시 근로자 부담금액)[^\d]*(\d[\d,]*)\s*원", combined)
    facility_match = re.search(r"(비닐하우스|가건물|컨테이너|조립식 패널|주택|고시원|오피스텔)", combined)
    location_match = re.search(r"(?:숙소|기숙사|숙박시설)[^\n]{0,30}(?:위치|장소)[^\n:：]*[:：]?\s*([^\n]+)", combined)
    area_match = re.search(r"(?:면적|평수)[^\n:：]*[:：]?\s*([^\n]+)", combined)

    provided = None
    if any(keyword in combined for keyword in ("숙소", "기숙사", "숙박시설", "숙식")):
        provided = True

    return {
        "provided": provided,
        "location": location_match.group(1).strip() if location_match else None,
        "facility_type": facility_match.group(1) if facility_match else None,
        "area": area_match.group(1).strip() if area_match else None,
        "deduction_amount": int(deduction_match.group(1).replace(",", "")) if deduction_match else None,
        "written_disclosed": not any(keyword in combined for keyword in ("별도 안내", "구두", "추후 안내")),
    }


def _collect_high_risk_clauses(raw_sections: dict) -> dict:
    """외국인 특화 독소 조항을 OCR 원문 기준으로 탐지한다."""
    section_text = "\n".join(sec.get("full_text", "") for sec in raw_sections.get("sections", []))
    combined = " ".join([
        raw_sections.get("contract_title", ""),
        raw_sections.get("preamble", ""),
        section_text,
    ])

    return {
        "passport_custody": any(keyword in combined for keyword in ("여권", "외국인등록증")) and any(
            keyword in combined for keyword in ("보관", "회사 보관", "사업주 보관")
        ),
        "mobility_restriction": any(
            keyword in combined for keyword in ("이직", "사업장 변경", "사업장을 이탈", "사업장 이탈")
        ),
        "liquidated_damages": any(keyword in combined for keyword in ("손해배상", "위약금", "배상한다")),
        "blanket_company_rules": any(
            keyword in combined for keyword in ("회사 규정에 따른다", "내부 규정에 따른다", "규정 일체에 동의")
        ),
    }


def _detect_contract_form_type(title: str, raw_sections: dict, foreign_worker_signals: dict) -> str:
    """표준서식 사용 여부와 자체 양식 가능성을 가볍게 추정한다."""
    normalized_title = (title or "").replace(" ", "")
    section_titles = {sec.get("title", "") for sec in raw_sections.get("sections", [])}
    looks_like_custom = any(
        title in section_titles for title in ("기본 정보", "임금 조건", "근무 조건", "특약사항")
    )

    if "표준근로계약서" in normalized_title:
        return "standard_foreign_worker" if foreign_worker_signals.get("visa_type") or "외국인" in normalized_title else "standard_general"
    if looks_like_custom:
        return "custom_form"
    return "unknown"


def _build_worker_group_context(structured: dict, raw_sections: dict) -> dict:
    """외국인근로자 여부를 점수 기반으로 추정한다."""
    title = raw_sections.get("contract_title") or ""
    preamble = raw_sections.get("preamble") or ""
    combined = " ".join([
        title,
        preamble,
        *(sec.get("full_text", "") for sec in raw_sections.get("sections", [])),
    ])
    foreign_worker_signals = _collect_foreign_worker_signals(structured, raw_sections)
    dormitory_info = _collect_dormitory_info(structured, raw_sections)
    high_risk_clauses = _collect_high_risk_clauses(raw_sections)
    contract_form_type = _detect_contract_form_type(title, raw_sections, foreign_worker_signals)

    score = 0
    reasons: list[str] = []
    normalized_combined = combined.replace(" ", "").lower()

    if contract_form_type == "standard_foreign_worker":
        score += 5
        reasons.append("foreign_standard_form")
    if any(keyword in normalized_combined for keyword in ("외국인", "고용허가", "eps", "e-9")):
        score += 4
        reasons.append("foreign_contract_marker")
    if foreign_worker_signals.get("visa_type"):
        score += 4
        reasons.append("visa_type")
    if foreign_worker_signals.get("nationality"):
        score += 3
        reasons.append("nationality")
    if foreign_worker_signals.get("alien_registration_mentioned"):
        score += 2
        reasons.append("alien_registration")
    if foreign_worker_signals.get("passport_mentioned"):
        score += 1
        reasons.append("passport")
    if dormitory_info.get("provided"):
        score += 1
        reasons.append("dormitory")
    if high_risk_clauses.get("passport_custody"):
        score += 1
        reasons.append("passport_custody_clause")
    if high_risk_clauses.get("mobility_restriction"):
        score += 1
        reasons.append("mobility_clause")

    if score >= 4:
        confidence = "confirmed"
        worker_group = "foreign_worker"
    elif score >= 2:
        confidence = "suspected"
        worker_group = "foreign_worker"
    else:
        confidence = "general"
        worker_group = "general"

    return {
        "worker_group": worker_group,
        "worker_group_confidence": confidence,
        "worker_group_score": score,
        "worker_group_reasons": reasons,
        "contract_form_type": contract_form_type,
        "foreign_worker_signals": foreign_worker_signals,
        "dormitory_info": dormitory_info,
        "high_risk_clauses": high_risk_clauses,
    }


def _infer_contract_type(structured: dict, raw_sections: dict, worker_context: dict) -> str:
    """OCR 신호를 종합해 계약서 유형을 추정한다."""
    title = raw_sections.get("contract_title") or ""
    preamble = raw_sections.get("preamble") or ""
    base_contract_type = _detect_contract_type(title, preamble)

    if worker_context.get("worker_group_confidence") == "confirmed":
        return ContractType.FOREIGN_WORKER.value
    if base_contract_type == ContractType.FOREIGN_WORKER.value:
        return ContractType.NO_FIXED_TERM.value
    return base_contract_type


# ── Layer 1 + Layer 2 실행 ────────────────────────────────────────────────────

def _run_layer1(model: GenerativeModel, image_parts: Sequence[Part]) -> dict:
    """Layer 1: 빈칸 구조화 추출."""
    response = model.generate_content(
        _build_contents(image_parts, _LAYER1_PROMPT),
        generation_config=GenerationConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return _parse_json_response(response.text.strip())


def _run_layer2(model: GenerativeModel, image_parts: Sequence[Part]) -> dict:
    """Layer 2: 항목별 원문 추출."""
    response = model.generate_content(
        _build_contents(image_parts, _LAYER2_PROMPT),
        generation_config=GenerationConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return _parse_json_response(response.text.strip())


def _validate_structured(structured: dict, contract_type: str) -> dict:
    """계약서 유형별 스키마와 필수 필드를 기준으로 structured 를 검증한다."""
    schema_cls = SCHEMA_BY_CONTRACT_TYPE.get(contract_type, NoFixedTermContractData)
    required_fields = REQUIRED_FIELDS_BY_CONTRACT_TYPE.get(contract_type, [])
    missing_fields = [field for field in required_fields if not structured.get(field)]

    try:
        schema_cls.model_validate(structured)
        schema_errors: list[dict] = []
    except Exception as exc:
        schema_errors = [{"message": str(exc)}]

    return {
        "passed": not missing_fields and not schema_errors,
        "missing_fields": missing_fields,
        "schema_errors": schema_errors,
    }


# ── 공개 인터페이스 ──────────────────────────────────────────────────────────

def run_pipeline_pages(image_paths: Sequence[str]) -> dict:
    """
    계약서 페이지 경로 목록을 받아 OCR 결과를 반환한다.

    반환값:
        {
            "structured":   {...},           # Layer 1 — 빈칸 구조화
            "raw_sections": {...},           # Layer 2 — 항목 원문
            "_meta": {
                "source_file":   "첫 파일명",
                "source_files":  ["page1.jpg", "page2.jpg"],
                "page_count":    2,
                "contract_type": "계약서 유형",
                "schema_class":  "스키마 클래스명",
                "validation":    {"passed": bool, "missing_fields": [...]}
            }
        }

    ⚠ 절대 규칙: structured 값으로 수치 계산 금지.
                 시간·임금 계산은 raw_sections 에서 직접 파싱할 것.
    """
    if not image_paths:
        raise ValueError("최소 1개 이상의 계약서 페이지가 필요합니다.")

    _init_vertex()
    model = GenerativeModel(VERTEX_MODEL)
    image_parts = [_image_to_part(path) for path in image_paths]

    # Layer 1, Layer 2 순차 실행
    structured = _run_layer1(model, image_parts)
    raw_sections = _normalize_raw_sections(_run_layer2(model, image_parts))

    # 계약서 유형 탐지
    worker_context = _build_worker_group_context(structured, raw_sections)
    contract_type = _infer_contract_type(structured, raw_sections, worker_context)

    schema_cls = SCHEMA_BY_CONTRACT_TYPE.get(contract_type, NoFixedTermContractData)
    validation = _validate_structured(structured, contract_type)

    return {
        "structured":   structured,
        "raw_sections": raw_sections,
        "_meta": {
            "source_file":   Path(image_paths[0]).name,
            "source_files":  [Path(path).name for path in image_paths],
            "page_count":    len(image_paths),
            "contract_type": contract_type,
            "worker_group": worker_context["worker_group"],
            "worker_group_confidence": worker_context["worker_group_confidence"],
            "worker_group_score": worker_context["worker_group_score"],
            "worker_group_reasons": worker_context["worker_group_reasons"],
            "contract_form_type": worker_context["contract_form_type"],
            "foreign_worker_signals": worker_context["foreign_worker_signals"],
            "dormitory_info": worker_context["dormitory_info"],
            "high_risk_clauses": worker_context["high_risk_clauses"],
            "schema_class":  schema_cls.__name__,
            "validation":    validation,
        },
    }


def run_pipeline(image_path: str) -> dict:
    """단일 파일 입력용 하위 호환 래퍼."""
    return run_pipeline_pages([image_path])
