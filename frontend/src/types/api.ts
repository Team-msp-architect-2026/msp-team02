export type DocumentType =
  | 'labor_office_wage_complaint'
  | 'labor_commission_unfair_dismissal_brief'
  | 'workplace_change_reason_summary';

export type ScenarioId = 'SCN-001' | 'SCN-004';
export type DraftLanguage = 'ko' | 'en';

export type EvidenceStatus = 'available' | 'needs_collection' | 'unknown';
export type EvidenceUiStatus = 'not_selected' | EvidenceStatus;

export type NoticeMethod =
  | 'written'
  | 'kakaotalk'
  | 'sms'
  | 'email'
  | 'verbal'
  | 'phone'
  | 'unknown';

export type WageType =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'annual'
  | 'piece_rate'
  | 'other'
  | 'unknown';

export type WorkplaceChangeSelectValue = 'yes' | 'no' | 'unknown';

export type Claim =
  | 'unfair_dismissal'
  | 'no_written_dismissal_notice'
  | 'no_advance_dismissal_notice'
  | 'unpaid_final_wages'
  | 'unpaid_severance_pay'
  | 'delay_interest_possible';

export type EvidenceType =
  | 'message'
  | 'sms'
  | 'email'
  | 'paystub'
  | 'bank_statement'
  | 'employment_contract'
  | 'attendance_record'
  | 'work_schedule'
  | 'recording'
  | 'photo'
  | 'memo';

export interface AnswerRequest {
  query: string;
  top_k: number;
  ef_search: number;
}

export interface ChunkResult {
  chunk_id: string;
  citation_label: string;
  law_name: string;
  article_no: string;
  article_title: string;
  paragraph_no: number | null;
  content: string;
  similarity: number;
  tier: number;
  structure_path: string | null;
}

export interface GroundedChunkResult extends ChunkResult {
  context_id: number;
}

export interface AnswerResponse {
  query: string;
  answer: string;
  key_points: string[];
  cautions: string[];
  cited_articles: string[];
  grounded_context_ids: number[];
  retrieved_chunks: GroundedChunkResult[];
  retrieval_total: number;
  model_name: string;
}

export interface WorkerInfo {
  name_or_placeholder?: string | null;
  nationality?: string | null;
  preferred_language?: DraftLanguage | null;
}

export interface EmployerInfo {
  company_name_or_placeholder?: string | null;
  representative_name?: string | null;
  workplace_address?: string | null;
  employee_count?: number | null;
  employee_count_over_5?: boolean | null;
  workplace_jurisdiction?: string | null;
}

export interface EmploymentInfo {
  start_date?: string | null;
  last_work_date?: string | null;
  job_title?: string | null;
  wage_terms?: string | null;
  wage_type?: WageType | null;
  wage_payment_day?: number | null;
  employment_contract_exists?: boolean | null;
  continuous_service_over_1_year?: boolean | null;
}

export interface DismissalInfo {
  dismissal_notice_date?: string | null;
  dismissal_effective_date?: string | null;
  notice_method?: NoticeMethod | null;
  written_notice_received?: boolean | null;
  dismissal_reason_provided?: boolean | null;
  dismissal_reason?: string | null;
  advance_notice_30_days?: boolean | null;
  reinstatement_requested?: boolean | null;
  monetary_compensation_requested?: boolean | null;
  opportunity_to_explain?: boolean | null;
  prior_disciplinary_action?: boolean | null;
}

export interface UnpaidWageInfo {
  final_wage_paid?: boolean | null;
  unpaid_wage_amount?: number | null;
  unpaid_period_start?: string | null;
  unpaid_period_end?: string | null;
  severance_paid?: boolean | null;
  unpaid_severance_amount?: number | null;
  days_since_separation_over_14?: boolean | null;
}

export interface WorkplaceChangeInfo {
  worker_name_or_alias?: string | null;
  nationality_or_language?: string | null;
  job_duties?: string | null;
  company_name?: string | null;
  workplace_location?: string | null;
  manager_info?: string | null;
  standard_contract_used?: WorkplaceChangeSelectValue | null;
  dormitory_cost_disclosed_in_contract?: WorkplaceChangeSelectValue | null;
  actual_dormitory_deduction?: string | null;
  dormitory_environment_issue?: boolean | null;
  excessive_dormitory_deduction?: boolean | null;
  verbal_abuse_or_discrimination?: boolean | null;
  contract_actual_difference?: boolean | null;
  contract_actual_difference_detail?: string | null;
  other_reason?: string | null;
  reason_summary_request?: string | null;
  pre_consultation_check_request?: string | null;
}

export interface TimelineEvent {
  date?: string | null;
  event: string;
  evidence_refs: string[];
}

export interface EvidenceItem {
  type: EvidenceType;
  description: string;
  status: EvidenceStatus;
}

export interface LegalBasisInput {
  answer_query: string | null;
  answer: string | null;
  key_points: string[];
  cautions: string[];
  cited_articles: string[];
  source_context_ids: number[];
  retrieved_chunks: GroundedChunkResult[];
}

export interface CaseIntake {
  scenario_id: ScenarioId;
  document_type: DocumentType;
  language: DraftLanguage;
  worker_info: WorkerInfo;
  employer_info: EmployerInfo;
  employment_info: EmploymentInfo;
  dismissal_info: DismissalInfo;
  unpaid_wage_info: UnpaidWageInfo;
  incident_timeline: TimelineEvent[];
  claims: Claim[];
  evidence_items: EvidenceItem[];
  requested_actions: string[];
  intake_notes?: string | null;
}

export interface DocumentDraftRequest {
  case_intake: CaseIntake;
  legal_basis: LegalBasisInput;
}

export interface DraftPartySection {
  worker: string;
  employer: string;
  representative_name?: string | null;
  workplace_address?: string | null;
}

export interface DraftLegalBasisSection {
  citation_label: string;
  summary: string;
  source_context_ids: number[];
}

export interface DocumentDraftResponse {
  document_type: DocumentType;
  title: string;
  recipient: string;
  language: DraftLanguage;
  parties: DraftPartySection;
  facts: string[];
  legal_basis: DraftLegalBasisSection[];
  request: string[];
  evidence_checklist: string[];
  missing_fields: string[];
  cautions: string[];
  cited_articles: string[];
  source_context_ids: number[];
  missing_legal_basis: string[];
  rendered_text: string;
}

export interface CaseIntakeFormValues {
  worker_info?: WorkerInfo | null;
  employer_info?: EmployerInfo | null;
  employment_info?: EmploymentInfo | null;
  dismissal_info?: DismissalInfo | null;
  unpaid_wage_info?: UnpaidWageInfo | null;
  workplace_change_info?: WorkplaceChangeInfo | null;
  intake_notes?: string | null;
}

export interface TimelineInput {
  date?: string | null;
  event?: string | null;
  evidence_refs?: Array<string | null | undefined> | null;
}

export interface EvidenceItemInput {
  type?: EvidenceType | null;
  description?: string | null;
  status?: EvidenceUiStatus | null;
}

export interface BuildCaseIntakeInput {
  selected_document_type: DocumentType;
  form_values?: CaseIntakeFormValues | null;
  evidence_items?: EvidenceItemInput[] | null;
  incident_timeline?: TimelineInput[] | null;
}

export interface ApiErrorInfo {
  status: number;
  message: string;
  retryable: boolean;
}
