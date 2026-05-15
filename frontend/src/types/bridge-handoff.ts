export type BridgeHandoffItem = {
  bridge_run_id: string;
  scenario_id: 'SCN-001';
  user_visible_summary: string;
  issue_categories: string[];
  risk_tags: string[];
  law_refs: string[];
  recommended_next_actions: string[];
  after_query_seed: string | null;
  include_in_query: boolean;
};

export type BridgeHandoffState = {
  items: BridgeHandoffItem[];
};
