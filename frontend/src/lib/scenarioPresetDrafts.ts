import type {
  AnswerResponse,
  CaseIntake,
  CaseIntakeFormValues,
  DocumentDraftResponse,
  DocumentType,
  DraftLegalBasisSection,
  EvidenceItem,
  EvidenceItemInput,
  EvidenceStatus,
  EvidenceType,
  LegalBasisInput,
  TimelineEvent,
  TimelineInput,
  WorkplaceChangeInfo,
  WorkplaceChangeSelectValue,
} from '@/types/api';
import type { AnswerOrigin } from '@/types/flow';

import { getScenarioPreset, type ScenarioPresetId } from './scenarioPresets';

export const SCN001_FROZEN_DRAFT_PRESET_ID: ScenarioPresetId =
  'SCN-001-BRIDGE-DEMO';
export const SCN001_FROZEN_DRAFT_DOCUMENT_TYPE: DocumentType =
  'workplace_change_reason_summary';

interface Scn001FrozenDraftPathInput {
  answer: AnswerResponse | null;
  selectedPresetId: ScenarioPresetId | null;
  userStatement: string;
  answerOrigin: AnswerOrigin;
  selectedDocumentType?: DocumentType | null;
}

const scn001CitedArticles = [
  '외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)',
  '외국인근로자의 고용 등에 관한 법률 시행령 제26조 (기숙사 정보의 제공) [중복순번 2]',
  '외국인근로자의 고용 등에 관한 법률 시행규칙 제8조 (표준근로계약서)',
  '외국인근로자의 고용 등에 관한 법률 제9조 (근로계약)',
  '근로기준법 제17조 (근로조건의 명시)',
  '외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]',
  '외국인근로자의 고용 등에 관한 법률 제22조 (차별 금지)',
  '외국인근로자의 고용 등에 관한 법률 시행규칙 제16조 (사업 또는 사업장의 변경)',
] as const;

const scn001SourceContextIds = [1, 3, 5, 6, 7, 8, 9, 2] as const;

const confirmNeeded = '[확인 필요]';

const workplaceChangeSelectLabels: Record<WorkplaceChangeSelectValue, string> = {
  yes: '예',
  no: '아니오',
  unknown: '확인 필요',
};

const evidenceTypeLabels: Record<EvidenceType, string> = {
  message: '메신저 대화',
  sms: '문자',
  email: '이메일',
  paystub: '급여명세서',
  bank_statement: '급여 입금 내역',
  employment_contract: '근로계약서',
  attendance_record: '출퇴근 기록',
  work_schedule: '근무표',
  recording: '녹음',
  photo: '사진',
  memo: '메모',
};

const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  available: '확보함',
  needs_collection: '확보 필요',
  unknown: '확인 필요',
};

const scenarioPresetDrafts: Partial<Record<ScenarioPresetId, DocumentDraftResponse>> = {
  [SCN001_FROZEN_DRAFT_PRESET_ID]: {
    document_type: SCN001_FROZEN_DRAFT_DOCUMENT_TYPE,
    title: '사업장 변경 사유 정리서 초안',
    recipient: '출입국·외국인관서 또는 관할기관 확인 필요',
    language: 'ko',
    parties: {
      worker: '근로자 성명 확인 필요',
      employer: '사업장명 확인 필요',
      representative_name: '확인 필요',
      workplace_address: '확인 필요',
    },
    facts: [
      '이전 계약서 분석 요약에서는 표준근로계약서 미사용, 기숙사 정보 누락, 숙소비 공제 위험이 표시되었습니다.',
      '신청인 진술에 따르면 실제 근무 중 기숙사 환경이 열악했고 월급에서 숙소비가 많이 공제되었습니다.',
      '신청인 진술에 따르면 외국인이라는 이유의 폭언과 차별적 처우도 있었다고 합니다.',
      '위 내용은 사업장 변경 사유를 설명하기 위한 사건 경위이며, 법적 근거는 아래 인용 조문 범위로만 제한됩니다.',
    ],
    legal_basis: [
      {
        citation_label:
          '외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)',
        summary:
          '근로조건 위반, 위법한 기숙사 제공, 부당한 처우 등 외국인근로자의 책임이 아닌 사유로 근로를 계속할 수 없다고 인정되는 경우 사업 또는 사업장 변경 신청 사유가 될 수 있습니다.',
        source_context_ids: [1],
      },
      {
        citation_label:
          '외국인근로자의 고용 등에 관한 법률 시행규칙 제16조 (사업 또는 사업장의 변경)',
        summary:
          '사업장 변경 신청 시 신청서와 필요한 확인 자료 제출이 문제될 수 있으며, 관할 기관의 자료 요청과 처리 절차를 확인해야 합니다.',
        source_context_ids: [2],
      },
      {
        citation_label:
          '외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]',
        summary:
          '사용자가 기숙사를 제공하는 경우 건강과 안전을 지킬 수 있도록 해야 하며, 구조·설비·설치 장소·주거 환경·면적 등 정보를 사전에 제공해야 합니다.',
        source_context_ids: [8],
      },
      {
        citation_label:
          '외국인근로자의 고용 등에 관한 법률 시행령 제26조 (기숙사 정보의 제공) [중복순번 2]',
        summary:
          '기숙사 정보 제공 및 변경 정보 제공은 고용노동부장관이 정하는 방식과 기숙사 설치·운영 사항을 기준으로 확인해야 합니다.',
        source_context_ids: [3],
      },
      {
        citation_label: '외국인근로자의 고용 등에 관한 법률 제9조 (근로계약)',
        summary:
          '외국인근로자를 고용하려면 표준근로계약서를 사용하여 근로계약을 체결해야 합니다.',
        source_context_ids: [6],
      },
      {
        citation_label: '외국인근로자의 고용 등에 관한 법률 시행규칙 제8조 (표준근로계약서)',
        summary:
          '표준근로계약서는 법령상 정한 서식에 따르는지 확인해야 합니다.',
        source_context_ids: [5],
      },
      {
        citation_label: '근로기준법 제17조 (근로조건의 명시)',
        summary:
          '임금, 소정근로시간, 휴일, 연차 유급휴가 등 주요 근로조건은 명시되고 임금 관련 사항은 서면으로 교부되어야 합니다.',
        source_context_ids: [7],
      },
      {
        citation_label: '외국인근로자의 고용 등에 관한 법률 제22조 (차별 금지)',
        summary:
          '사용자는 외국인근로자라는 이유로 부당하게 차별하여 처우해서는 안 됩니다.',
        source_context_ids: [9],
      },
    ],
    request: [
      '신청인 진술과 증빙자료를 바탕으로 사업장 변경 신청 사유 해당 여부를 검토해 주시기 바랍니다.',
      '기숙사 제공, 숙소비 공제, 차별적 처우 관련 자료를 어떤 방식으로 제출해야 하는지 안내해 주시기 바랍니다.',
      '근로계약 종료일 또는 변경 신청일과 관련된 기한을 확인해 주시기 바랍니다.',
    ],
    evidence_checklist: [
      '근로계약서, 표준근로계약서 교부 여부를 확인할 수 있는 자료',
      '기숙사 정보 제공 문서, 기숙사 사진, 주소, 면적, 설비 상태 자료',
      '월급명세서, 급여 입금 내역, 숙소비 공제 내역',
      '폭언·차별 발언 관련 메시지, 녹취, 목격자 메모, 날짜별 기록',
      '근로계약 종료일, 사업장 변경 신청일, 관할기관 상담 기록',
    ],
    missing_fields: [
      '신청인 성명, 외국인등록 여부, 체류자격 등 본인 확인 정보',
      '사업장명, 대표자명, 사업장 주소, 관할기관',
      '근로계약 체결일, 실제 근무 시작일, 근로계약 종료 여부와 종료일',
      '표준근로계약서 미사용 여부를 확인할 계약서 사본 또는 미교부 정황',
      '기숙사 위치, 구조, 설비, 면적, 주거 환경의 구체적 상태와 사진',
      '숙소비 공제 금액, 공제 기간, 공제 동의 여부와 임금명세서',
      '폭언·차별적 처우의 날짜, 발언 내용, 행위자, 증거 자료',
      '사업장 변경 신청을 이미 했는지 여부와 신청일',
    ],
    cautions: [
      '이 초안은 SCN-001-BRIDGE-DEMO 고정 답변을 바탕으로 한 발표용 고정 초안입니다.',
      '이전 계약서 분석 요약과 Bridge 내용은 사건 경위 설명일 뿐, 독립된 법적 근거나 인용 조문으로 사용하지 않습니다.',
      '실제 제출 전에는 관할기관, 제출 서식, 신청 기한, 증빙자료 요건을 반드시 확인해야 합니다.',
      '사용자가 제공하지 않은 사실은 확인 필요 항목으로 남겨두고 단정하지 않았습니다.',
    ],
    cited_articles: [...scn001CitedArticles],
    source_context_ids: [...scn001SourceContextIds],
    missing_legal_basis: [
      '사업장 변경 사유 인정에 필요한 세부 고시, 관할기관 운영 기준, 개별 사실 확인은 별도 검토가 필요합니다.',
    ],
    rendered_text: [
      '사업장 변경 사유 정리서 초안',
      '',
      '수신: 출입국·외국인관서 또는 관할기관 확인 필요',
      '작성자: 근로자 성명 확인 필요',
      '상대방 사업장: 사업장명 확인 필요',
      '',
      '1. 사건 경위',
      '- 이전 계약서 분석 요약에서는 표준근로계약서 미사용, 기숙사 정보 누락, 숙소비 공제 위험이 표시되었습니다.',
      '- 신청인 진술에 따르면 실제 근무 중 기숙사 환경이 열악했고 월급에서 숙소비가 많이 공제되었습니다.',
      '- 신청인 진술에 따르면 외국인이라는 이유의 폭언과 차별적 처우도 있었다고 합니다.',
      '- 위 내용은 사업장 변경 사유를 설명하기 위한 배경이며, 실제 제출 전 날짜, 금액, 증거, 관할기관을 확인해야 합니다.',
      '',
      '2. 관련 법적 근거',
      '- 외국인근로자의 고용 등에 관한 법률 제25조는 근로조건 위반, 위법한 기숙사 제공, 부당한 처우 등 근로자 책임이 아닌 사유가 있는 경우 사업 또는 사업장 변경 신청 사유가 될 수 있음을 정합니다.',
      '- 외국인근로자의 고용 등에 관한 법률 시행규칙 제16조는 사업장 변경 신청서와 필요한 확인 자료 제출 절차를 정합니다.',
      '- 외국인근로자의 고용 등에 관한 법률 제22조 및 시행령 제26조는 기숙사 제공 시 건강과 안전, 기숙사 정보 제공 의무를 확인할 근거가 됩니다.',
      '- 외국인근로자의 고용 등에 관한 법률 제9조, 시행규칙 제8조, 근로기준법 제17조는 표준근로계약서 사용과 근로조건 서면 명시를 확인할 근거가 됩니다.',
      '- 외국인근로자의 고용 등에 관한 법률 제22조의 차별 금지 조항은 외국인근로자라는 이유의 부당한 차별 처우를 확인할 근거가 됩니다.',
      '',
      '3. 요청 취지',
      '- 신청인 진술과 증빙자료를 바탕으로 사업장 변경 신청 사유 해당 여부를 검토해 주시기 바랍니다.',
      '- 기숙사 제공, 숙소비 공제, 차별적 처우 관련 자료를 어떤 방식으로 제출해야 하는지 안내해 주시기 바랍니다.',
      '- 근로계약 종료일 또는 변경 신청일과 관련된 기한을 확인해 주시기 바랍니다.',
      '',
      '4. 확인 필요 항목',
      '- 신청인 성명, 외국인등록 여부, 체류자격 등 본인 확인 정보',
      '- 사업장명, 대표자명, 사업장 주소, 관할기관',
      '- 근로계약 체결일, 실제 근무 시작일, 근로계약 종료 여부와 종료일',
      '- 표준근로계약서 미사용 여부를 확인할 계약서 사본 또는 미교부 정황',
      '- 기숙사 위치, 구조, 설비, 면적, 주거 환경의 구체적 상태와 사진',
      '- 숙소비 공제 금액, 공제 기간, 공제 동의 여부와 임금명세서',
      '- 폭언·차별적 처우의 날짜, 발언 내용, 행위자, 증거 자료',
      '- 사업장 변경 신청을 이미 했는지 여부와 신청일',
      '',
      '주의: 이 초안은 제출 전 검토용입니다. 이전 계약서 분석 요약과 Bridge 내용은 사건 경위 설명이며, 법적 근거는 인용 조문 범위로만 제한됩니다.',
    ].join('\n'),
  },
};

export function getScenarioPresetDraft(
  presetId: ScenarioPresetId | null | undefined,
): DocumentDraftResponse | null {
  if (!presetId) {
    return null;
  }

  const draft = scenarioPresetDrafts[presetId];

  return draft ? cloneDocumentDraft(draft) : null;
}

export function isScn001FrozenDraftPath({
  answer,
  selectedPresetId,
  userStatement,
  answerOrigin,
  selectedDocumentType,
}: Scn001FrozenDraftPathInput): boolean {
  const activePreset = getScenarioPreset(selectedPresetId);

  if (
    answer === null ||
    selectedPresetId !== SCN001_FROZEN_DRAFT_PRESET_ID ||
    !activePreset ||
    activePreset.id !== SCN001_FROZEN_DRAFT_PRESET_ID
  ) {
    return false;
  }

  return (
    userStatement.trim() === activePreset.query &&
    answer.query.trim() === activePreset.query &&
    answer.cited_articles.length > 0 &&
    answer.grounded_context_ids.length > 0 &&
    answerOrigin !== 'bridge_handoff' &&
    (selectedDocumentType === undefined ||
      selectedDocumentType === SCN001_FROZEN_DRAFT_DOCUMENT_TYPE)
  );
}

interface BuildScn001FrozenDraftFromIntakeInput {
  baseDraft: DocumentDraftResponse;
  formValues: CaseIntakeFormValues;
  evidenceItems: EvidenceItemInput[];
  incidentTimeline: TimelineInput[];
  legalBasis: LegalBasisInput;
}

interface BuildScn001CaseIntakeSnapshotInput {
  baseDraft: DocumentDraftResponse;
  selectedDocumentType: DocumentType;
  formValues: CaseIntakeFormValues;
  evidenceItems: EvidenceItemInput[];
  incidentTimeline: TimelineInput[];
}

export function buildScn001FrozenDraftFromIntake({
  baseDraft,
  formValues,
  evidenceItems,
  incidentTimeline,
  legalBasis,
}: BuildScn001FrozenDraftFromIntakeInput): DocumentDraftResponse {
  const base = cloneDocumentDraft(baseDraft);
  const workplaceChangeInfo = formValues.workplace_change_info ?? {};
  const timeline = cleanScn001Timeline(incidentTimeline);
  const evidence = cleanScn001EvidenceItems(evidenceItems);
  const legalBasisFromAnswer = filterLegalBasisToAnswerEvidence(
    base.legal_basis,
    legalBasis,
  );
  const citedArticles = filterCitedArticlesToAnswerEvidence(
    base.cited_articles,
    legalBasis,
  );
  const sourceContextIds = filterSourceContextIdsToAnswerEvidence(
    base.source_context_ids,
    legalBasis,
  );
  const parties = buildScn001Parties(base, workplaceChangeInfo);
  const facts = buildScn001Facts(base, workplaceChangeInfo, timeline);
  const request = buildScn001Request(base, workplaceChangeInfo);
  const evidenceChecklist = buildScn001EvidenceChecklist(base, evidence);
  const missingFields = buildScn001MissingFields(
    workplaceChangeInfo,
    timeline,
    evidence,
  );
  const draft: DocumentDraftResponse = {
    ...base,
    parties,
    facts,
    legal_basis: legalBasisFromAnswer,
    request,
    evidence_checklist: evidenceChecklist,
    missing_fields: missingFields,
    cited_articles: citedArticles,
    source_context_ids: sourceContextIds,
  };

  return {
    ...draft,
    rendered_text: renderScn001DraftText(draft, timeline, evidence),
  };
}

export function buildScn001CaseIntakeSnapshot({
  baseDraft,
  selectedDocumentType,
  formValues,
  evidenceItems,
  incidentTimeline,
}: BuildScn001CaseIntakeSnapshotInput): CaseIntake {
  const workplaceChangeInfo = formValues.workplace_change_info ?? {};
  const workerName = optionalText(workplaceChangeInfo.worker_name_or_alias);
  const nationality = optionalText(workplaceChangeInfo.nationality_or_language);
  const companyName = optionalText(workplaceChangeInfo.company_name);
  const managerInfo = optionalText(workplaceChangeInfo.manager_info);
  const workplaceLocation = optionalText(workplaceChangeInfo.workplace_location);
  const jobDuties = optionalText(workplaceChangeInfo.job_duties);
  const employmentContractExists = selectValueToBoolean(
    workplaceChangeInfo.standard_contract_used,
  );

  return {
    scenario_id: 'SCN-001',
    document_type: selectedDocumentType,
    language: 'ko',
    worker_info: {
      ...(workerName ? { name_or_placeholder: workerName } : {}),
      ...(nationality ? { nationality } : {}),
    },
    employer_info: {
      ...(companyName ? { company_name_or_placeholder: companyName } : {}),
      ...(managerInfo ? { representative_name: managerInfo } : {}),
      ...(workplaceLocation ? { workplace_address: workplaceLocation } : {}),
    },
    employment_info: {
      ...(jobDuties ? { job_title: jobDuties } : {}),
      ...(typeof employmentContractExists === 'boolean'
        ? { employment_contract_exists: employmentContractExists }
        : {}),
    },
    dismissal_info: {},
    unpaid_wage_info: {},
    incident_timeline: cleanScn001Timeline(incidentTimeline),
    claims: [],
    evidence_items: cleanScn001EvidenceItems(evidenceItems),
    requested_actions: buildScn001Request(baseDraft, workplaceChangeInfo),
    intake_notes: optionalText(formValues.intake_notes) ?? null,
  };
}

function cloneDocumentDraft(draft: DocumentDraftResponse): DocumentDraftResponse {
  return {
    ...draft,
    parties: { ...draft.parties },
    facts: [...draft.facts],
    legal_basis: draft.legal_basis.map((basis) => ({
      ...basis,
      source_context_ids: [...basis.source_context_ids],
    })),
    request: [...draft.request],
    evidence_checklist: [...draft.evidence_checklist],
    missing_fields: [...draft.missing_fields],
    cautions: [...draft.cautions],
    cited_articles: [...draft.cited_articles],
    source_context_ids: [...draft.source_context_ids],
    missing_legal_basis: [...draft.missing_legal_basis],
  };
}

function buildScn001Parties(
  base: DocumentDraftResponse,
  info: WorkplaceChangeInfo,
): DocumentDraftResponse['parties'] {
  return {
    ...base.parties,
    worker: valueOrConfirmNeeded(info.worker_name_or_alias),
    employer: valueOrConfirmNeeded(info.company_name),
    representative_name: valueOrConfirmNeeded(info.manager_info),
    workplace_address: valueOrConfirmNeeded(info.workplace_location),
  };
}

function buildScn001Facts(
  base: DocumentDraftResponse,
  info: WorkplaceChangeInfo,
  timeline: TimelineEvent[],
): string[] {
  const reasonText = buildReasonLabels(info).join(', ');
  const timelineText =
    timeline.length > 0
      ? timeline
          .map((item) => `${item.date ?? '일자 확인 필요'}: ${item.event}`)
          .join(' / ')
      : confirmNeeded;

  return uniqueTextList([
    ...base.facts,
    `근로자 정보: 이름 또는 별칭 ${valueOrConfirmNeeded(
      info.worker_name_or_alias,
    )}, 국적/언어 ${valueOrConfirmNeeded(
      info.nationality_or_language,
    )}, 담당 업무 ${valueOrConfirmNeeded(info.job_duties)}.`,
    `사업장 정보: 회사명 ${valueOrConfirmNeeded(
      info.company_name,
    )}, 근무지 ${valueOrConfirmNeeded(info.workplace_location)}, 사용자/관리자 ${valueOrConfirmNeeded(
      info.manager_info,
    )}.`,
    `계약서 및 숙소비 정보: 표준근로계약서 사용 여부 ${selectValueOrConfirmNeeded(
      info.standard_contract_used,
    )}, 계약서상 숙소비 정보 ${selectValueOrConfirmNeeded(
      info.dormitory_cost_disclosed_in_contract,
    )}, 실제 숙소비 공제 ${valueOrConfirmNeeded(info.actual_dormitory_deduction)}.`,
    `계약 조건과 실제 조건 차이: ${valueOrConfirmNeeded(
      info.contract_actual_difference_detail,
    )}.`,
    `사업장 변경 사유로 정리할 항목: ${reasonText.length > 0 ? reasonText : confirmNeeded}.`,
    `사용자 입력 사건 경위: ${timelineText}.`,
    'Bridge/계약서 분석 내용은 사건 경위 배경 설명으로만 사용하고, 법적 근거는 고정 답변의 인용 조문 범위로 제한합니다.',
  ]);
}

function buildScn001Request(
  base: DocumentDraftResponse,
  info: WorkplaceChangeInfo,
): string[] {
  return uniqueTextList([
    `사업장 변경 사유 정리 요청: ${valueOrConfirmNeeded(
      info.reason_summary_request,
    )}`,
    `상담/신고 전 확인 필요 사항: ${valueOrConfirmNeeded(
      info.pre_consultation_check_request,
    )}`,
    ...base.request,
  ]);
}

function buildScn001EvidenceChecklist(
  base: DocumentDraftResponse,
  evidence: EvidenceItem[],
): string[] {
  const userEvidenceItems = evidence.map(
    (item) =>
      `사용자 입력 증거: ${evidenceTypeLabels[item.type]} - ${item.description} (${evidenceStatusLabels[item.status]})`,
  );

  return uniqueTextList([...userEvidenceItems, ...base.evidence_checklist]);
}

function buildScn001MissingFields(
  info: WorkplaceChangeInfo,
  timeline: TimelineEvent[],
  evidence: EvidenceItem[],
): string[] {
  const missingFields: string[] = [];

  if (!optionalText(info.worker_name_or_alias)) {
    missingFields.push('근로자 이름 또는 별칭');
  }
  if (!optionalText(info.nationality_or_language)) {
    missingFields.push('국적/언어');
  }
  if (!optionalText(info.job_duties)) {
    missingFields.push('담당 업무');
  }
  if (!optionalText(info.company_name)) {
    missingFields.push('회사명');
  }
  if (!optionalText(info.workplace_location)) {
    missingFields.push('근무지');
  }
  if (!optionalText(info.manager_info)) {
    missingFields.push('사용자/관리자 정보');
  }
  if (!hasConfirmedSelectValue(info.standard_contract_used)) {
    missingFields.push('표준근로계약서 사용 여부');
  }
  if (!hasConfirmedSelectValue(info.dormitory_cost_disclosed_in_contract)) {
    missingFields.push('계약서상 기숙사/숙소비 정보 기재 여부');
  }
  if (!optionalText(info.actual_dormitory_deduction)) {
    missingFields.push('실제 공제된 숙소비 또는 공제 방식');
  }
  if (
    info.contract_actual_difference === true &&
    !optionalText(info.contract_actual_difference_detail)
  ) {
    missingFields.push('계약 조건과 실제 조건 차이의 구체적 내용');
  }
  if (!hasAnyWorkplaceChangeReason(info)) {
    missingFields.push('사업장 변경 사유 선택 또는 기타 사유');
  }
  if (!optionalText(info.reason_summary_request)) {
    missingFields.push('사업장 변경 사유 정리 요청 내용');
  }
  if (!optionalText(info.pre_consultation_check_request)) {
    missingFields.push('상담/신고 전 확인 필요 사항');
  }
  if (timeline.length === 0) {
    missingFields.push('날짜별 사건 경위');
  }
  if (evidence.length === 0) {
    missingFields.push('증거 자료 목록');
  }

  return uniqueTextList(missingFields.map((field) => `${field} 확인 필요`));
}

function renderScn001DraftText(
  draft: DocumentDraftResponse,
  timeline: TimelineEvent[],
  evidence: EvidenceItem[],
): string {
  return [
    draft.title,
    '',
    `수신: ${draft.recipient}`,
    `작성자: ${draft.parties.worker}`,
    `상대방 사업장: ${draft.parties.employer}`,
    `근무지: ${draft.parties.workplace_address ?? confirmNeeded}`,
    `사용자/관리자: ${draft.parties.representative_name ?? confirmNeeded}`,
    '',
    '1. 사건 경위 및 배경',
    ...formatList(draft.facts),
    '',
    '2. 관련 법적 근거',
    ...formatList(
      draft.legal_basis.map(
        (basis) => `${basis.citation_label}: ${basis.summary}`,
      ),
    ),
    '',
    '3. 요청사항',
    ...formatList(draft.request),
    '',
    '4. 사건 경위 입력',
    ...formatList(
      timeline.length > 0
        ? timeline.map((item) => `${item.date ?? '일자 확인 필요'} - ${item.event}`)
        : [confirmNeeded],
    ),
    '',
    '5. 증거 및 준비 자료',
    ...formatList(
      evidence.length > 0
        ? evidence.map(
            (item) =>
              `${evidenceTypeLabels[item.type]} - ${item.description} (${evidenceStatusLabels[item.status]})`,
          )
        : [confirmNeeded],
    ),
    '',
    '6. 확인 필요 항목',
    ...formatList(draft.missing_fields),
    '',
    '주의: 이 초안은 제출 전 검토용입니다. Bridge/계약서 분석 내용은 사건 경위 설명이며, 법적 근거는 고정 답변의 인용 조문 범위로만 제한됩니다.',
  ].join('\n');
}

function filterLegalBasisToAnswerEvidence(
  legalBasisSections: DraftLegalBasisSection[],
  legalBasis: LegalBasisInput,
): DraftLegalBasisSection[] {
  const allowedCitations = new Set(legalBasis.cited_articles);
  const allowedContextIds = new Set(legalBasis.source_context_ids);

  return legalBasisSections.flatMap((basis) => {
    const sourceContextIds = basis.source_context_ids.filter((contextId) =>
      allowedContextIds.has(contextId),
    );

    if (!allowedCitations.has(basis.citation_label) || sourceContextIds.length === 0) {
      return [];
    }

    return [
      {
        ...basis,
        source_context_ids: sourceContextIds,
      },
    ];
  });
}

function filterCitedArticlesToAnswerEvidence(
  citedArticles: string[],
  legalBasis: LegalBasisInput,
): string[] {
  const allowedCitations = new Set(legalBasis.cited_articles);
  return citedArticles.filter((citation) => allowedCitations.has(citation));
}

function filterSourceContextIdsToAnswerEvidence(
  sourceContextIds: number[],
  legalBasis: LegalBasisInput,
): number[] {
  const allowedContextIds = new Set(legalBasis.source_context_ids);
  return sourceContextIds.filter((contextId) => allowedContextIds.has(contextId));
}

function buildReasonLabels(info: WorkplaceChangeInfo): string[] {
  const labels: string[] = [];

  if (info.dormitory_environment_issue === true) {
    labels.push('기숙사 환경 문제');
  }
  if (info.excessive_dormitory_deduction === true) {
    labels.push('숙소비 과다 공제');
  }
  if (info.verbal_abuse_or_discrimination === true) {
    labels.push('폭언/차별');
  }
  if (info.contract_actual_difference === true) {
    labels.push('계약 조건과 실제 조건 차이');
  }

  const otherReason = optionalText(info.other_reason);
  if (otherReason) {
    labels.push(`기타 사유: ${otherReason}`);
  }

  return labels;
}

function hasAnyWorkplaceChangeReason(info: WorkplaceChangeInfo): boolean {
  return (
    buildReasonLabels(info).length > 0 ||
    optionalText(info.contract_actual_difference_detail) !== undefined
  );
}

function cleanScn001Timeline(input?: TimelineInput[] | null): TimelineEvent[] {
  if (!input) return [];

  return input.flatMap((item) => {
    const event = optionalText(item.event);

    if (!event) {
      return [];
    }

    return [
      {
        date: optionalText(item.date) ?? null,
        event,
        evidence_refs: cleanTextList(item.evidence_refs),
      },
    ];
  });
}

function cleanScn001EvidenceItems(input?: EvidenceItemInput[] | null): EvidenceItem[] {
  if (!input) return [];

  return input.flatMap((item) => {
    const description = optionalText(item.description);

    if (!description) {
      return [];
    }

    return [
      {
        type: isEvidenceType(item.type) ? item.type : 'memo',
        description,
        status: normalizeEvidenceStatus(item.status),
      },
    ];
  });
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${confirmNeeded}`];
}

function valueOrConfirmNeeded(value: string | null | undefined): string {
  return optionalText(value) ?? confirmNeeded;
}

function selectValueOrConfirmNeeded(
  value: WorkplaceChangeSelectValue | null | undefined,
): string {
  if (!value || value === 'unknown') {
    return confirmNeeded;
  }

  return workplaceChangeSelectLabels[value];
}

function hasConfirmedSelectValue(
  value: WorkplaceChangeSelectValue | null | undefined,
): boolean {
  return value === 'yes' || value === 'no';
}

function selectValueToBoolean(
  value: WorkplaceChangeSelectValue | null | undefined,
): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

function normalizeEvidenceStatus(value: EvidenceItemInput['status']): EvidenceStatus {
  if (value === 'available' || value === 'needs_collection' || value === 'unknown') {
    return value;
  }

  return 'unknown';
}

function isEvidenceType(value: unknown): value is EvidenceType {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(evidenceTypeLabels, value)
  );
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cleanTextList(input?: Array<string | null | undefined> | null): string[] {
  if (!input) return [];

  return input.flatMap((item) => {
    const value = optionalText(item);
    return value ? [value] : [];
  });
}

function uniqueTextList(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  items.forEach((item) => {
    const value = optionalText(item);

    if (!value || seen.has(value)) {
      return;
    }

    seen.add(value);
    output.push(value);
  });

  return output;
}
