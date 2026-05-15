"""사용자에게 보여줄 쉬운 설명과 마크다운을 deterministic 하게 생성한다."""

from __future__ import annotations

from typing import Any


_CONTENT_SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
_RISK_BUCKET_ORDER = {
    "immediate_illegal": 0,
    "mandatory_missing": 1,
    "deduction_risk": 2,
    "enforceability_risk": 3,
    "other": 4,
}

_RULE_TITLE_MAP = {
    "minimum_wage": "임금 조항",
    "working_hours": "근로시간 조항",
    "break_time": "휴게시간 조항",
    "payment_day": "임금 지급일 조항",
}

_RULE_LAW_REF_MAP = {
    "minimum_wage": "최저임금법 제6조 (최저임금의 효력)",
    "working_hours": "근로기준법 제17조 (근로조건의 명시)",
    "break_time": "근로기준법 제54조 (휴게)",
    "payment_day": "근로기준법 제43조 (임금 지급)",
}

_CONTENT_EXCLUDE_PHRASES = (
    "비표준 문구",
    "표준 서식",
    "참고 사항",
    "완전성을 저해",
    "포괄적인 표현",
    "혼란을 야기할 가능성이 있는 비표준 문구",
)


def _is_confirmed_foreign_worker(snapshot_meta: dict) -> bool:
    return (
        snapshot_meta.get("worker_group") == "foreign_worker"
        and snapshot_meta.get("worker_group_confidence") == "confirmed"
    )


def _format_number(value: Any) -> str | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.2f}"


def _format_hours(value: Any) -> str | None:
    formatted = _format_number(value)
    if formatted is None:
        return None
    return f"{formatted}시간"


def _format_won(value: Any) -> str | None:
    formatted = _format_number(value)
    if formatted is None:
        return None
    return f"{formatted}원"


def _headline(overall_result: str, overall_severity: str) -> str:
    if overall_result == "PASS":
        return "큰 문제 없이 검토를 통과했습니다."
    if overall_severity in {"CRITICAL", "HIGH"}:
        return "수정이 필요한 계약서입니다."
    return "추가 확인이 필요한 계약서입니다."


def _build_section_title_map(contract_type: str, standard_map: dict, section_result: dict) -> dict[str, str]:
    title_map: dict[str, str] = {}

    contract_standard = standard_map.get(contract_type, {})
    sections = contract_standard.get("sections", {}) if isinstance(contract_standard, dict) else {}
    for number, item in sections.items():
        if isinstance(item, dict):
            title_map[str(number)] = item.get("title", str(number))

    for item in section_result.get("extra", []):
        title_map[str(item.get("number"))] = item.get("title", str(item.get("number")))

    for item in section_result.get("mismatches", []):
        number = str(item.get("number"))
        actual_title = item.get("actual_title")
        if actual_title:
            title_map[number] = actual_title

    return title_map


def _build_plain_summary(
    contract_info: dict,
    rule_result: dict,
    section_result: dict,
    content_points: list[dict],
    ocr_snapshot: dict,
) -> str:
    employee = contract_info.get("employee") or "근로자"
    contract_type = contract_info.get("type") or "근로계약서"
    snapshot_meta = ocr_snapshot.get("meta", {})

    summary_parts: list[str] = []
    issue_types = {item.get("issue_type") for item in content_points}
    is_confirmed_foreign = _is_confirmed_foreign_worker(snapshot_meta)
    if is_confirmed_foreign and contract_type == "외국인근로자" and (
        "standard_form_misuse" in issue_types or snapshot_meta.get("contract_form_type") == "custom_form"
    ):
        summary_parts.append("외국인 근로자 표준근로계약서가 아닌 자체 양식으로 보여 필수 보호 조항 누락 위험이 큽니다.")
    if is_confirmed_foreign and ("dormitory_missing_info" in issue_types or (
        snapshot_meta.get("dormitory_info", {}).get("provided")
        and not snapshot_meta.get("dormitory_info", {}).get("written_disclosed", True)
    )):
        summary_parts.append("기숙사·숙소 정보와 공제 기준이 서면에 명확하지 않아 추후 숙소비 공제 분쟁 위험이 큽니다.")
    if is_confirmed_foreign and (issue_types & {"passport_custody", "mobility_restriction", "liquidated_damages"} or any(
        snapshot_meta.get("high_risk_clauses", {}).get(key)
        for key in ("passport_custody", "mobility_restriction", "liquidated_damages")
    )):
        summary_parts.append("여권 보관이나 이직 제한처럼 즉시 시정이 필요한 권리 제한 조항이 포함된 것으로 보입니다.")

    minimum_wage = rule_result.get("minimum_wage", {})
    if minimum_wage.get("status") == "VIOLATION":
        stated = _format_won(minimum_wage.get("stated_amount"))
        minimum = _format_won(minimum_wage.get("min_hourly"))
        minimum_wage_year = minimum_wage.get("minimum_wage_year")
        minimum_label = (
            f"{minimum_wage_year}년 최저임금 {minimum}"
            if minimum_wage_year else
            f"최저임금 {minimum}"
        )
        summary_parts.append(
            f"임금 조항에서는 계약서상 시급 {stated}이 {minimum_label}보다 낮아 바로 수정이 필요합니다."
        )

    content_titles = {item["title"] for item in content_points}
    if any("근로일 및 근로일별 근로시간 조항" == title for title in content_titles):
        summary_parts.append("근로시간·휴일 조항은 주휴일이나 휴일 조건이 충분히 명확하지 않아 추가 보완이 필요합니다.")

    if any("수습기간" in title for title in content_titles):
        summary_parts.append("수습기간 특약은 제목과 내용이 어긋나거나 최저임금 예외 요건을 다시 확인해야 하는 상태입니다.")

    missing = len(section_result.get("missing", []))
    extra = len(section_result.get("extra", []))
    if missing or extra:
        summary_parts.append(
            f"표준 계약서와 비교하면 누락 항목 {missing}개, 추가 항목 {extra}개가 있어 전체 형식도 함께 점검해야 합니다."
        )

    if not summary_parts:
        summary_parts.append("현재 검토 결과 기준으로 큰 문제는 보이지 않지만, 실제 근무조건과 계약서 내용이 일치하는지는 계속 확인이 필요합니다.")

    return f"{employee} 님의 {contract_type} 계약서를 검토한 결과, " + " ".join(summary_parts[:4])


def _build_overall_assessment(
    rule_result: dict,
    section_result: dict,
    content_points: list[dict],
    ocr_snapshot: dict,
) -> list[str]:
    assessment: list[str] = []
    content_titles = {item["title"] for item in content_points}
    issue_types = {item.get("issue_type") for item in content_points}
    snapshot_meta = ocr_snapshot.get("meta", {})
    is_confirmed_foreign = _is_confirmed_foreign_worker(snapshot_meta)

    minimum_wage = rule_result.get("minimum_wage", {})
    if minimum_wage.get("status") == "VIOLATION":
        minimum_wage_year = minimum_wage.get("minimum_wage_year")
        min_hourly = _format_won(minimum_wage.get("min_hourly"))
        if minimum_wage_year and min_hourly:
            assessment.append(f"임금 수준은 {minimum_wage_year}년 최저임금 기준인 시간당 {min_hourly}에 미달하는 것으로 확인됐습니다.")
        else:
            assessment.append("임금 수준은 최저임금 기준에 미달하는 것으로 확인됐습니다.")
    if any(rule_result.get(key, {}).get("status") == "WARNING" for key in ("working_hours", "break_time", "payment_day")):
        assessment.append("근로시간, 휴게시간, 임금 지급일 중 일부는 기재 방식이 불명확하거나 추가 확인이 필요합니다.")
    if "근로일 및 근로일별 근로시간 조항" in content_titles:
        assessment.append("근로시간·휴일 관련 조항은 주휴일과 휴일 조건을 더 분명하게 적는 것이 좋습니다.")
    if any("수습기간" in title for title in content_titles):
        assessment.append("수습기간 특약은 최저임금 예외 요건과 표현의 명확성을 함께 점검해야 합니다.")
    if is_confirmed_foreign and ("standard_form_misuse" in issue_types or snapshot_meta.get("contract_form_type") == "custom_form"):
        assessment.append("외국인 근로자 계약서는 표준근로계약서 사용 여부 자체가 중요한 보호 장치이므로 서식 적합성을 먼저 확인해야 합니다.")
    if is_confirmed_foreign and ("dormitory_missing_info" in issue_types or (
        snapshot_meta.get("dormitory_info", {}).get("provided")
        and not snapshot_meta.get("dormitory_info", {}).get("written_disclosed", True)
    )):
        assessment.append("기숙사 제공 조건과 비용 공제 기준이 서면으로 정리되지 않아 추후 부당 공제와 열악한 숙소 배정 위험이 있습니다.")
    if is_confirmed_foreign and (issue_types & {"passport_custody", "mobility_restriction", "liquidated_damages"} or any(
        snapshot_meta.get("high_risk_clauses", {}).get(key)
        for key in ("passport_custody", "mobility_restriction", "liquidated_damages")
    )):
        assessment.append("여권 보관, 사업장 변경 제한, 손해배상 예정 같은 조항은 즉시 위법 여부를 따져야 하는 핵심 위험입니다.")
    if section_result.get("missing") or section_result.get("extra"):
        assessment.append("표준 계약서와 다른 항목이 있어 계약서 형식과 내용이 함께 수정돼야 합니다.")

    if not assessment:
        assessment.append("핵심 근로조건은 현재 기준으로 큰 문제 없이 기재된 것으로 보입니다.")
    return assessment[:4]


def _build_rule_points(rule_result: dict) -> list[dict]:
    points: list[dict] = []
    for key in ("minimum_wage", "working_hours", "break_time", "payment_day"):
        item = rule_result.get(key, {})
        if item.get("status") == "PASS":
            continue
        description = item.get("message", f"{_RULE_TITLE_MAP[key]} 관련 확인이 필요합니다.")
        if key == "minimum_wage" and item.get("minimum_wage_year"):
            description = (
                f"적용 기준: {item['minimum_wage_year']}년 최저임금. "
                f"{description}"
            )
        points.append({
            "title": _RULE_TITLE_MAP[key],
            "status": item.get("status"),
            "severity": item.get("severity", "MEDIUM"),
            "law_ref": _RULE_LAW_REF_MAP[key],
            "issue_type": "mandatory_terms_missing",
            "risk_bucket": "mandatory_missing",
            "description": description,
        })
    return points


def _should_include_content_point(
    section_no: str,
    result: dict,
    description: str,
    law_ref: str | None,
    risk_bucket: str | None,
    rule_result: dict,
) -> bool:
    status = result.get("status", "PASS")
    severity = result.get("severity", "MEDIUM")

    if status == "PASS":
        return False

    if str(section_no) == "5" and rule_result.get("minimum_wage", {}).get("status") != "PASS":
        return False

    normalized = description.strip()
    if not normalized:
        return False

    if risk_bucket in {"immediate_illegal", "deduction_risk"}:
        return True

    if any(phrase in normalized for phrase in _CONTENT_EXCLUDE_PHRASES):
        return False

    section_no = str(section_no)
    if section_no == "4":
        return any(keyword in normalized for keyword in ("주휴", "공휴일", "근로자의 날", "휴일", "근로조건 명시"))
    if section_no == "5-1":
        return any(keyword in normalized for keyword in ("수습", "최저임금", "감액"))
    if section_no == "1":
        return any(keyword in normalized for keyword in ("근로계약기간", "근로개시일", "종료일", "기간의 정함"))

    if severity in {"CRITICAL", "HIGH"} and law_ref:
        return True

    return False


def _build_content_points(
    content_result: dict,
    section_title_map: dict[str, str],
    rule_result: dict,
    max_items: int = 6,
) -> list[dict]:
    candidates: list[dict] = []
    for section_no, result in content_result.items():
        status = result.get("status", "PASS")
        if status == "PASS":
            continue

        issues = result.get("issues") or []
        ranked_issues = sorted(
            issues,
            key=lambda issue: (
                _RISK_BUCKET_ORDER.get(issue.get("risk_bucket", "other"), 99),
                _CONTENT_SEVERITY_ORDER.get(issue.get("severity", "MEDIUM"), 99),
                issue.get("law_ref", "") or "",
            ),
        )
        primary_issue = ranked_issues[0] if ranked_issues else {}
        description = primary_issue.get("description") or result.get("comment") or "해당 조항은 추가 확인이 필요합니다."
        law_ref = primary_issue.get("law_ref")
        risk_bucket = primary_issue.get("risk_bucket") or result.get("risk_bucket") or "other"

        if not _should_include_content_point(str(section_no), result, description, law_ref, risk_bucket, rule_result):
            continue

        section_title = section_title_map.get(str(section_no), f"{section_no}항")
        if not section_title.endswith("조항"):
            section_title = f"{section_title} 조항"

        candidates.append({
            "title": section_title,
            "status": status,
            "severity": result.get("severity", "MEDIUM"),
            "law_ref": law_ref,
            "issue_type": primary_issue.get("issue_type") or result.get("issue_type") or "other",
            "risk_bucket": risk_bucket,
            "description": description,
        })

    candidates.sort(
        key=lambda item: (
            _RISK_BUCKET_ORDER.get(item.get("risk_bucket", "other"), 99),
            _CONTENT_SEVERITY_ORDER.get(item["severity"], 99),
            item["title"],
        )
    )
    return candidates[:max_items]


def _build_actions(
    rule_result: dict,
    section_result: dict,
    content_points: list[dict],
    ocr_snapshot: dict,
) -> list[str]:
    actions: list[str] = []
    minimum_wage = rule_result.get("minimum_wage", {})
    snapshot_meta = ocr_snapshot.get("meta", {})
    is_confirmed_foreign = _is_confirmed_foreign_worker(snapshot_meta)
    if minimum_wage.get("status") == "VIOLATION":
        minimum = _format_won(minimum_wage.get("min_hourly"))
        actions.append(f"시간급을 최소 {minimum} 이상으로 수정하세요.")

    content_titles = {item["title"] for item in content_points}
    issue_types = {item.get("issue_type") for item in content_points}
    if "근로일 및 근로일별 근로시간 조항" in content_titles:
        actions.append("주휴일, 공휴일, 근로자의 날 처리 기준을 근로시간 조항에 더 명확히 적어주세요.")
    if is_confirmed_foreign and ("standard_form_misuse" in issue_types or snapshot_meta.get("contract_form_type") == "custom_form"):
        actions.append("외국인 근로자 표준근로계약서 사용 대상인지 먼저 확인하고, 자체 양식이라면 표준 서식 기준으로 다시 작성하세요.")
    if is_confirmed_foreign and ("dormitory_missing_info" in issue_types or (
        snapshot_meta.get("dormitory_info", {}).get("provided")
        and not snapshot_meta.get("dormitory_info", {}).get("written_disclosed", True)
    )):
        actions.append("숙소 위치, 형태, 면적, 비용 공제 금액을 계약서에 서면으로 명확히 적어주세요.")
    if is_confirmed_foreign and (issue_types & {"passport_custody", "mobility_restriction", "liquidated_damages"} or any(
        snapshot_meta.get("high_risk_clauses", {}).get(key)
        for key in ("passport_custody", "mobility_restriction", "liquidated_damages")
    )):
        actions.append("여권 보관, 사업장 변경 제한, 손해배상 예정 조항은 삭제하거나 즉시 법률 검토를 받으세요.")

    if rule_result.get("working_hours", {}).get("status") != "PASS":
        actions.append("하루 근로시간, 주 근무일수, 휴게시간이 서로 맞는지 다시 적어주세요.")
    if rule_result.get("break_time", {}).get("status") != "PASS":
        actions.append("휴게시간을 근로시간 중간에 몇 분 주는지 계약서에 분명히 적어주세요.")
    if rule_result.get("payment_day", {}).get("status") != "PASS":
        actions.append("임금 지급일을 매월 몇 일인지 명확하게 적어주세요.")

    if section_result.get("missing") or section_result.get("extra"):
        actions.append("표준 계약서와 다른 항목이 있는지 확인하고, 불필요한 특약이나 누락된 항목을 정리하세요.")

    if any("수습기간" in title for title in content_titles):
        actions.append("수습기간 감액 조항이 실제로 최저임금 예외 요건을 충족하는지 확인하고, 제목과 내용도 일치시켜 주세요.")

    if not actions:
        actions.append("현재 결과를 기준으로 계약서를 보관하고, 실제 근무조건이 바뀌면 다시 검토하세요.")

    deduped: list[str] = []
    for action in actions:
        if action not in deduped:
            deduped.append(action)
    return deduped[:5]


def _build_evidence(ocr_snapshot: dict, section_result: dict) -> list[dict]:
    evidence: list[dict] = []
    critical_fields = ocr_snapshot.get("critical_fields", {})

    wage = critical_fields.get("wage", {})
    if wage.get("evidence"):
        evidence.append({
            "title": "임금 조항 원문",
            "excerpt": wage["evidence"][:240],
        })

    working_hours = critical_fields.get("working_hours", {})
    if working_hours.get("evidence"):
        evidence.append({
            "title": "근로시간 조항 원문",
            "excerpt": working_hours["evidence"][:240],
        })

    if section_result.get("missing"):
        missing_titles: list[str] = []
        for item in section_result["missing"][:5]:
            if isinstance(item, dict):
                missing_titles.append(
                    item.get("title") or item.get("role") or item.get("section_number") or str(item)
                )
            else:
                missing_titles.append(str(item))
        evidence.append({
            "title": "누락 항목",
            "excerpt": ", ".join(missing_titles),
        })

    for item in section_result.get("extra", [])[:2]:
        title = item.get("title", "")
        excerpt = item.get("full_text", "")[:240]
        if excerpt and any(keyword in excerpt for keyword in ("여권", "손해", "배상", "숙소", "기숙사")):
            evidence.append({
                "title": f"{title} 원문",
                "excerpt": excerpt,
            })

    return evidence[:3]


def _escape_markdown(text: str) -> str:
    return text.replace("\r\n", "\n").strip()


def _format_point_markdown(item: dict) -> str:
    law_ref = item.get("law_ref")
    if law_ref:
        return f"- **{item['title']}** (`{law_ref}`): {_escape_markdown(item['description'])}"
    return f"- **{item['title']}**: {_escape_markdown(item['description'])}"


def _build_ui_guide_comment() -> list[str]:
    return [
        "<!--",
        "UI_RENDER_GUIDE",
        "- headline: 최상단 hero/banner 영역으로 렌더링. overall_result 와 severity 배지를 함께 표시.",
        "- 전체 평가: 1개 요약 문단 + bullet 3~4개를 카드뉴스형 summary cards 로 표시. 모바일은 세로 스택, 데스크톱은 2열 또는 4칸 그리드 권장.",
        "- 조항별 설명: 각 bullet 을 issue card 로 렌더링. title 은 카드 제목, law_ref 는 법 조항 chip 또는 subtitle 로 표시.",
        "- 권장 조치: 체크리스트 카드 또는 action list 로 표시. 사용자가 바로 수정 포인트를 볼 수 있게 상단 고정 요약에 재사용 가능.",
        "- 근거: 기본은 접힌(toggle/accordion) 상태로 렌더링. 사용자가 눌렀을 때만 원문 발췌를 펼치도록 권장.",
        "- SECTION 주석은 웹에서 블록 단위 파싱이나 후처리에 사용할 수 있음.",
        "-->",
        "",
    ]


def _build_markdown(explanation: dict) -> str:
    lines: list[str] = _build_ui_guide_comment() + [
        "<!-- SECTION: HEADLINE -->",
        f"# {explanation['headline']}",
        "",
        "<!-- SECTION: OVERVIEW -->",
        "## 전체 평가",
        "",
        explanation["plain_language_summary"],
        "",
    ]

    overall_assessment = explanation.get("overall_assessment", [])
    for item in overall_assessment:
        lines.append(f"- {_escape_markdown(item)}")
    lines.append("")

    important_points = explanation.get("important_points", [])
    if important_points:
        lines.extend([
            "<!-- SECTION: ISSUE_CARDS -->",
            "## 조항별 설명",
            "",
        ])
        for item in important_points:
            lines.append(_format_point_markdown(item))
        lines.append("")

    recommended_actions = explanation.get("recommended_actions", [])
    if recommended_actions:
        lines.extend([
            "<!-- SECTION: ACTIONS -->",
            "## 권장 조치",
            "",
        ])
        for action in recommended_actions:
            lines.append(f"- {_escape_markdown(action)}")
        lines.append("")

    evidence = explanation.get("evidence", [])
    if evidence:
        lines.extend([
            "<!-- SECTION: EVIDENCE_TOGGLE -->",
            "## 근거",
            "",
        ])
        for item in evidence:
            lines.append(f"### {item['title']}")
            lines.append("")
            lines.append("```text")
            lines.append(_escape_markdown(item["excerpt"]))
            lines.append("```")
            lines.append("")

    return "\n".join(lines).strip()


def build_user_explanation(
    contract_info: dict,
    overall_result: str,
    overall_severity: str,
    section_result: dict,
    rule_result: dict,
    content_result: dict,
    ocr_snapshot: dict,
    standard_map: dict,
) -> dict:
    """사용자용 설명 블록을 생성한다."""
    section_title_map = _build_section_title_map(
        contract_info.get("type", ""),
        standard_map,
        section_result,
    )
    rule_points = _build_rule_points(rule_result)
    content_points = _build_content_points(
        content_result,
        section_title_map,
        rule_result,
    )
    explanation = {
        "headline": _headline(overall_result, overall_severity),
        "plain_language_summary": _build_plain_summary(
            contract_info=contract_info,
            rule_result=rule_result,
            section_result=section_result,
            content_points=content_points,
            ocr_snapshot=ocr_snapshot,
        ),
        "overall_assessment": _build_overall_assessment(rule_result, section_result, content_points, ocr_snapshot),
        "important_points": sorted(
            rule_points + content_points,
            key=lambda item: (
                _RISK_BUCKET_ORDER.get(item.get("risk_bucket", "other"), 99),
                _CONTENT_SEVERITY_ORDER.get(item.get("severity", "MEDIUM"), 99),
                item.get("title", ""),
            ),
        ),
        "recommended_actions": _build_actions(rule_result, section_result, content_points, ocr_snapshot),
        "evidence": _build_evidence(ocr_snapshot, section_result),
    }
    explanation["markdown"] = _build_markdown(explanation)
    return explanation
