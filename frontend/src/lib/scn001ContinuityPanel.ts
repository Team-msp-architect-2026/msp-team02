import type { AnswerResponse, DocumentDraftResponse } from '@/types/api';
import type { AnswerOrigin } from '@/types/flow';

import {
  SCN001_FROZEN_DRAFT_DOCUMENT_TYPE,
  SCN001_FROZEN_DRAFT_PRESET_ID,
  isScn001FrozenDraftPath,
} from './scenarioPresetDrafts';
import type { ScenarioPresetId } from './scenarioPresets';

export const SCN001_CONTINUITY_GROUPS = [
  {
    title: '이전 검토에서 이어진 쟁점',
    items: ['표준근로계약서 미사용 가능성', '기숙사 정보 누락', '숙소비 공제 위험'],
  },
  {
    title: '이번 상담 질문/초안에서 이어진 쟁점',
    items: ['기숙사 환경', '숙소비 공제', '폭언·차별', '사업장 변경 사유 정리'],
  },
  {
    title: '현재 초안에서 확인할 점',
    items: [
      '계약서 내용과 실제 근로조건 차이',
      '공제 내역과 급여명세서',
      '기숙사 사진/메시지/진술 등 증거',
    ],
  },
] as const;

export const SCN001_CONTINUITY_BOUNDARY =
  '이 패널은 이전 검토와 현재 질문의 연결 지점을 설명합니다. 법적 근거는 현재 답변의 근거 조문과 출처 컨텍스트만 사용합니다.';

interface Scn001ResultContinuityInput {
  answer: AnswerResponse | null;
  selectedPresetId: ScenarioPresetId | null;
  userStatement: string;
  answerOrigin: AnswerOrigin;
}

interface Scn001DraftContinuityInput extends Scn001ResultContinuityInput {
  draft: DocumentDraftResponse | null;
}

export function shouldShowScn001FixedPresetResultContinuityPanel({
  answer,
  selectedPresetId,
  userStatement,
  answerOrigin,
}: Scn001ResultContinuityInput): boolean {
  return isScn001FrozenDraftPath({
    answer,
    selectedPresetId,
    userStatement,
    answerOrigin,
  });
}

export function shouldShowScn001FixedPresetDraftContinuityPanel({
  answer,
  draft,
  selectedPresetId,
  userStatement,
  answerOrigin,
}: Scn001DraftContinuityInput): boolean {
  if (
    selectedPresetId !== SCN001_FROZEN_DRAFT_PRESET_ID ||
    draft?.document_type !== SCN001_FROZEN_DRAFT_DOCUMENT_TYPE ||
    answerOrigin === 'bridge_handoff' ||
    !hasDraftEvidence(draft)
  ) {
    return false;
  }

  return isScn001FrozenDraftPath({
    answer,
    selectedPresetId,
    userStatement,
    answerOrigin,
    selectedDocumentType: draft.document_type,
  });
}

function hasDraftEvidence(draft: DocumentDraftResponse | null): boolean {
  return (
    draft !== null &&
    draft.cited_articles.length > 0 &&
    draft.source_context_ids.length > 0 &&
    draft.legal_basis.length > 0
  );
}
