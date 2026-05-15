export type BeforeScreenState = 'home' | 'loading' | 'result';
export type BeforeMockScenario = 'sen0' | 'sen1' | 'sen2';

export type BeforeReviewStatus = 'PASS' | 'WARNING' | 'VIOLATION';
export type BeforeSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BeforeReviewJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type BeforeReviewJobStepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type BeforeDisabilityType =
  | 'visual'
  | 'hearing'
  | 'mobility'
  | 'cognitive'
  | 'mental'
  | 'complex';

export interface BeforeContractInfo {
  type: string;
  employer: string;
  employee: string;
  start_date: string;
}

export interface BeforeReviewPoint {
  title: string;
  status: BeforeReviewStatus;
  severity: BeforeSeverity;
  law_ref: string;
  description: string;
}

export interface BeforeReviewEvidence {
  title: string;
  excerpt: string;
}

export interface BeforeReviewRuleResult {
  status: BeforeReviewStatus;
  severity: BeforeSeverity;
  law_ref?: string;
  message?: string;
  [key: string]: unknown;
}

export interface BeforeReviewUploadedFile {
  name: string;
  url: string;
}

export interface BeforeReviewOcrWarning {
  field: string;
  structured: unknown;
  corrected: unknown;
  note: string;
}

export interface BeforeReviewResult {
  review_id: string;
  reviewed_at: string;
  run_directory?: string;
  uploaded_files?: BeforeReviewUploadedFile[];
  contract_info: BeforeContractInfo;
  overall_result: BeforeReviewStatus;
  overall_severity: BeforeSeverity;
  headline: string;
  plain_language_summary: string;
  summary: string;
  rule_check?: Record<string, BeforeReviewRuleResult>;
  ocr_warnings?: BeforeReviewOcrWarning[];
  overall_assessment: string[];
  important_points: BeforeReviewPoint[];
  recommended_actions: string[];
  evidence: BeforeReviewEvidence[];
}

export interface BeforeReviewJobStep {
  key: string;
  label: string;
  order: number;
  status: BeforeReviewJobStepStatus;
  message?: string | null;
}

export interface BeforeReviewJob {
  job_id: string;
  status: BeforeReviewJobStatus;
  created_at: string;
  updated_at: string;
  run_directory?: string | null;
  steps: BeforeReviewJobStep[];
  error?: string | null;
  result?: BeforeReviewResult | null;
}

export interface BeforeAccessibilityCard {
  id: string;
  kind: 'right' | 'support' | 'question' | 'law';
  title: string;
  description: string;
  law_refs: string[];
  action_hint?: string;
}

export interface BeforeAccessibilityRecommendation {
  disability_type: BeforeDisabilityType;
  disability_label: string;
  overview: string;
  cards: BeforeAccessibilityCard[];
  legal_basis: string[];
}
