export type BridgeSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type LawRef =
  | string
  | {
      label?: string | null;
      article?: string | null;
      citation?: string | null;
    };

export interface DetectedIssue {
  title: string;
  severity: BridgeSeverity;
  law_ref?: LawRef | null;
  description: string;
}

export interface CreateBridgeRunRequest {
  before_review_job_id: string;
}

export interface BridgeOutputResponse {
  bridge_run_id: string;
  scenario_id: 'SCN-001';
  user_visible_summary: string;
  issue_categories?: string[] | null;
  risk_tags?: string[] | null;
  detected_issues?: DetectedIssue[] | null;
  law_refs?: LawRef[] | null;
  recommended_next_actions?: string[] | null;
  after_query_seed?: string | null;
}

export type BridgeRunResponse = BridgeOutputResponse;
