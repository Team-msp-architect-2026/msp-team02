import type {
  AnswerRequest,
  AnswerResponse,
  ApiErrorInfo,
  BuildCaseIntakeInput,
  CaseIntake,
  Claim,
  DismissalInfo,
  DocumentDraftRequest,
  DocumentDraftResponse,
  DocumentType,
  EmployerInfo,
  EmploymentInfo,
  EvidenceItem,
  EvidenceStatus,
  EvidenceType,
  EvidenceUiStatus,
  LegalBasisInput,
  NoticeMethod,
  TimelineEvent,
  UnpaidWageInfo,
  WageType,
  WorkerInfo,
} from '@/types/api';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const ANSWER_TIMEOUT_MS = 30_000;
const DRAFT_TIMEOUT_MS = 60_000;

const evidenceTypes: readonly EvidenceType[] = [
  'message',
  'sms',
  'email',
  'paystub',
  'bank_statement',
  'employment_contract',
  'attendance_record',
  'work_schedule',
  'recording',
  'photo',
  'memo',
];

const noticeMethods: readonly NoticeMethod[] = [
  'written',
  'kakaotalk',
  'sms',
  'email',
  'verbal',
  'phone',
  'unknown',
];

const wageTypes: readonly WageType[] = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'annual',
  'piece_rate',
  'other',
  'unknown',
];

export class ApiError extends Error implements ApiErrorInfo {
  status: number;
  retryable: boolean;

  constructor(status: number, message: string, retryable = true) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export async function fetchAnswer(request: AnswerRequest): Promise<AnswerResponse> {
  return postJson<AnswerRequest, AnswerResponse>(
    '/api/v1/answer',
    request,
    ANSWER_TIMEOUT_MS,
    'answer',
  );
}

export async function fetchDraft(
  request: DocumentDraftRequest,
): Promise<DocumentDraftResponse> {
  return postJson<DocumentDraftRequest, DocumentDraftResponse>(
    '/api/v1/documents/draft',
    request,
    DRAFT_TIMEOUT_MS,
    'draft',
  );
}

export function buildLegalBasis(response: AnswerResponse): LegalBasisInput {
  const groundedContextIds = new Set(response.grounded_context_ids);

  return {
    answer_query: optionalText(response.query) ?? null,
    answer: optionalText(response.answer) ?? null,
    key_points: response.key_points,
    cautions: response.cautions,
    cited_articles: response.cited_articles,
    source_context_ids: response.grounded_context_ids,
    retrieved_chunks: response.retrieved_chunks.filter((chunk) =>
      groundedContextIds.has(chunk.context_id),
    ),
  };
}

export function hasDraftGrounding(response: AnswerResponse): boolean {
  return response.cited_articles.length > 0 && response.grounded_context_ids.length > 0;
}

export function buildCaseIntake(input: BuildCaseIntakeInput): CaseIntake {
  const formValues = input.form_values ?? {};

  return {
    scenario_id: 'SCN-004',
    document_type: input.selected_document_type,
    language: 'ko',
    worker_info: cleanWorkerInfo(formValues.worker_info),
    employer_info: cleanEmployerInfo(formValues.employer_info),
    employment_info: cleanEmploymentInfo(formValues.employment_info),
    dismissal_info: cleanDismissalInfo(formValues.dismissal_info),
    unpaid_wage_info: cleanUnpaidWageInfo(formValues.unpaid_wage_info),
    incident_timeline: cleanTimeline(input.incident_timeline),
    claims: buildClaims(input.selected_document_type),
    evidence_items: cleanEvidenceItems(input.evidence_items),
    requested_actions: buildRequestedActions(input.selected_document_type),
    intake_notes: optionalText(formValues.intake_notes) ?? null,
  };
}

async function postJson<TRequest, TResponse>(
  path: string,
  request: TRequest,
  timeoutMs: number,
  endpoint: 'answer' | 'draft',
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createHttpError(endpoint, response.status);
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new ApiError(0, '연결을 확인하고 다시 시도해주세요.', true);
    }

    throw new ApiError(0, '연결을 확인하고 다시 시도해주세요.', true);
  } finally {
    clearTimeout(timeoutId);
  }
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function createHttpError(endpoint: 'answer' | 'draft', status: number): ApiError {
  if (endpoint === 'answer') {
    if (status === 503) {
      return new ApiError(
        status,
        '서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
        true,
      );
    }

    if (status >= 400 && status < 500) {
      return new ApiError(status, '입력 내용을 확인한 후 다시 시도해주세요.', true);
    }
  }

  if (endpoint === 'draft') {
    if (status === 422) {
      return new ApiError(status, '입력 값에 오류가 있습니다. 내용을 확인해주세요.', true);
    }

    if (status >= 500) {
      return new ApiError(status, '문서 초안 생성에 실패했습니다. 다시 시도해주세요.', true);
    }
  }

  return new ApiError(status, '요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.', true);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function cleanWorkerInfo(input?: WorkerInfo | null): WorkerInfo {
  const output: WorkerInfo = {};
  const name = optionalText(input?.name_or_placeholder);
  const nationality = optionalText(input?.nationality);

  if (name !== undefined) output.name_or_placeholder = name;
  if (nationality !== undefined) output.nationality = nationality;
  if (input?.preferred_language === 'ko' || input?.preferred_language === 'en') {
    output.preferred_language = input.preferred_language;
  }

  return output;
}

function cleanEmployerInfo(input?: EmployerInfo | null): EmployerInfo {
  const output: EmployerInfo = {};
  const companyName = optionalText(input?.company_name_or_placeholder);
  const representativeName = optionalText(input?.representative_name);
  const workplaceAddress = optionalText(input?.workplace_address);
  const workplaceJurisdiction = optionalText(input?.workplace_jurisdiction);
  const employeeCount = optionalNumber(input?.employee_count);

  if (companyName !== undefined) output.company_name_or_placeholder = companyName;
  if (representativeName !== undefined) output.representative_name = representativeName;
  if (workplaceAddress !== undefined) output.workplace_address = workplaceAddress;
  if (employeeCount !== undefined && employeeCount >= 0) output.employee_count = employeeCount;
  if (typeof input?.employee_count_over_5 === 'boolean') {
    output.employee_count_over_5 = input.employee_count_over_5;
  }
  if (workplaceJurisdiction !== undefined) {
    output.workplace_jurisdiction = workplaceJurisdiction;
  }

  return output;
}

function cleanEmploymentInfo(input?: EmploymentInfo | null): EmploymentInfo {
  const output: EmploymentInfo = {};
  const startDate = optionalText(input?.start_date);
  const lastWorkDate = optionalText(input?.last_work_date);
  const jobTitle = optionalText(input?.job_title);
  const wageTerms = optionalText(input?.wage_terms);
  const wagePaymentDay = optionalNumber(input?.wage_payment_day);

  if (startDate !== undefined) output.start_date = startDate;
  if (lastWorkDate !== undefined) output.last_work_date = lastWorkDate;
  if (jobTitle !== undefined) output.job_title = jobTitle;
  if (wageTerms !== undefined) output.wage_terms = wageTerms;
  if (isWageType(input?.wage_type)) output.wage_type = input.wage_type;
  if (
    wagePaymentDay !== undefined &&
    Number.isInteger(wagePaymentDay) &&
    wagePaymentDay >= 1 &&
    wagePaymentDay <= 31
  ) {
    output.wage_payment_day = wagePaymentDay;
  }
  if (typeof input?.employment_contract_exists === 'boolean') {
    output.employment_contract_exists = input.employment_contract_exists;
  }
  if (typeof input?.continuous_service_over_1_year === 'boolean') {
    output.continuous_service_over_1_year = input.continuous_service_over_1_year;
  }

  return output;
}

function cleanDismissalInfo(input?: DismissalInfo | null): DismissalInfo {
  const output: DismissalInfo = {};
  const dismissalNoticeDate = optionalText(input?.dismissal_notice_date);
  const dismissalEffectiveDate = optionalText(input?.dismissal_effective_date);
  const dismissalReason = optionalText(input?.dismissal_reason);

  if (dismissalNoticeDate !== undefined) output.dismissal_notice_date = dismissalNoticeDate;
  if (dismissalEffectiveDate !== undefined) {
    output.dismissal_effective_date = dismissalEffectiveDate;
  }
  if (isNoticeMethod(input?.notice_method)) output.notice_method = input.notice_method;
  if (typeof input?.written_notice_received === 'boolean') {
    output.written_notice_received = input.written_notice_received;
  }
  if (typeof input?.dismissal_reason_provided === 'boolean') {
    output.dismissal_reason_provided = input.dismissal_reason_provided;
  }
  if (dismissalReason !== undefined) output.dismissal_reason = dismissalReason;
  if (typeof input?.advance_notice_30_days === 'boolean') {
    output.advance_notice_30_days = input.advance_notice_30_days;
  }
  if (typeof input?.reinstatement_requested === 'boolean') {
    output.reinstatement_requested = input.reinstatement_requested;
  }
  if (typeof input?.monetary_compensation_requested === 'boolean') {
    output.monetary_compensation_requested = input.monetary_compensation_requested;
  }
  if (typeof input?.opportunity_to_explain === 'boolean') {
    output.opportunity_to_explain = input.opportunity_to_explain;
  }
  if (typeof input?.prior_disciplinary_action === 'boolean') {
    output.prior_disciplinary_action = input.prior_disciplinary_action;
  }

  return output;
}

function cleanUnpaidWageInfo(input?: UnpaidWageInfo | null): UnpaidWageInfo {
  const output: UnpaidWageInfo = {};
  const unpaidWageAmount = optionalNumber(input?.unpaid_wage_amount);
  const unpaidPeriodStart = optionalText(input?.unpaid_period_start);
  const unpaidPeriodEnd = optionalText(input?.unpaid_period_end);
  const unpaidSeveranceAmount = optionalNumber(input?.unpaid_severance_amount);

  if (typeof input?.final_wage_paid === 'boolean') {
    output.final_wage_paid = input.final_wage_paid;
  }
  if (unpaidWageAmount !== undefined && unpaidWageAmount >= 0) {
    output.unpaid_wage_amount = unpaidWageAmount;
  }
  if (unpaidPeriodStart !== undefined) output.unpaid_period_start = unpaidPeriodStart;
  if (unpaidPeriodEnd !== undefined) output.unpaid_period_end = unpaidPeriodEnd;
  if (typeof input?.severance_paid === 'boolean') {
    output.severance_paid = input.severance_paid;
  }
  if (unpaidSeveranceAmount !== undefined && unpaidSeveranceAmount >= 0) {
    output.unpaid_severance_amount = unpaidSeveranceAmount;
  }
  if (typeof input?.days_since_separation_over_14 === 'boolean') {
    output.days_since_separation_over_14 = input.days_since_separation_over_14;
  }

  return output;
}

function cleanTimeline(input?: BuildCaseIntakeInput['incident_timeline']): TimelineEvent[] {
  if (!input) return [];

  return input.flatMap((row) => {
    const event = optionalText(row.event);

    if (event === undefined) return [];

    return [
      {
        date: optionalText(row.date) ?? null,
        event,
        evidence_refs: cleanTextList(row.evidence_refs),
      },
    ];
  });
}

function cleanEvidenceItems(input?: BuildCaseIntakeInput['evidence_items']): EvidenceItem[] {
  if (!input) return [];

  return input.flatMap((item) => {
    const description = optionalText(item.description);

    if (!isEvidenceType(item.type) || description === undefined) {
      return [];
    }

    return [
      {
        type: item.type,
        description,
        status: normalizeEvidenceStatus(item.status),
      },
    ];
  });
}

function buildClaims(documentType: DocumentType): Claim[] {
  if (documentType === 'labor_office_wage_complaint') {
    return ['unpaid_final_wages', 'unpaid_severance_pay', 'delay_interest_possible'];
  }

  if (documentType === 'workplace_change_reason_summary') {
    return [];
  }

  return [
    'unfair_dismissal',
    'no_written_dismissal_notice',
    'no_advance_dismissal_notice',
  ];
}

function buildRequestedActions(documentType: DocumentType): string[] {
  if (documentType === 'labor_office_wage_complaint') {
    return [
      '미지급 임금 및 퇴직금 지급을 요청합니다.',
      '근로기준법상 금품청산 의무와 지연이자 검토를 요청합니다.',
    ];
  }

  if (documentType === 'workplace_change_reason_summary') {
    return [];
  }

  return [
    '부당해고 구제신청 인용을 요청합니다.',
    '원직복직 또는 금전보상 명령 검토를 요청합니다.',
  ];
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cleanTextList(input?: Array<string | null | undefined> | null): string[] {
  if (!input) return [];
  return input.flatMap((item) => {
    const value = optionalText(item);
    return value === undefined ? [] : [value];
  });
}

function optionalNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const text = optionalText(value);

  if (text === undefined) return undefined;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeEvidenceStatus(status?: EvidenceUiStatus | null): EvidenceStatus {
  if (status === 'available' || status === 'needs_collection' || status === 'unknown') {
    return status;
  }

  return 'unknown';
}

function isEvidenceType(value: unknown): value is EvidenceType {
  return typeof value === 'string' && evidenceTypes.includes(value as EvidenceType);
}

function isNoticeMethod(value: unknown): value is NoticeMethod {
  return typeof value === 'string' && noticeMethods.includes(value as NoticeMethod);
}

function isWageType(value: unknown): value is WageType {
  return typeof value === 'string' && wageTypes.includes(value as WageType);
}
