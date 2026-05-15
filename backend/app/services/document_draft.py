from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import TypeVar

from backend.app.schemas.document_draft import (
    CaseIntake,
    Claim,
    DocumentDraftRequest,
    DocumentDraftResponse,
    DocumentType,
    DraftLanguage,
    DraftLegalBasisSection,
    DraftPartySection,
    LegalBasisInput,
    NoticeMethod,
)


WORKER_PLACEHOLDER = "[근로자 이름 확인 필요]"
EMPLOYER_PLACEHOLDER = "[회사명 확인 필요]"
START_DATE_PLACEHOLDER = "[입사일 확인 필요]"
LAST_WORK_DATE_PLACEHOLDER = "[마지막 근무일 확인 필요]"
NOTICE_DATE_PLACEHOLDER = "[해고 통보일 확인 필요]"
EFFECTIVE_DATE_PLACEHOLDER = "[해고 효력 발생일 확인 필요]"
UNPAID_WAGE_AMOUNT_PLACEHOLDER = "[미지급 임금 금액 확인 필요]"
UNPAID_SEVERANCE_AMOUNT_PLACEHOLDER = "[퇴직금 발생 여부와 미지급 금액 확인 필요]"
UNPAID_PERIOD_START_PLACEHOLDER = "[체불 시작일 확인 필요]"
UNPAID_PERIOD_END_PLACEHOLDER = "[체불 종료일 확인 필요]"

ARTICLE_LABELS = {
    "lsa_23": "근로기준법 제23조 (해고 등의 제한)",
    "lsa_26": "근로기준법 제26조 (해고의 예고)",
    "lsa_27": "근로기준법 제27조 (해고사유 등의 서면통지)",
    "lsa_28": "근로기준법 제28조 (부당해고등의 구제신청)",
    "lsa_36": "근로기준법 제36조 (금품 청산)",
    "lsa_37": "근로기준법 제37조 (미지급 임금에 대한 지연이자)",
    "retirement_9": "근로자퇴직급여 보장법 제9조 (퇴직금의 지급 등)",
    "lsa_rule_5": "근로기준법 시행규칙 제5조 (부당해고등의 구제신청)",
}

ARTICLE_SUMMARIES = {
    "lsa_23": "해고 제한과 정당한 이유 필요성을 검토할 때 사용하는 근거입니다.",
    "lsa_26": "해고예고 또는 해고예고수당 쟁점을 검토할 때 사용하는 근거입니다.",
    "lsa_27": "해고 사유와 시기를 서면으로 통지했는지 검토할 때 사용하는 근거입니다.",
    "lsa_28": "부당해고 구제신청 절차를 검토할 때 사용하는 근거입니다.",
    "lsa_36": "퇴직 후 임금 등 금품 청산 기한을 검토할 때 사용하는 근거입니다.",
    "lsa_37": "미지급 임금 지연이자 가능성을 검토할 때 사용하는 근거입니다.",
    "retirement_9": "퇴직금 지급 여부와 지급기한을 검토할 때 사용하는 근거입니다.",
    "lsa_rule_5": "부당해고 구제신청 절차 서류를 검토할 때 사용하는 근거입니다.",
}

SCN_004_WAGE_KEYS = ("lsa_36", "retirement_9", "lsa_37")
SCN_004_WAGE_REQUIRED_KEYS = ("lsa_36", "retirement_9")
SCN_004_UNFAIR_KEYS = ("lsa_23", "lsa_26", "lsa_27", "lsa_28", "lsa_rule_5")
SCN_004_UNFAIR_REQUIRED_KEYS = ("lsa_23", "lsa_26", "lsa_27", "lsa_28")

NOTICE_METHOD_LABELS = {
    NoticeMethod.WRITTEN: "서면",
    NoticeMethod.KAKAOTALK: "카카오톡",
    NoticeMethod.SMS: "문자",
    NoticeMethod.EMAIL: "이메일",
    NoticeMethod.VERBAL: "구두",
    NoticeMethod.PHONE: "전화",
    NoticeMethod.UNKNOWN: "[해고 통보 방식 확인 필요]",
}

WAGE_EVIDENCE_CHECKLIST = [
    "급여명세서",
    "통장 입금 내역",
    "근로계약서",
    "출퇴근기록 또는 근무표",
    "해고 또는 퇴직 통보 메시지",
]

UNFAIR_DISMISSAL_EVIDENCE_CHECKLIST = [
    "해고 통보 카카오톡, 문자, 이메일 원본 및 캡처",
    "근로계약서",
    "근무표 또는 출퇴근기록",
    "해고 사유 설명 관련 자료",
    "동료 진술 또는 업무 지시 기록",
]

BASE_CAUTIONS = [
    "이 문서는 제출 전 검토용 초안이며 법률대리 문서가 아닙니다.",
    "사용자가 제공하지 않은 날짜, 금액, 회사명, 당사자명은 확인 필요로 표시했습니다.",
    "법적 근거는 요청에 포함된 cited_articles와 source_context_ids 안에서만 사용했습니다.",
]

T = TypeVar("T")


def build_document_draft(payload: DocumentDraftRequest) -> DocumentDraftResponse:
    intake = payload.case_intake
    legal_basis_input = payload.legal_basis
    title, recipient = _document_metadata(intake.document_type)
    parties = _build_parties(intake)
    facts = _build_facts(intake)
    legal_basis = _build_legal_basis_sections(intake, legal_basis_input)
    request_items = _build_request_items(intake)
    evidence_checklist = _build_evidence_checklist(intake)
    missing_fields = _build_missing_fields(intake, legal_basis_input)
    cautions = _build_cautions(intake, legal_basis_input)
    cited_articles = [section.citation_label for section in legal_basis]
    source_context_ids = _source_context_ids_for_response(legal_basis)
    if legal_basis and not source_context_ids:
        source_context_ids = _unique(legal_basis_input.source_context_ids)
    missing_legal_basis = _missing_legal_basis(intake, legal_basis_input)
    rendered_text = _render_document(
        title=title,
        recipient=recipient,
        parties=parties,
        facts=facts,
        legal_basis=legal_basis,
        request_items=request_items,
        evidence_checklist=evidence_checklist,
        missing_fields=missing_fields,
        cautions=cautions,
    )

    return DocumentDraftResponse(
        document_type=intake.document_type,
        title=title,
        recipient=recipient,
        language=intake.language,
        parties=parties,
        facts=facts,
        legal_basis=legal_basis,
        request=request_items,
        evidence_checklist=evidence_checklist,
        missing_fields=missing_fields,
        cautions=cautions,
        cited_articles=cited_articles,
        source_context_ids=source_context_ids,
        missing_legal_basis=missing_legal_basis,
        rendered_text=rendered_text,
    )


def _document_metadata(document_type: DocumentType) -> tuple[str, str]:
    if document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        return "임금 및 퇴직금 체불 진정서 초안", "관할 고용노동청"
    if document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        return "부당해고 구제신청 이유서 초안", "관할 지방노동위원회"
    return "사건 정리 문서 초안", "제출처 확인 필요"


def _build_parties(intake: CaseIntake) -> DraftPartySection:
    return DraftPartySection(
        worker=_display_text(
            intake.worker_info.name_or_placeholder,
            WORKER_PLACEHOLDER,
        ),
        employer=_display_text(
            intake.employer_info.company_name_or_placeholder,
            EMPLOYER_PLACEHOLDER,
        ),
        representative_name=intake.employer_info.representative_name,
        workplace_address=intake.employer_info.workplace_address,
    )


def _build_facts(intake: CaseIntake) -> list[str]:
    if intake.document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        return _build_wage_complaint_facts(intake)
    if intake.document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        return _build_unfair_dismissal_facts(intake)
    return _build_general_facts(intake)


def _build_wage_complaint_facts(intake: CaseIntake) -> list[str]:
    employment = intake.employment_info
    dismissal = intake.dismissal_info
    unpaid = intake.unpaid_wage_info
    facts = [
        (
            "근로자는 "
            f"{_format_date(employment.start_date, START_DATE_PLACEHOLDER)}부터 "
            f"{_display_text(intake.employer_info.company_name_or_placeholder, EMPLOYER_PLACEHOLDER)}"
            "에서 근무했습니다."
        )
    ]

    if employment.wage_payment_day is not None:
        facts.append(f"임금 지급일은 매월 {employment.wage_payment_day}일로 진술되었습니다.")

    if unpaid.unpaid_period_start is not None or unpaid.unpaid_period_end is not None:
        facts.append(
            "체불 기간은 "
            f"{_format_date(unpaid.unpaid_period_start, UNPAID_PERIOD_START_PLACEHOLDER)}부터 "
            f"{_format_date(unpaid.unpaid_period_end, UNPAID_PERIOD_END_PLACEHOLDER)}까지로 진술되었습니다."
        )

    if dismissal.notice_method is not None or dismissal.dismissal_notice_date is not None:
        facts.append(
            "해고 또는 퇴직 경위로 "
            f"{_format_date(dismissal.dismissal_notice_date, NOTICE_DATE_PLACEHOLDER)}에 "
            f"{_notice_method_label(dismissal.notice_method)}으로 통보를 받았다고 진술했습니다."
        )

    if unpaid.final_wage_paid is False:
        facts.append("마지막 임금이 지급되지 않았다고 진술했습니다.")
    elif unpaid.final_wage_paid is True:
        facts.append("마지막 임금은 지급되었다고 진술했습니다.")

    if unpaid.severance_paid is False:
        facts.append("퇴직금이 지급되지 않았다고 진술했습니다.")
    elif unpaid.severance_paid is True:
        facts.append("퇴직금은 지급되었다고 진술했습니다.")

    if unpaid.days_since_separation_over_14 is True:
        facts.append("퇴직 또는 마지막 근무 후 14일이 지났다고 진술했습니다.")
    elif unpaid.days_since_separation_over_14 is False:
        facts.append("퇴직 또는 마지막 근무 후 14일이 지나지 않았다고 진술했습니다.")

    facts.extend(_timeline_facts(intake))
    return _unique(facts)


def _build_unfair_dismissal_facts(intake: CaseIntake) -> list[str]:
    employment = intake.employment_info
    dismissal = intake.dismissal_info
    facts = [
        (
            "근로자는 "
            f"{_format_date(employment.start_date, START_DATE_PLACEHOLDER)}부터 "
            f"{_display_text(intake.employer_info.company_name_or_placeholder, EMPLOYER_PLACEHOLDER)}"
            "에서 근무했습니다."
        )
    ]

    if dismissal.notice_method is not None or dismissal.dismissal_notice_date is not None:
        facts.append(
            "근로자는 "
            f"{_format_date(dismissal.dismissal_notice_date, NOTICE_DATE_PLACEHOLDER)}에 "
            f"{_notice_method_label(dismissal.notice_method)}으로 해고 통보를 받았다고 진술했습니다."
        )

    if dismissal.dismissal_effective_date is not None:
        facts.append(
            "해고 효력 발생일은 "
            f"{_format_date(dismissal.dismissal_effective_date, EFFECTIVE_DATE_PLACEHOLDER)}로 진술되었습니다."
        )

    if dismissal.written_notice_received is False:
        facts.append("해고사유와 해고시기를 적은 서면 통지를 받지 못했다고 진술했습니다.")
    elif dismissal.written_notice_received is True:
        facts.append("해고 관련 서면 통지를 받았다고 진술했습니다.")

    if dismissal.advance_notice_30_days is False:
        facts.append("30일 전 해고예고를 받지 못했다고 진술했습니다.")
    elif dismissal.advance_notice_30_days is True:
        facts.append("30일 전 해고예고를 받았다고 진술했습니다.")

    if intake.employer_info.employee_count is not None:
        facts.append(
            f"상시근로자 수는 {intake.employer_info.employee_count}명으로 진술되었습니다."
        )
    elif intake.employer_info.employee_count_over_5 is True:
        facts.append("5인 이상 사업장에 해당한다고 진술했습니다.")
    elif intake.employer_info.employee_count_over_5 is False:
        facts.append("5인 이상 사업장에 해당하지 않는다고 진술했습니다.")

    if dismissal.opportunity_to_explain is False:
        facts.append("해고 또는 징계 전 소명 기회를 받지 못했다고 진술했습니다.")
    elif dismissal.opportunity_to_explain is True:
        facts.append("해고 또는 징계 전 소명 기회가 있었다고 진술했습니다.")

    if dismissal.prior_disciplinary_action is True:
        facts.append("이전 징계 이력이 있었다고 진술했습니다.")
    elif dismissal.prior_disciplinary_action is False:
        facts.append("이전 징계 이력은 없었다고 진술했습니다.")

    if dismissal.dismissal_reason_provided is False:
        facts.append("해고 사유 설명을 받지 못했다고 진술했습니다.")
    elif dismissal.dismissal_reason_provided is True and dismissal.dismissal_reason:
        facts.append(f"해고 사유로 '{dismissal.dismissal_reason}'라고 설명받았다고 진술했습니다.")

    facts.extend(_timeline_facts(intake))
    return _unique(facts)


def _build_general_facts(intake: CaseIntake) -> list[str]:
    facts = _timeline_facts(intake)
    if intake.intake_notes:
        facts.append(f"사용자 메모: {intake.intake_notes}")
    if not facts:
        facts.append("제공된 사실관계가 부족하여 확인 필요 항목 중심으로 초안을 작성했습니다.")
    return _unique(facts)


def _timeline_facts(intake: CaseIntake) -> list[str]:
    facts = []
    for event in intake.incident_timeline:
        event_date = _format_date(event.date, "[날짜 확인 필요]")
        facts.append(f"{event_date}: {event.event}")
    return facts


def _build_legal_basis_sections(
    intake: CaseIntake,
    legal_basis_input: LegalBasisInput,
) -> list[DraftLegalBasisSection]:
    allowed_keys = _allowed_article_keys(intake.document_type)
    selected_citations = _select_citations(
        legal_basis_input.cited_articles,
        allowed_keys,
    )
    context_ids_by_citation = _context_ids_by_citation(legal_basis_input)
    sections = []
    for citation in selected_citations:
        article_key = _article_key_for_citation(citation)
        summary = ARTICLE_SUMMARIES.get(
            article_key,
            "요청에 포함된 /api/v1/answer 법적 근거입니다.",
        )
        sections.append(
            DraftLegalBasisSection(
                citation_label=citation,
                summary=summary,
                source_context_ids=context_ids_by_citation.get(citation, []),
            )
        )
    return sections


def _build_request_items(intake: CaseIntake) -> list[str]:
    if intake.document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        unpaid = intake.unpaid_wage_info
        return [
            "미지급 임금 지급 여부와 금액을 조사해 주시기 바랍니다.",
            f"미지급 임금 금액은 {_format_money(unpaid.unpaid_wage_amount, UNPAID_WAGE_AMOUNT_PLACEHOLDER)}입니다.",
            "퇴직금 발생 및 미지급 여부를 확인해 주시기 바랍니다.",
            f"미지급 퇴직금 금액은 {_format_money(unpaid.unpaid_severance_amount, UNPAID_SEVERANCE_AMOUNT_PLACEHOLDER)}입니다.",
        ]

    if intake.document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        requested_actions = _unfair_dismissal_requested_actions(intake)
        return [
            "해고의 정당성 및 절차 위반 여부를 확인해 주시기 바랍니다.",
            "서면통지, 해고예고, 해고사유 설명 여부를 중심으로 사실관계를 검토해 주시기 바랍니다.",
            requested_actions,
        ]

    if intake.requested_actions:
        return [f"사용자가 요청한 조치: {', '.join(intake.requested_actions)}"]
    return ["요청사항은 [요청사항 확인 필요]입니다."]


def _build_evidence_checklist(intake: CaseIntake) -> list[str]:
    provided_items = [item.description for item in intake.evidence_items]
    if intake.document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        return _unique(provided_items + WAGE_EVIDENCE_CHECKLIST)
    if intake.document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        return _unique(provided_items + UNFAIR_DISMISSAL_EVIDENCE_CHECKLIST)
    return _unique(provided_items)


def _build_missing_fields(
    intake: CaseIntake,
    legal_basis_input: LegalBasisInput,
) -> list[str]:
    missing = []
    _append_if_missing(
        missing,
        "근로자 이름",
        intake.worker_info.name_or_placeholder,
    )
    _append_if_missing(
        missing,
        "회사명",
        intake.employer_info.company_name_or_placeholder,
    )

    if intake.document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        _append_if_none(missing, "입사일", intake.employment_info.start_date)
        _append_if_none(missing, "마지막 근무일", intake.employment_info.last_work_date)
        _append_if_none(
            missing,
            "마지막 임금 지급 여부",
            intake.unpaid_wage_info.final_wage_paid,
        )
        _append_if_none(
            missing,
            "미지급 임금 금액",
            intake.unpaid_wage_info.unpaid_wage_amount,
        )
        if (
            intake.unpaid_wage_info.unpaid_period_start is None
            and intake.unpaid_wage_info.unpaid_period_end is None
        ):
            missing.append("체불 기간")
        else:
            _append_if_none(
                missing,
                "체불 시작일",
                intake.unpaid_wage_info.unpaid_period_start,
            )
            _append_if_none(
                missing,
                "체불 종료일",
                intake.unpaid_wage_info.unpaid_period_end,
            )
        _append_if_none(
            missing,
            "임금 지급일",
            intake.employment_info.wage_payment_day,
        )
        _append_if_none(
            missing,
            "퇴직금 지급 여부",
            intake.unpaid_wage_info.severance_paid,
        )
        _append_if_none(
            missing,
            "퇴직금 발생 여부와 미지급 금액",
            intake.unpaid_wage_info.unpaid_severance_amount,
        )
        _append_if_none(
            missing,
            "퇴직 또는 마지막 근무 후 14일 경과 여부",
            intake.unpaid_wage_info.days_since_separation_over_14,
        )

    elif intake.document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        _append_if_none(missing, "입사일", intake.employment_info.start_date)
        _append_if_none(missing, "해고 통보일", intake.dismissal_info.dismissal_notice_date)
        if (
            intake.dismissal_info.dismissal_effective_date is None
            and intake.employment_info.last_work_date is None
        ):
            missing.append("해고 효력 발생일 또는 마지막 근무일")
        _append_if_none(missing, "해고 통보 방식", intake.dismissal_info.notice_method)
        _append_if_none(
            missing,
            "해고 사유 서면통지 수령 여부",
            intake.dismissal_info.written_notice_received,
        )
        _append_if_none(
            missing,
            "30일 전 해고예고 여부",
            intake.dismissal_info.advance_notice_30_days,
        )
        _append_if_none(
            missing,
            "해고 사유 설명 여부",
            intake.dismissal_info.dismissal_reason_provided,
        )
        if (
            intake.employer_info.employee_count is None
            and intake.employer_info.employee_count_over_5 is None
        ):
            missing.append("상시근로자 수 또는 5인 이상 사업장 해당 여부")
        if (
            intake.dismissal_info.reinstatement_requested is None
            and intake.dismissal_info.monetary_compensation_requested is None
        ):
            missing.append("구제신청 취지(복직 또는 금전보상 신청 의사)")
        elif not intake.requested_actions:
            missing.append("원하는 구제 내용")

    if not intake.evidence_items:
        missing.append("보유 증거 목록")
    if not legal_basis_input.cited_articles:
        missing.append("/api/v1/answer cited_articles")
    if not legal_basis_input.source_context_ids:
        missing.append("/api/v1/answer source_context_ids")
    return _unique(missing)


def _build_cautions(
    intake: CaseIntake,
    legal_basis_input: LegalBasisInput,
) -> list[str]:
    cautions = BASE_CAUTIONS + legal_basis_input.cautions
    if intake.document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        cautions.extend(_wage_complaint_cautions(intake))
    elif intake.document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        cautions.extend(_unfair_dismissal_cautions(intake))
    return _unique(cautions)


def _wage_complaint_cautions(intake: CaseIntake) -> list[str]:
    employment = intake.employment_info
    cautions = []
    if employment.wage_payment_day is None:
        cautions.append(
            "임금 지급일이 확인되지 않아 임금 체불 기간과 지급기한 산정은 확인 필요합니다."
        )
    if _retirement_pay_claimed(intake):
        if employment.continuous_service_over_1_year is False:
            cautions.append(
                "퇴직금 청구가 있으나 계속근로기간 1년 이상 요건은 별도 확인 필요합니다."
            )
        elif (
            employment.start_date is not None
            and employment.last_work_date is not None
            and employment.last_work_date < _add_months(employment.start_date, 12)
        ):
            cautions.append(
                "입사일과 마지막 근무일 기준 계속근로기간이 1년 미만일 가능성이 있어 퇴직금 요건 확인 필요합니다."
            )
    return cautions


def _unfair_dismissal_cautions(intake: CaseIntake) -> list[str]:
    employer = intake.employer_info
    dismissal = intake.dismissal_info
    cautions = []
    if (
        dismissal.dismissal_effective_date is not None
        and date.today() > _add_months(dismissal.dismissal_effective_date, 3)
    ):
        cautions.append(
            "해고 효력 발생일 기준 부당해고 구제신청 3개월 기한이 지났을 가능성이 있어 접수 가능 여부 확인 필요합니다."
        )
    if employer.employee_count_over_5 is False or (
        employer.employee_count is not None and employer.employee_count < 5
    ):
        cautions.append(
            "상시근로자 수가 5인 미만이거나 5인 이상 사업장 해당 여부가 불명확하면 부당해고 구제신청 적용 범위와 관할기관 확인 필요합니다."
        )
    return cautions


def _retirement_pay_claimed(intake: CaseIntake) -> bool:
    return (
        intake.unpaid_wage_info.severance_paid is False
        or intake.unpaid_wage_info.unpaid_severance_amount is not None
        or Claim.UNPAID_SEVERANCE_PAY in intake.claims
    )


def _unfair_dismissal_requested_actions(intake: CaseIntake) -> str:
    relief_items = []
    if intake.dismissal_info.reinstatement_requested is True:
        relief_items.append("원직복직")
    if intake.dismissal_info.monetary_compensation_requested is True:
        relief_items.append("금전보상")
    if relief_items:
        return f"구제신청 취지는 {', '.join(relief_items)}입니다."
    if intake.requested_actions:
        return f"사용자가 요청한 조치: {', '.join(intake.requested_actions)}"
    return "구제 내용은 [원직복직 또는 금전보상 신청 의사 확인 필요]입니다."


def _missing_legal_basis(
    intake: CaseIntake,
    legal_basis_input: LegalBasisInput,
) -> list[str]:
    required_keys = _required_article_keys(intake.document_type)
    missing_keys = [
        key
        for key in required_keys
        if not _has_matching_citation(legal_basis_input.cited_articles, key)
    ]
    return [ARTICLE_LABELS[key] for key in missing_keys]


def _allowed_article_keys(document_type: DocumentType) -> tuple[str, ...]:
    if document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        return SCN_004_WAGE_KEYS
    if document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        return SCN_004_UNFAIR_KEYS
    return tuple(ARTICLE_LABELS)


def _required_article_keys(document_type: DocumentType) -> tuple[str, ...]:
    if document_type == DocumentType.LABOR_OFFICE_WAGE_COMPLAINT:
        return SCN_004_WAGE_REQUIRED_KEYS
    if document_type == DocumentType.LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF:
        return SCN_004_UNFAIR_REQUIRED_KEYS
    return ()


def _select_citations(citations: list[str], allowed_keys: tuple[str, ...]) -> list[str]:
    selected = []
    for citation in citations:
        article_key = _article_key_for_citation(citation)
        if article_key in allowed_keys:
            selected.append(citation)
    return _unique(selected)


def _context_ids_by_citation(legal_basis_input: LegalBasisInput) -> dict[str, list[int]]:
    mapping = {citation: [] for citation in legal_basis_input.cited_articles}
    for chunk in legal_basis_input.retrieved_chunks:
        chunk_article_key = _article_key_for_citation(chunk.citation_label)
        for citation in legal_basis_input.cited_articles:
            if _article_key_for_citation(citation) == chunk_article_key:
                mapping[citation].append(chunk.context_id)

    if not any(mapping.values()) and len(legal_basis_input.cited_articles) == len(
        legal_basis_input.source_context_ids
    ):
        for citation, context_id in zip(
            legal_basis_input.cited_articles,
            legal_basis_input.source_context_ids,
            strict=True,
        ):
            mapping[citation].append(context_id)

    return {citation: _unique(context_ids) for citation, context_ids in mapping.items()}


def _source_context_ids_for_response(
    legal_basis: list[DraftLegalBasisSection],
) -> list[int]:
    context_ids = []
    for section in legal_basis:
        context_ids.extend(section.source_context_ids)
    return _unique(context_ids)


def _article_key_for_citation(citation: str | None) -> str | None:
    if not citation:
        return None
    normalized_citation = _normalize(citation)
    for key, label in ARTICLE_LABELS.items():
        if _normalize(label.split(" (", maxsplit=1)[0]) in normalized_citation:
            return key
    return None


def _has_matching_citation(citations: list[str], article_key: str) -> bool:
    return any(_article_key_for_citation(citation) == article_key for citation in citations)


def _render_document(
    *,
    title: str,
    recipient: str,
    parties: DraftPartySection,
    facts: list[str],
    legal_basis: list[DraftLegalBasisSection],
    request_items: list[str],
    evidence_checklist: list[str],
    missing_fields: list[str],
    cautions: list[str],
) -> str:
    legal_basis_items = [
        f"{section.citation_label}: {section.summary}" for section in legal_basis
    ] or ["요청에 포함된 법적 근거 중 이 문서 유형에 사용할 근거가 확인되지 않았습니다."]

    sections = [
        title,
        f"수신: {recipient}",
        f"당사자: 근로자 {parties.worker} / 사용자 {parties.employer}",
        _render_list("1. 사건 경위", facts),
        _render_list("2. 법적 근거", legal_basis_items),
        _render_list("3. 요청사항", request_items),
        _render_list("4. 증거", evidence_checklist or ["[증거 목록 확인 필요]"]),
        _render_list("5. 확인 필요", missing_fields or ["추가 확인 항목 없음"]),
        _render_list("유의사항", cautions),
    ]
    return "\n\n".join(sections)


def _render_list(title: str, items: list[str]) -> str:
    return "\n".join([title, *(f"- {item}" for item in items)])


def _display_text(value: str | None, placeholder: str) -> str:
    if _is_missing_text(value):
        return placeholder
    return value


def _format_date(value: date | None, placeholder: str) -> str:
    if value is None:
        return placeholder
    return value.isoformat()


def _format_money(value: Decimal | None, placeholder: str) -> str:
    if value is None:
        return placeholder
    normalized = value.normalize()
    formatted = f"{normalized:f}"
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return f"{formatted}원"


def _add_months(value: date, months: int) -> date:
    target_month_index = value.month - 1 + months
    year = value.year + target_month_index // 12
    month = target_month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def _notice_method_label(value: NoticeMethod | None) -> str:
    if value is None:
        return "[해고 통보 방식 확인 필요]"
    return NOTICE_METHOD_LABELS[value]


def _append_if_missing(items: list[str], label: str, value: str | None) -> None:
    if _is_missing_text(value):
        items.append(label)


def _append_if_none(items: list[str], label: str, value: object | None) -> None:
    if value is None:
        items.append(label)


def _is_missing_text(value: str | None) -> bool:
    if value is None:
        return True
    stripped = value.strip()
    return not stripped or ("확인 필요" in stripped and stripped.startswith("["))


def _normalize(value: str) -> str:
    return "".join(value.split())


def _unique(items: list[T]) -> list[T]:
    unique_items = []
    for item in items:
        if item not in unique_items:
            unique_items.append(item)
    return unique_items
