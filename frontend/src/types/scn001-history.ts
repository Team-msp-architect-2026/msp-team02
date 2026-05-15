export type Scn001HistoryOverallResult = 'PASS' | 'WARNING' | 'VIOLATION';

export type Scn001HistorySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Scn001HistorySourceScenario =
  | 'before_review'
  | 'preset'
  | 'mock'
  | (string & {});

export type BeforeReviewJobHistoryStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | (string & {});

export interface BeforeReviewJobHistoryItem {
  before_review_job_id: string;
  status: BeforeReviewJobHistoryStatus;
  created_at: string;
  updated_at: string;
  overall_result: Scn001HistoryOverallResult | null;
  overall_severity: Scn001HistorySeverity | null;
  summary: string | null;
  has_bridge_run: boolean;
}

export type BeforeReviewJobHistoryDetail = BeforeReviewJobHistoryItem;

export interface BridgeRunHistoryItem {
  bridge_run_id: string;
  before_review_job_id: string | null;
  scenario_id: string;
  source_scenario: Scn001HistorySourceScenario;
  user_visible_summary: string;
  issue_categories: string[];
  risk_tags: string[];
  law_refs: string[];
  recommended_next_actions: string[];
  created_at: string;
  updated_at: string;
}

export type BeforeReviewJobHistoryListResponse = BeforeReviewJobHistoryItem[];

export type BridgeRunHistoryListResponse = BridgeRunHistoryItem[];
