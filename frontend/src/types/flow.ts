import type {
  AnswerResponse,
  CaseIntake,
  CaseIntakeFormValues,
  DocumentDraftResponse,
  DocumentType,
  EvidenceUiStatus,
  LegalBasisInput,
} from './api';
import type { BridgeHandoffItem, BridgeHandoffState } from './bridge-handoff';
import type { BeforeReviewResult } from './before';
import type { ScenarioPresetId } from '@/lib/scenarioPresets';

export type AnswerOrigin = 'regular_after' | 'bridge_handoff';

export interface BeforeReviewMemoryState {
  review: BeforeReviewResult | null;
  completed_review_job_id: string | null;
}

export interface KLaborShieldFlowState {
  user_statement: string;
  selected_preset_id: ScenarioPresetId | null;
  answer_origin: AnswerOrigin;
  answer_response: AnswerResponse | null;
  selected_document_type: DocumentType | null;
  legal_basis: LegalBasisInput | null;
  case_intake_form: CaseIntakeFormValues | null;
  case_intake: CaseIntake | null;
  evidence_status_map: Record<string, EvidenceUiStatus>;
  draft_response: DocumentDraftResponse | null;
  bridge_handoff: BridgeHandoffState;
  before_review: BeforeReviewMemoryState;
}

export type FlowAction =
  | {
      type: 'SET_STATEMENT';
      payload: {
        statement: string;
        selected_preset_id: ScenarioPresetId | null;
        answer_origin?: AnswerOrigin;
      };
    }
  | { type: 'SET_ANSWER'; payload: AnswerResponse }
  | { type: 'SET_LEGAL_BASIS'; payload: LegalBasisInput }
  | { type: 'SET_DOCUMENT_TYPE'; payload: DocumentType }
  | { type: 'SET_CASE_INTAKE_FORM'; payload: CaseIntakeFormValues }
  | { type: 'SET_CASE_INTAKE'; payload: CaseIntake }
  | { type: 'SET_EVIDENCE_STATUS'; payload: { key: string; status: EvidenceUiStatus } }
  | { type: 'SET_DRAFT'; payload: DocumentDraftResponse }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'CLEAR_DRAFT_AND_CASE_INTAKE' }
  | { type: 'SET_BRIDGE_HANDOFF'; payload: BridgeHandoffState }
  | { type: 'ADD_BRIDGE_HANDOFF_ITEM'; payload: BridgeHandoffItem }
  | {
      type: 'SET_BRIDGE_HANDOFF_ITEM_INCLUDED';
      payload: { bridge_run_id: string; include_in_query: boolean };
    }
  | { type: 'REMOVE_BRIDGE_HANDOFF_ITEM'; payload: { bridge_run_id: string } }
  | { type: 'CLEAR_BRIDGE_HANDOFF' }
  | { type: 'SET_BEFORE_REVIEW_RESULT'; payload: BeforeReviewMemoryState }
  | { type: 'CLEAR_BEFORE_REVIEW_RESULT' }
  | { type: 'RESET' };
