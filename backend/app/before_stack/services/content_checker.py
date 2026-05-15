"""
content_checker.py — Phase B-4 (LLM 내용 검토)
표준 항목 + extra 항목에 대해 LLM 으로 위법 소지를 판단한다.

규칙:
    - LLM 은 "위반 여부 판단"만 담당 — 수치 계산은 절대 위임 금지
    - 표준 항목: standard_content_pattern 기준 비표준 문구 탐지 + 법령 위반 판단
    - extra 항목: extra_law_map 기반 위법 소지 판단
    - asyncio.gather 로 전체 항목 병렬 처리

사용:
    from backend.app.before_stack.services.content_checker import check_all_sections, summarize_content_results
    content_result = await check_all_sections(output, standard_map, role_mapping, rule_results, llm_client)
"""

# TODO(외국인근로자 표준서식 정합성 보강 — 미구현 메모)
# - 현재 사전 계산 결과 주입 매핑(_ROLE_TO_RULE_KEY)은 일반형 role 이름을 기준으로만 연결된다.
# - 외국인근로자 표준서식을 공식 형태로 유지할 경우 아래 보강이 필요하다.
#   1. "근로시간" -> "working_hours" 연결 추가
#   2. "휴게시간" 또는 외국인 전용 휴게 검토 결과를 프롬프트에 주입하는 방식 검토
#   3. "휴일" -> break/휴일 관련 사전 검토 결과를 어떻게 연결할지 정의 필요
#   4. "임금지급일" -> payment_day 결과를 직접 주입하도록 매핑 추가
# - 위 내용은 아직 구현하지 않았고, 현재 파일은 기존 동작을 그대로 유지한다.

from __future__ import annotations

import asyncio
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.app.before_stack.services.llm_client import BaseLLMClient


# ── 시스템 프롬프트 ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT_STANDARD_GENERAL = """당신은 한국 노동법 전문가입니다.
근로계약서의 특정 항목이 관련 법령을 위반하거나 비표준 문구를 포함하는지 판단합니다.

규칙:
1. 주어진 사전 계산 결과(최저임금, 근무시간 등)는 재계산하지 마세요.
2. 숫자 계산은 하지 말고, 법적 판단만 하세요.
3. 실질적인 권리·의무·금액·시간·휴일·휴게·지급조건 판단을 형식 차이보다 우선하세요.
4. 단순한 표기 방식, 괄호 모양, 체크박스 모양, 줄바꿈 차이만으로는 문제를 크게 보지 마세요.
5. 형식 차이를 지적하더라도 그 차이가 법적 의미나 해석에 영향을 줄 때만 issue 로 적으세요.
6. 비표준 문구가 있더라도 법령 위반이 아니면 WARNING 으로 처리하세요.
7. 불명확한 경우 confidence 를 LOW 로 설정하세요.

응답 JSON 형식:
{
  "status": "PASS" | "WARNING" | "VIOLATION",
  "severity": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "is_non_standard": true/false,
  "worker_group": "general" | "foreign_worker",
  "issue_type": "standard_form_misuse" | "dormitory_missing_info" | "passport_custody" | "mobility_restriction" | "liquidated_damages" | "blanket_company_rules" | "wage_deduction_risk" | "mandatory_terms_missing" | "other",
  "risk_bucket": "immediate_illegal" | "mandatory_missing" | "deduction_risk" | "enforceability_risk" | "other",
  "issues": [
    {
      "description": "문제 설명 (한국어)",
      "law_ref": "근로기준법 제N조 (조문 제목)",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "issue_type": "위와 동일 형식",
      "risk_bucket": "위와 동일 형식"
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}"""

_SYSTEM_PROMPT_STANDARD_FOREIGN = _SYSTEM_PROMPT_STANDARD_GENERAL.replace(
    "7. 불명확한 경우 confidence 를 LOW 로 설정하세요.",
    "7. 불명확한 경우 confidence 를 LOW 로 설정하세요.\n"
    "8. 외국인 근로자 계약서로 보이면 다음 위험을 우선적으로 본다: 표준근로계약서 미사용, 숙식/기숙사 정보 누락, 여권·외국인등록증 보관, 사업장 변경 제한, 손해배상 예정, 포괄적 회사 규정 우선."
)

_SYSTEM_PROMPT_EXTRA_GENERAL = """당신은 한국 노동법 전문가입니다.
표준 근로계약서에 없는 추가 조항이 법령을 위반하는지 판단합니다.

규칙:
1. 표준 근로계약서에 없는 조항임을 반드시 명시하세요 (is_non_standard: true).
2. 실질적인 권리 제한, 임금 감액, 근로시간, 휴일, 위약금, 손해배상 예정 같은 내용 위험을 우선 판단하세요.
3. 금지되거나 위법 소지가 있는 조항이면 VIOLATION 또는 WARNING 으로 판단하세요.
4. 법적 문제가 없는 추가 조항이면 WARNING (주의 권고) 수준으로 처리하세요.
5. 수치 계산은 하지 마세요.

응답 JSON 형식:
{
  "status": "PASS" | "WARNING" | "VIOLATION",
  "severity": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "is_non_standard": true,
  "worker_group": "general" | "foreign_worker",
  "issue_type": "standard_form_misuse" | "dormitory_missing_info" | "passport_custody" | "mobility_restriction" | "liquidated_damages" | "blanket_company_rules" | "wage_deduction_risk" | "mandatory_terms_missing" | "other",
  "risk_bucket": "immediate_illegal" | "mandatory_missing" | "deduction_risk" | "enforceability_risk" | "other",
  "comment": "이 조항에 대한 한 문장 요약",
  "issues": [
    {
      "description": "문제 설명 (한국어)",
      "law_ref": "근로기준법 제N조 (조문 제목)",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "issue_type": "위와 동일 형식",
      "risk_bucket": "위와 동일 형식"
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}"""

_SYSTEM_PROMPT_EXTRA_FOREIGN = _SYSTEM_PROMPT_EXTRA_GENERAL.replace(
    "5. 수치 계산은 하지 마세요.",
    "5. 수치 계산은 하지 마세요.\n"
    "6. 외국인 근로자 계약서로 보이면 다음 위험을 우선적으로 본다: 표준근로계약서 미사용, 숙식/기숙사 정보 누락, 여권·외국인등록증 보관, 사업장 변경 제한, 손해배상 예정, 포괄적 회사 규정 우선."
)


# ── 표준 항목 프롬프트 생성 ────────────────────────────────────────────────────

def _build_standard_section_prompt(
    sec_no: str,
    section: dict,
    std_info: dict,
    rule_results: dict,
    extra_law_map: dict,
) -> str:
    """
    표준 항목 검토용 유저 프롬프트 생성.

    Q1. related_articles 기준 법령 위반 여부
    Q2. standard_content_pattern 기준 비표준 문구 존재 여부
    """
    title    = std_info.get("title", "")
    pattern  = std_info.get("standard_content_pattern", "")
    articles = std_info.get("related_articles", [])

    # 관련 법 조문 텍스트 구성
    articles_text = "\n\n".join(
        f"[{a['citation_label']}]\n{a['content_normalized'][:400]}"
        for a in articles[:5]
    )

    # 사전 계산 결과 (rule_validator 에서 이미 계산된 값)
    pre_calc_text = ""
    if sec_no in _RULE_SECTION_MAP:
        pre_calc_lines: list[str] = []
        for rule_key in _RULE_SECTION_MAP[sec_no]:
            rule_data = rule_results.get(rule_key, {})
            if rule_data:
                pre_calc_lines.append(f"- {rule_key}: {rule_data.get('message', '')}")
        if pre_calc_lines:
            pre_calc_text = "\n[사전 계산 결과 — 재계산 금지]\n" + "\n".join(pre_calc_lines)

    # extra_law_map 에 해당 섹션 있으면 추가 조문 포함
    extra_law_text = ""
    if sec_no in extra_law_map:
        extra_chunks = extra_law_map[sec_no]
        if extra_chunks:
            extra_law_text = "\n\n[비표준 문구 관련 추가 조문]\n" + "\n\n".join(
                f"[{c['citation_label']}]\n{c['content_normalized'][:300]}"
                for c in extra_chunks[:3]
            )

    return f"""## 검토 대상
항목 번호: {sec_no}
항목 제목: {title}
표준 서식 참고:
{pattern}

## 계약서 원문
{section.get('full_text', '')}
{pre_calc_text}

## 관련 법령
{articles_text}
{extra_law_text}

## 판단 요청
1. 먼저 임금, 근로시간, 휴게, 휴일, 지급조건, 수습, 권리 제한 등 실질 내용이 법령을 위반하는지 판단하라.
2. 사전 계산 결과가 있으면 그 내용을 우선 신뢰하고, 재계산하지 말고 법적 의미만 해석하라.
3. 그 다음 표준 서식과 다른 비표준 문구가 있는지 보되, 단순한 표기/서식 차이는 낮은 우선순위로 다뤄라.
4. 형식 차이는 그것이 법적 의미나 해석상 불이익을 만들 때만 issue 로 적어라."""


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def _contains_all(text: str, snippets: list[str]) -> bool:
    normalized = _normalize_text(text)
    return all(_normalize_text(snippet) in normalized for snippet in snippets)


def _clip_evidence(text: str, anchor: str, width: int = 120) -> str:
    index = text.find(anchor)
    if index < 0:
        return anchor
    start = max(0, index - width // 3)
    end = min(len(text), index + len(anchor) + width)
    return text[start:end].strip()


def _postprocess_standard_result(
    sec_no: str,
    section: dict,
    std_info: dict,
    result: dict,
) -> dict:
    """LLM 결과 중 확정적으로 틀린 형식성 오판을 규칙 기반으로 교정한다."""
    title = std_info.get("title", "")
    full_text = section.get("full_text", "")
    issues = result.get("issues", [])

    holiday_snippets = [
        "공휴일(대체공휴일 포함)은 근로기준법이 정하는 바에 따르며",
        "근로자의 날은 유급휴일로 함",
    ]
    if title in ("근로일 및 근로일별 근로시간", "소정근로시간") and _contains_all(full_text, holiday_snippets):
        filtered_issues = []
        for issue in issues:
            description = issue.get("description", "")
            if "공휴일" in description and "누락" in description:
                continue
            filtered_issues.append(issue)

        if len(filtered_issues) != len(issues):
            if not filtered_issues:
                result["status"] = "PASS"
                result["severity"] = "NONE"
                result["is_non_standard"] = False
            result["issues"] = filtered_issues
            result["evidence_excerpt"] = _clip_evidence(full_text, "공휴일(대체공휴일 포함)")

    return result


def _is_foreign_worker_context(text: str) -> bool:
    return any(keyword in (text or "") for keyword in (
        "외국인", "국적", "여권", "외국인등록", "E-9", "비자", "숙소", "기숙사", "귀국비용",
    ))


def _is_confirmed_foreign_worker(worker_context: dict | None) -> bool:
    if not worker_context:
        return False
    return (
        worker_context.get("worker_group") == "foreign_worker"
        and worker_context.get("worker_group_confidence") == "confirmed"
    )


def _pick_system_prompt(prompt_type: str, worker_context: dict | None) -> str:
    is_confirmed_foreign = _is_confirmed_foreign_worker(worker_context)
    if prompt_type == "standard":
        return _SYSTEM_PROMPT_STANDARD_FOREIGN if is_confirmed_foreign else _SYSTEM_PROMPT_STANDARD_GENERAL
    return _SYSTEM_PROMPT_EXTRA_FOREIGN if is_confirmed_foreign else _SYSTEM_PROMPT_EXTRA_GENERAL


def _classify_issue_type(text: str, law_ref: str | None) -> str:
    normalized = (text or "").replace(" ", "")
    ref = (law_ref or "").replace(" ", "")

    if any(keyword in normalized for keyword in ("표준근로계약서", "표준서식미사용", "자체양식")):
        return "standard_form_misuse"
    if any(keyword in normalized for keyword in ("여권보관", "외국인등록증보관", "신분증보관")):
        return "passport_custody"
    if any(keyword in normalized for keyword in ("사업장변경", "이직", "사업장이탈")):
        if any(keyword in normalized for keyword in ("제한", "금지", "배상", "손해")):
            return "mobility_restriction"
    if any(keyword in normalized for keyword in ("손해배상", "위약금", "배상한다")):
        return "liquidated_damages"
    if any(keyword in normalized for keyword in ("숙소", "기숙사", "숙식", "숙박시설", "비닐하우스", "가건물")):
        if any(keyword in normalized for keyword in ("누락", "없", "별도안내", "미고지", "공제")):
            return "dormitory_missing_info"
    if any(keyword in normalized for keyword in ("공제", "제반공제", "숙소비", "기숙사비", "식비")):
        return "wage_deduction_risk"
    if any(keyword in normalized for keyword in ("회사규정", "내부규정", "규정일체에동의", "회사규정에따른다")):
        return "blanket_company_rules"
    if "근로기준법제17조" in ref or any(keyword in normalized for keyword in ("미명시", "누락", "불명확", "명확히기재")):
        return "mandatory_terms_missing"
    return "other"


def _classify_risk_bucket(issue_type: str) -> str:
    if issue_type in {"passport_custody", "mobility_restriction", "liquidated_damages", "standard_form_misuse"}:
        return "immediate_illegal"
    if issue_type in {"dormitory_missing_info", "wage_deduction_risk"}:
        return "deduction_risk"
    if issue_type in {"blanket_company_rules"}:
        return "enforceability_risk"
    if issue_type in {"mandatory_terms_missing"}:
        return "mandatory_missing"
    return "other"


def _append_heuristic_issue(result: dict, description: str, law_ref: str, severity: str, issue_type: str) -> None:
    issues = result.setdefault("issues", [])
    if any(issue.get("issue_type") == issue_type for issue in issues):
        return
    issues.append({
        "description": description,
        "law_ref": law_ref,
        "severity": severity,
        "issue_type": issue_type,
        "risk_bucket": _classify_risk_bucket(issue_type),
    })
    current_status = result.get("status", "PASS")
    current_severity = result.get("severity", "NONE")
    result["status"] = "VIOLATION" if severity in {"HIGH", "CRITICAL"} else ("WARNING" if current_status == "PASS" else current_status)
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
    if severity_order.get(severity, 99) < severity_order.get(current_severity, 99):
        result["severity"] = severity


def _enrich_result(sec_no: str, title: str, full_text: str, result: dict, worker_context: dict | None = None) -> dict:
    """LLM 결과에 외국인 계약서용 분류 필드와 휴리스틱 이슈를 보강한다."""
    combined = f"{title}\n{full_text}"
    worker_group = (
        worker_context.get("worker_group")
        if worker_context and worker_context.get("worker_group") in {"general", "foreign_worker"}
        else ("foreign_worker" if _is_foreign_worker_context(combined) else "general")
    )
    result["worker_group"] = result.get("worker_group", worker_group)

    if _is_confirmed_foreign_worker(worker_context) and "여권" in combined and any(keyword in combined for keyword in ("보관", "회사 보관", "사업주 보관")):
        _append_heuristic_issue(
            result,
            "회사가 여권이나 외국인등록증을 보관하는 조항은 근로자의 이동과 퇴직의 자유를 침해할 수 있는 중대한 위험 조항입니다.",
            "근로기준법 제7조 (강제 근로의 금지)",
            "CRITICAL",
            "passport_custody",
        )

    if _is_confirmed_foreign_worker(worker_context) and any(keyword in combined for keyword in ("이직", "사업장 변경", "사업장을 이탈", "사업장 이탈")) and any(
        keyword in combined for keyword in ("손해", "배상", "금지", "제한")
    ):
        _append_heuristic_issue(
            result,
            "이직이나 사업장 변경을 제한하고 손해배상을 예정하는 조항은 근로자의 이동 자유를 과도하게 제한할 소지가 큽니다.",
            "근로기준법 제20조 (위약 예정의 금지)",
            "CRITICAL",
            "mobility_restriction",
        )

    if _is_confirmed_foreign_worker(worker_context) and any(keyword in combined for keyword in ("숙소", "기숙사", "숙박시설")) and any(
        keyword in combined for keyword in ("별도 안내", "추후 안내", "입사 후 안내")
    ):
        _append_heuristic_issue(
            result,
            "숙소·기숙사 위치, 환경, 비용 공제 기준을 서면에 적지 않고 별도 안내로 돌리는 것은 추후 과도한 공제와 열악한 숙소 배정 위험을 키웁니다.",
            "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등)",
            "HIGH",
            "dormitory_missing_info",
        )

    if any(keyword in combined for keyword in ("회사 규정", "내부 규정", "규정 일체에 동의", "회사 규정에 따른다")):
        _append_heuristic_issue(
            result,
            "회사 내부 규정을 포괄적으로 우선시키는 조항은 근로조건을 불명확하게 만들고 사용자에게 지나치게 유리하게 해석될 수 있습니다.",
            "근로기준법 제4조 (근로조건의 결정)",
            "MEDIUM",
            "blanket_company_rules",
        )

    issues = result.get("issues") or []
    for issue in issues:
        issue_type = issue.get("issue_type") or _classify_issue_type(
            f"{title} {issue.get('description', '')}",
            issue.get("law_ref"),
        )
        issue["issue_type"] = issue_type
        issue["risk_bucket"] = issue.get("risk_bucket") or _classify_risk_bucket(issue_type)

    top_issue = issues[0] if issues else {}
    top_issue_type = top_issue.get("issue_type") or _classify_issue_type(
        f"{title} {top_issue.get('description', '')} {result.get('comment', '')}",
        top_issue.get("law_ref"),
    )
    result["issue_type"] = result.get("issue_type", top_issue_type)
    result["risk_bucket"] = result.get("risk_bucket", _classify_risk_bucket(result["issue_type"]))

    return result


# ── extra 항목 프롬프트 생성 ──────────────────────────────────────────────────

def _build_extra_section_prompt(
    sec_no: str,
    extra_sec: dict,
    law_chunks: list[dict],
) -> str:
    """extra 항목 검토용 유저 프롬프트 생성."""
    law_text = "\n\n".join(
        f"[{c['citation_label']}]\n{c['content_normalized'][:400]}"
        for c in law_chunks[:5]
    ) if law_chunks else "관련 법령 조문을 찾지 못했습니다."

    return f"""## 검토 대상 (표준 계약서에 없는 추가 조항)
항목 번호: {sec_no}
항목 제목: {extra_sec.get('title', '')}

## 계약서 원문
{extra_sec.get('full_text', '')}

## 관련 법령
{law_text}

## 판단 요청
이 조항이 위 관련 법령을 위반하거나 위법 소지가 있는가?
표준 근로계약서에 없는 조항임을 명시하고 위법 여부를 판단하라."""


# ── role_mapping 기반 섹션 번호 → 검사 키 매핑 ───────────────────────────────
# rule_validator 에서 계산된 결과를 프롬프트에 주입할 때 사용

_ROLE_TO_RULE_KEYS: dict[str, list[str]] = {
    "소정근로시간": ["working_hours", "break_time"],
    "근로일 및 근로일별 근로시간": ["working_hours", "break_time"],
    "근로시간": ["working_hours", "break_time"],
    "임금": ["minimum_wage", "payment_day"],
    "임금지급일": ["payment_day"],
    "근무일/휴일": ["break_time"],
}

# 역매핑을 위해 섹션 번호 기반 임시 딕셔너리 (run 시점에 채워짐)
_RULE_SECTION_MAP: dict[str, list[str]] = {}


def _populate_rule_section_map(role_mapping: dict) -> None:
    """role_mapping 에서 섹션 번호 → rule 키 매핑을 채운다."""
    _RULE_SECTION_MAP.clear()
    for role, rule_keys in _ROLE_TO_RULE_KEYS.items():
        sec_no = role_mapping.get(role)
        if sec_no:
            _RULE_SECTION_MAP.setdefault(sec_no, [])
            for rule_key in rule_keys:
                if rule_key not in _RULE_SECTION_MAP[sec_no]:
                    _RULE_SECTION_MAP[sec_no].append(rule_key)


# ── 개별 섹션 LLM 호출 ────────────────────────────────────────────────────────

async def _check_standard_section(
    sec_no: str,
    section: dict,
    std_info: dict,
    rule_results: dict,
    extra_law_map: dict,
    llm_client: "BaseLLMClient",
    worker_context: dict | None,
) -> tuple[str, dict]:
    """표준 항목 하나를 LLM 으로 검토하고 (sec_no, result) 를 반환."""
    user_prompt = _build_standard_section_prompt(
        sec_no, section, std_info, rule_results, extra_law_map
    )
    result = await llm_client.check(_pick_system_prompt("standard", worker_context), user_prompt)
    result = _postprocess_standard_result(sec_no, section, std_info, result)
    result = _enrich_result(sec_no, std_info.get("title", ""), section.get("full_text", ""), result, worker_context)
    result["is_non_standard"] = result.get("is_non_standard", False)
    return sec_no, result


async def _check_extra_section(
    sec_no: str,
    extra_sec: dict,
    law_chunks: list[dict],
    llm_client: "BaseLLMClient",
    worker_context: dict | None,
) -> tuple[str, dict]:
    """extra 항목 하나를 LLM 으로 검토하고 (sec_no, result) 를 반환."""
    user_prompt = _build_extra_section_prompt(sec_no, extra_sec, law_chunks)
    result = await llm_client.check(_pick_system_prompt("extra", worker_context), user_prompt)
    result["is_non_standard"] = True
    if "comment" not in result:
        result["comment"] = f"표준 근로계약서에 없는 조항입니다: {extra_sec.get('title', sec_no)}"
    return sec_no, _enrich_result(sec_no, extra_sec.get("title", ""), extra_sec.get("full_text", ""), result, worker_context)


# ── 전체 검토 통합 ─────────────────────────────────────────────────────────────

async def check_all_sections(
    output: dict,
    standard_map: dict,
    role_mapping: dict,
    rule_results: dict,
    llm_client: "BaseLLMClient",
    extra_law_map: dict | None = None,
) -> dict:
    """
    모든 표준 항목 + extra 항목을 asyncio.gather 로 병렬 검토한다.

    반환:
        {
            "6":  {"status": "PASS", "severity": "NONE", "issues": [], ...},
            "12": {"status": "WARNING", "is_non_standard": True,
                   "comment": "표준 계약서에 없는 조항", "issues": [...], ...},
        }
    """
    contract_type     = output["_meta"]["contract_type"]
    standard_sections = standard_map.get(contract_type, {}).get("sections", {})
    ocr_sections      = output["raw_sections"].get("sections", [])

    _populate_rule_section_map(role_mapping)
    worker_context = {
        "worker_group": output.get("_meta", {}).get("worker_group", "general"),
        "worker_group_confidence": output.get("_meta", {}).get("worker_group_confidence", "general"),
    }

    # extra_law_map 없으면 빈 딕셔너리
    if extra_law_map is None:
        extra_law_map = {}

    # OCR 섹션 번호 인덱스
    ocr_by_number: dict[str, dict] = {s["number"]: s for s in ocr_sections}

    tasks = []

    # 표준 항목 검토
    matched_numbers = set(role_mapping.values())
    for role, sec_no in role_mapping.items():
        std_info = _find_std_info_by_role(standard_sections, role)
        if std_info is None:
            continue
        section = ocr_by_number.get(sec_no)
        if section is None:
            continue
        tasks.append(
            _check_standard_section(
                sec_no, section, std_info, rule_results, extra_law_map, llm_client, worker_context
            )
        )

    # extra 항목 검토
    extra_sections = [s for s in ocr_sections if s["number"] not in matched_numbers]
    for extra_sec in extra_sections:
        sec_no     = extra_sec["number"]
        law_chunks = extra_law_map.get(sec_no, [])
        tasks.append(
            _check_extra_section(sec_no, extra_sec, law_chunks, llm_client, worker_context)
        )

    # 병렬 실행
    results_list = await asyncio.gather(*tasks)

    return {sec_no: result for sec_no, result in results_list}


def _find_std_info_by_role(standard_sections: dict, role: str) -> dict | None:
    """표준 섹션에서 제목(role) 이 일치하는 항목 정보를 반환."""
    for sec_info in standard_sections.values():
        if sec_info.get("title") == role:
            return sec_info
    return None


# ── 결과 요약 ─────────────────────────────────────────────────────────────────

def summarize_content_results(content_result: dict) -> dict:
    """
    content_result 를 요약해 overall_status, overall_severity, 위반/주의 섹션 목록을 반환.

    반환:
        {
            "overall_status":     "VIOLATION" | "WARNING" | "PASS",
            "overall_severity":   "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
            "violation_sections": ["6", "12", ...],
            "warning_sections":   ["7", ...],
        }
    """
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
    status_order   = {"VIOLATION": 0, "WARNING": 1, "PASS": 2}

    overall_status   = "PASS"
    overall_severity = "NONE"
    violation_sections: list[str] = []
    warning_sections: list[str]   = []

    for sec_no, res in content_result.items():
        status   = res.get("status", "PASS")
        severity = res.get("severity", "NONE")

        if status_order.get(status, 99) < status_order.get(overall_status, 99):
            overall_status = status
        if severity_order.get(severity, 99) < severity_order.get(overall_severity, 99):
            overall_severity = severity

        if status == "VIOLATION":
            violation_sections.append(sec_no)
        elif status == "WARNING":
            warning_sections.append(sec_no)

    return {
        "overall_status":     overall_status,
        "overall_severity":   overall_severity,
        "violation_sections": sorted(violation_sections),
        "warning_sections":   sorted(warning_sections),
    }
