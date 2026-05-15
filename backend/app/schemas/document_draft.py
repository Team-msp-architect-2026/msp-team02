from __future__ import annotations

from datetime import date as Date
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


Text = Annotated[str, Field(min_length=1)]
PositiveContextId = Annotated[int, Field(ge=1)]
MoneyAmount = Annotated[Decimal, Field(ge=0)]
EmployeeCount = Annotated[int, Field(ge=0)]
WagePaymentDay = Annotated[int, Field(ge=1, le=31)]


class StrictSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        str_min_length=1,
    )


class DocumentType(str, Enum):
    LABOR_OFFICE_WAGE_COMPLAINT = "labor_office_wage_complaint"
    LABOR_COMMISSION_UNFAIR_DISMISSAL_BRIEF = (
        "labor_commission_unfair_dismissal_brief"
    )
    FAMILY_LEAVE_REAPPLICATION = "family_leave_reapplication"
    WRITTEN_REASON_REQUEST = "written_reason_request"
    CERTIFIED_LETTER = "certified_letter"
    WORKPLACE_CHANGE_REASON_SUMMARY = "workplace_change_reason_summary"
    CONSULTATION_CASE_SUMMARY = "consultation_case_summary"


class ScenarioId(str, Enum):
    SCN_001 = "SCN-001"
    SCN_004 = "SCN-004"
    SCN_005 = "SCN-005"


class DraftLanguage(str, Enum):
    KO = "ko"
    EN = "en"


class NoticeMethod(str, Enum):
    WRITTEN = "written"
    KAKAOTALK = "kakaotalk"
    SMS = "sms"
    EMAIL = "email"
    VERBAL = "verbal"
    PHONE = "phone"
    UNKNOWN = "unknown"


class WageType(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ANNUAL = "annual"
    PIECE_RATE = "piece_rate"
    OTHER = "other"
    UNKNOWN = "unknown"


class Claim(str, Enum):
    UNFAIR_DISMISSAL = "unfair_dismissal"
    NO_WRITTEN_DISMISSAL_NOTICE = "no_written_dismissal_notice"
    NO_ADVANCE_DISMISSAL_NOTICE = "no_advance_dismissal_notice"
    UNPAID_FINAL_WAGES = "unpaid_final_wages"
    UNPAID_SEVERANCE_PAY = "unpaid_severance_pay"
    DELAY_INTEREST_POSSIBLE = "delay_interest_possible"


class EvidenceType(str, Enum):
    MESSAGE = "message"
    SMS = "sms"
    EMAIL = "email"
    PAYSTUB = "paystub"
    BANK_STATEMENT = "bank_statement"
    EMPLOYMENT_CONTRACT = "employment_contract"
    ATTENDANCE_RECORD = "attendance_record"
    WORK_SCHEDULE = "work_schedule"
    RECORDING = "recording"
    PHOTO = "photo"
    MEMO = "memo"


class EvidenceStatus(str, Enum):
    AVAILABLE = "available"
    NEEDS_COLLECTION = "needs_collection"
    UNKNOWN = "unknown"


class WorkerInfo(StrictSchema):
    name_or_placeholder: Text | None = None
    nationality: Text | None = None
    preferred_language: DraftLanguage | None = None


class EmployerInfo(StrictSchema):
    company_name_or_placeholder: Text | None = None
    representative_name: Text | None = None
    workplace_address: Text | None = None
    employee_count: EmployeeCount | None = None
    employee_count_over_5: bool | None = None
    workplace_jurisdiction: Text | None = None


class EmploymentInfo(StrictSchema):
    start_date: Date | None = None
    last_work_date: Date | None = None
    job_title: Text | None = None
    wage_terms: Text | None = None
    wage_type: WageType | None = None
    wage_payment_day: WagePaymentDay | None = None
    employment_contract_exists: bool | None = None
    continuous_service_over_1_year: bool | None = None


class DismissalInfo(StrictSchema):
    dismissal_notice_date: Date | None = None
    dismissal_effective_date: Date | None = None
    notice_method: NoticeMethod | None = None
    written_notice_received: bool | None = None
    dismissal_reason_provided: bool | None = None
    dismissal_reason: Text | None = None
    advance_notice_30_days: bool | None = None
    reinstatement_requested: bool | None = None
    monetary_compensation_requested: bool | None = None
    opportunity_to_explain: bool | None = None
    prior_disciplinary_action: bool | None = None


class UnpaidWageInfo(StrictSchema):
    final_wage_paid: bool | None = None
    unpaid_wage_amount: MoneyAmount | None = None
    unpaid_period_start: Date | None = None
    unpaid_period_end: Date | None = None
    severance_paid: bool | None = None
    unpaid_severance_amount: MoneyAmount | None = None
    days_since_separation_over_14: bool | None = None


class TimelineEvent(StrictSchema):
    date: Date | None = None
    event: Text
    evidence_refs: list[Text] = Field(default_factory=list)


class EvidenceItem(StrictSchema):
    type: EvidenceType
    description: Text
    status: EvidenceStatus = EvidenceStatus.UNKNOWN


class LegalBasisChunk(StrictSchema):
    context_id: PositiveContextId
    chunk_id: Text
    citation_label: Text
    law_name: Text
    article_no: Text
    article_title: Text
    paragraph_no: PositiveContextId | None
    content: Text
    similarity: float = Field(ge=0)
    tier: PositiveContextId
    structure_path: Text | None


class LegalBasisInput(StrictSchema):
    answer_query: Text | None = None
    answer: Text | None = None
    key_points: list[Text] = Field(default_factory=list)
    cautions: list[Text] = Field(default_factory=list)
    cited_articles: list[Text] = Field(default_factory=list)
    source_context_ids: list[PositiveContextId] = Field(default_factory=list)
    retrieved_chunks: list[LegalBasisChunk] = Field(default_factory=list)


class CaseIntake(StrictSchema):
    scenario_id: ScenarioId
    document_type: DocumentType
    language: DraftLanguage = DraftLanguage.KO
    worker_info: WorkerInfo = Field(default_factory=WorkerInfo)
    employer_info: EmployerInfo = Field(default_factory=EmployerInfo)
    employment_info: EmploymentInfo = Field(default_factory=EmploymentInfo)
    dismissal_info: DismissalInfo = Field(default_factory=DismissalInfo)
    unpaid_wage_info: UnpaidWageInfo = Field(default_factory=UnpaidWageInfo)
    incident_timeline: list[TimelineEvent] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    evidence_items: list[EvidenceItem] = Field(default_factory=list)
    requested_actions: list[Text] = Field(default_factory=list)
    intake_notes: Text | None = None


class DocumentDraftRequest(StrictSchema):
    case_intake: CaseIntake
    legal_basis: LegalBasisInput


class DraftPartySection(StrictSchema):
    worker: Text
    employer: Text
    representative_name: Text | None = None
    workplace_address: Text | None = None


class DraftLegalBasisSection(StrictSchema):
    citation_label: Text
    summary: Text
    source_context_ids: list[PositiveContextId] = Field(default_factory=list)


class DocumentDraftResponse(StrictSchema):
    document_type: DocumentType
    title: Text
    recipient: Text
    language: DraftLanguage
    parties: DraftPartySection
    facts: list[Text]
    legal_basis: list[DraftLegalBasisSection]
    request: list[Text]
    evidence_checklist: list[Text]
    missing_fields: list[Text]
    cautions: list[Text]
    cited_articles: list[Text]
    source_context_ids: list[PositiveContextId]
    missing_legal_basis: list[Text]
    rendered_text: Text
