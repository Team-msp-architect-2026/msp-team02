import type { AnswerResponse, DocumentType, GroundedChunkResult } from '@/types/api';

export type DraftSupportMode = 'backend' | 'frontend-local' | 'unsupported';

export interface DocumentDraftCatalogItem {
  id: string;
  documentType?: DocumentType;
  label: string;
  shortLabel: string;
  subtitle: string;
  body: string;
  reason: string;
  supportMode: DraftSupportMode;
  requiredLegalSignals: readonly string[];
  requiredIntakeFields: readonly string[];
  templateAvailable: boolean;
  routeMetadata: {
    resultRoute: '/after/result';
    intakeRoute: '/after/intake' | null;
    draftRoute: '/after/draft' | null;
  };
  evalClusters: readonly string[];
}

export interface SupportedDraftDocumentOption extends DocumentDraftCatalogItem {
  documentType: DocumentType;
  supportMode: 'backend' | 'frontend-local';
}

export interface AnswerOnlyDocumentGuidance {
  title: string;
  description: string;
  detectedClusterLabel: string;
  supportMode: DraftSupportMode;
}

export interface DocumentDraftClassification {
  isEligible: boolean;
  documentTypes: Record<DocumentType, boolean>;
  availableDocumentTypes: SupportedDraftDocumentOption[];
  answerOnlyGuidance: AnswerOnlyDocumentGuidance;
}

export const DOCUMENT_DRAFT_CATALOG: readonly DocumentDraftCatalogItem[] = [
  {
    id: 'labor_office_wage_complaint',
    documentType: 'labor_office_wage_complaint',
    label: '고용노동청 임금체불 진정서 초안',
    shortLabel: '임금체불 진정서',
    subtitle: 'Labor office wage complaint',
    body: '임금 미지급, 수당, 최저임금 차액, 퇴직 후 금품청산 지연을 중심으로 정리합니다.',
    reason:
      '질문에 임금 미지급, 수당, 최저임금 차액, 퇴직 후 금품정산 신호가 있고 관련 임금 근거 조문이 확인된 경우 이어갈 수 있습니다.',
    supportMode: 'backend',
    requiredLegalSignals: [
      '근로기준법 제36조 또는 제43조 또는 제56조',
      '최저임금 차액 질문의 최저임금법 제6조',
      '퇴직금 질문의 근로자퇴직급여 보장법 제9조',
    ],
    requiredIntakeFields: [
      '근로자/회사 표시명',
      '입사일과 마지막 근무일',
      '미지급 임금·퇴직금 금액',
      '퇴직 또는 마지막 근무 후 14일 경과 여부',
      '증거 자료',
    ],
    templateAvailable: true,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: '/after/intake',
      draftRoute: '/after/draft',
    },
    evalClusters: [
      'KLS-EVAL-006 final_payment_after_resignation',
      'KLS-EVAL-007 wage_payment_principles',
      'KLS-EVAL-012 overtime_night_holiday_premium',
      'KLS-EVAL-014 minimum_wage_difference',
      'KLS-EVAL-021 retirement_payment_timing',
    ],
  },
  {
    id: 'labor_commission_unfair_dismissal_brief',
    documentType: 'labor_commission_unfair_dismissal_brief',
    label: '노동위원회 부당해고 구제신청 이유서 초안',
    shortLabel: '부당해고 이유서',
    subtitle: 'Labor commission unfair dismissal brief',
    body: '해고의 정당성, 서면통지, 해고예고, 노동위원회 구제신청 쟁점을 중심으로 정리합니다.',
    reason:
      '질문에 해고 또는 해고 절차 신호가 있고, 해고 제한·예고·서면통지·구제신청 중 관련 근거가 확인된 경우 이어갈 수 있습니다.',
    supportMode: 'backend',
    requiredLegalSignals: [
      '근로기준법 제23조 또는 제26조 또는 제27조 또는 제28조',
      '근로기준법 시행규칙 제5조',
    ],
    requiredIntakeFields: [
      '근로자/회사 표시명',
      '입사일과 해고 통보일',
      '해고 효력 발생일 또는 마지막 근무일',
      '서면통지·해고예고·해고 사유 설명 여부',
      '복직 또는 금전보상 신청 의사',
      '증거 자료',
    ],
    templateAvailable: true,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: '/after/intake',
      draftRoute: '/after/draft',
    },
    evalClusters: [
      'KLS-EVAL-003 dismissal_restriction',
      'KLS-EVAL-004 dismissal_notice_or_pay',
      'KLS-EVAL-005 written_notice_required_for_dismissal',
    ],
  },
  {
    id: 'workplace_change_reason_summary',
    documentType: 'workplace_change_reason_summary',
    label: '사업장 변경 사유 정리서 초안',
    shortLabel: '사업장 변경 사유 정리서',
    subtitle: 'Workplace change reason summary',
    body: '계약서 검토 결과와 실제 근무 중 발생한 숙소비 공제, 기숙사 환경, 차별·폭언 등 사업장 변경 사유를 정리합니다.',
    reason:
      'SCN-001-BRIDGE-DEMO 고정 입력과 고정 답변이 그대로 일치하는 발표용 경로에서만 이어갈 수 있습니다.',
    supportMode: 'frontend-local',
    requiredLegalSignals: [
      '외국인근로자의 고용 등에 관한 법률 제25조',
      '외국인근로자의 고용 등에 관한 법률 시행규칙 제16조',
      '외국인근로자의 고용 등에 관한 법률 제22조',
    ],
    requiredIntakeFields: [
      '근로자/사업장 표시 정보',
      '표준근로계약서와 기숙사 정보',
      '숙소비 공제·기숙사 환경·차별 처우',
      '날짜별 사건 경위',
      '증거 자료',
    ],
    templateAvailable: true,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: '/after/intake',
      draftRoute: '/after/draft',
    },
    evalClusters: [
      'KLS-EVAL-053 anti_discrimination_and_dormitory_info',
      'KLS-EVAL-055 workplace_change_rules',
    ],
  },
  {
    id: 'employment_equality_family_document',
    label: '고용평등·성희롱·돌봄 관련 문서',
    shortLabel: '고용평등·돌봄 문서',
    subtitle: 'Employment equality and family care document',
    body: '채용·임금 차별, 성희롱 조치, 육아휴직, 육아기 근로시간 단축, 가족돌봄휴직·휴가 관련 후보입니다.',
    reason:
      '남녀고용평등법 계열 문서 확장은 현재 열지 않았으므로 상담 답변만 제공합니다.',
    supportMode: 'unsupported',
    requiredLegalSignals: [
      '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 제19조',
      '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 제22조',
    ],
    requiredIntakeFields: ['신청 대상 가족', '신청 기간', '거절 사유', '증빙 자료'],
    templateAvailable: false,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: null,
      draftRoute: null,
    },
    evalClusters: [
      'KLS-EVAL-023..030 equality and harassment',
      'KLS-EVAL-031 childcare_leave',
      'KLS-EVAL-032 childcare_worktime_reduction',
      'KLS-EVAL-033 family_care_leave_and_vacation',
    ],
  },
  {
    id: 'safety_or_compensation_notice',
    label: '안전보건·산재 신청/통지 문서',
    shortLabel: '안전보건·산재 문서',
    subtitle: 'Safety and compensation notice',
    body: '산업안전보건, 작업중지, 산재보험 신청 관련 후보입니다.',
    reason:
      '현재 draft template과 intake schema가 없어 상담 답변만 제공합니다.',
    supportMode: 'unsupported',
    requiredLegalSignals: ['산업안전보건법', '산업재해보상보험법'],
    requiredIntakeFields: ['재해 일시', '사업장 위험 요인', '치료/휴업 정보', '증빙 자료'],
    templateAvailable: false,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: null,
      draftRoute: null,
    },
    evalClusters: ['KLS-EVAL-034..048 safety and workers compensation'],
  },
  {
    id: 'general_answer_only',
    label: '상담 답변 확인',
    shortLabel: '상담 답변',
    subtitle: 'Answer only',
    body: '근로계약, 임금명세, 근로시간, 최저임금, 중대재해 등은 현재 답변 확인 범위로 둡니다.',
    reason:
      '현재 문서 초안 카탈로그의 intake/template/근거 요건과 맞지 않아 문서 작성 CTA를 열지 않습니다.',
    supportMode: 'unsupported',
    requiredLegalSignals: [],
    requiredIntakeFields: [],
    templateAvailable: false,
    routeMetadata: {
      resultRoute: '/after/result',
      intakeRoute: null,
      draftRoute: null,
    },
    evalClusters: ['remaining KLS-EVAL answer-only clusters'],
  },
] as const;

const supportedDocumentItems = DOCUMENT_DRAFT_CATALOG.filter(
  (item): item is SupportedDraftDocumentOption =>
    'documentType' in item && item.supportMode !== 'unsupported',
);

const documentItemByType = new Map<DocumentType, SupportedDraftDocumentOption>(
  supportedDocumentItems.map((item) => [item.documentType, item]),
);

const wageRequiredCitationPatterns = [
  /근로기준법\s*제\s*36\s*조/,
];

const wageCitationPatterns = [
  ...wageRequiredCitationPatterns,
  /근로기준법\s*제\s*37\s*조/,
  /근로기준법\s*제\s*43\s*조/,
  /근로기준법\s*제\s*56\s*조/,
  /최저\s*임금법\s*제\s*6\s*조/,
];

const retirementWageCitationPatterns = [
  /근로자\s*퇴직\s*급여\s*보장법\s*제\s*9\s*조/,
];

const wageDisputePatterns = [
  /임금\s*체불/,
  /체불\s*임금/,
  /미지급\s*임금/,
  /임금\s*미지급/,
  /퇴직금.{0,24}(못\s*받|받지\s*못|안\s*받|받지\s*않|안\s*주|주지\s*않|미지급|체불|지급\s*받지\s*못|지급\s*하지\s*않)/,
  /(못\s*받|받지\s*못|안\s*받|받지\s*않|안\s*주|주지\s*않|미지급|체불|지급\s*받지\s*못|지급\s*하지\s*않).{0,24}퇴직금/,
  /(임금|월급|수당|금품).{0,24}(못\s*받|받지\s*못|안\s*받|받지\s*않|안\s*주|주지\s*않|미지급|체불|지급\s*받지\s*못|지급\s*하지\s*않)/,
  /(못\s*받|받지\s*못|안\s*받|받지\s*않|안\s*주|주지\s*않|미지급|체불|지급\s*받지\s*못|지급\s*하지\s*않).{0,24}(임금|월급|수당|금품)/,
  /금품\s*청산.{0,24}(지연|미지급|체불|14\s*일|십사\s*일)/,
  /(퇴사|퇴직|해고|마지막\s*근무).{0,32}(14\s*일|십사\s*일).{0,32}(안\s*주|미지급|체불|못\s*받|받지\s*못|지연)/,
  /(14\s*일|십사\s*일).{0,32}(퇴사|퇴직|해고|마지막\s*근무).{0,32}(안\s*주|미지급|체불|못\s*받|받지\s*못|지연)/,
];

const wagePaymentPrinciplePatterns = [
  /임금.{0,24}(일부\s*빼|공제|물건|현물|들쭉날쭉|정해진\s*날|매월|통화|직접|전액)/,
  /월급.{0,24}(일부\s*빼|공제|물건|현물|들쭉날쭉|정해진\s*날|매월|통화|직접|전액)/,
  /(일부\s*빼|공제|물건|현물|들쭉날쭉|정해진\s*날|매월|통화|직접|전액).{0,24}(임금|월급)/,
];

const wagePremiumPatterns = [
  /(연장|야간|휴일).{0,18}(수당|가산|근로)/,
  /(수당|가산).{0,18}(연장|야간|휴일)/,
  /기본\s*시급만/,
];

const minimumWageDifferencePatterns = [
  /최저\s*임금.{0,16}(보다|미만|미달|미치지\s*못).{0,18}(낮|적|시급|임금|급여)/,
  /(시급|임금|급여).{0,18}(최저\s*임금).{0,16}(보다|미만|미달|미치지\s*못)/,
  /최저\s*임금.{0,18}차액/,
  /최저\s*임금.{0,18}(못\s*받|받지\s*못|덜\s*받)/,
];

const retirementPaymentPatterns = [
  /퇴직금.{0,32}(언제|기한|지급|현금|계정|IRP|개인형\s*퇴직\s*연금|못\s*받|받지\s*못|미지급|체불)/,
  /(언제|기한|지급|현금|계정|IRP|개인형\s*퇴직\s*연금|못\s*받|받지\s*못|미지급|체불).{0,32}퇴직금/,
];

const wageTopicPatterns = [
  /임금/,
  /월급/,
  /수당/,
  /퇴직금/,
  /금품\s*청산/,
  /지연\s*이자/,
];

const dismissalCitationPatterns = [
  /근로기준법\s*제\s*23\s*조/,
  /근로기준법\s*제\s*26\s*조/,
  /근로기준법\s*제\s*27\s*조/,
  /근로기준법\s*제\s*28\s*조/,
  /근로기준법\s*시행규칙\s*제\s*5\s*조/,
];

const dismissalQuestionPatterns = [
  /부당\s*해고/,
  /해고/,
  /서면\s*통지/,
  /해고\s*예고/,
  /노동\s*위원회/,
  /지방\s*노동\s*위원회/,
  /구제\s*신청/,
  /원직\s*복직/,
  /금전\s*보상/,
];

const separateSystemDraftBlockPatterns = [
  /남녀\s*고용\s*평등/,
  /육아/,
  /가족\s*돌봄/,
  /난임/,
  /배우자\s*출산/,
  /성희롱/,
  /임신/,
  /산전/,
  /산후/,
  /외국인\s*근로자/,
  /사업장\s*변경/,
  /산업\s*안전/,
  /안전\s*보건/,
  /산재/,
  /산업재해/,
  /중대\s*재해/,
  /중대재해/,
  /중대\s*산업\s*재해/,
  /중대산업재해/,
];

const unsupportedClusterPatterns: Array<{
  label: string;
  title: string;
  description: string;
  patterns: RegExp[];
}> = [
  {
    label: '고용평등·성희롱·돌봄',
    title: '고용평등·돌봄 문서 초안은 아직 지원하지 않습니다.',
    description:
      '이 주제는 현재 상담 답변과 근거 확인까지 제공합니다. 별도 신청서나 진정서 초안은 아직 지원하지 않습니다.',
    patterns: [
      /남녀\s*고용\s*평등/,
      /육아/,
      /가족\s*돌봄/,
      /난임/,
      /배우자\s*출산/,
      /성희롱/,
      /모집과\s*채용/,
      /동일\s*가치/,
    ],
  },
  {
    label: '징계·인사처분',
    title: '징계·인사처분 문서 초안은 아직 지원하지 않습니다.',
    description:
      '전보, 감봉, 징계 등 인사처분 질문은 현재 상담 답변과 근거 확인까지 제공합니다. 해고 사건으로 단정해 이유서 초안을 만들지는 않습니다.',
    patterns: [/징계/, /감봉/, /전보\s*(명령|처분|발령)/, /다른\s*부서/, /인사\s*처분/],
  },
  {
    label: '중대재해',
    title: '중대재해 문서 초안은 아직 지원하지 않습니다.',
    description:
      '중대재해처벌법 계열 질문은 책임 범위와 안전보건체계 검토가 필요하므로 현재 상담 답변과 근거 확인까지만 제공합니다.',
    patterns: [/중대\s*재해/, /중대재해/, /중대\s*산업\s*재해/, /중대산업재해/, /경영\s*책임자/],
  },
  {
    label: '산업안전·산재',
    title: '안전보건·산재 문서 초안은 아직 지원하지 않습니다.',
    description:
      '산업안전보건법과 산재보험법 계열 질문은 현재 상담 답변과 근거 확인까지 제공합니다. 재해 신청서나 통지서 초안은 아직 지원하지 않습니다.',
    patterns: [
      /산업\s*안전/,
      /산업안전/,
      /안전\s*보건/,
      /안전보건/,
      /산재/,
      /산업재해보상보험법/,
      /요양\s*급여/,
      /휴업\s*급여/,
      /유족\s*급여/,
      /유족\s*보상/,
      /장례비/,
      /작업\s*중지/,
    ],
  },
  {
    label: '외국인근로자 고용관리',
    title: '외국인근로자 문서 초안은 고정 사업장 변경 데모에서만 제공합니다.',
    description:
      '외국인근로자 관련 질문은 현재 상담 답변과 근거 확인까지 제공합니다. 사업장 변경 사유 정리서는 고정 예시 경로에서만 제공합니다.',
    patterns: [/외국인\s*근로자/, /사업장\s*변경/, /고용\s*허가/, /기숙사/, /차별\s*대우/],
  },
  {
    label: '최저임금',
    title: '최저임금 문서 초안은 아직 지원하지 않습니다.',
    description:
      '최저임금 일반 설명형 질문은 현재 상담 답변과 근거 확인까지 제공합니다.',
    patterns: [/최저\s*임금/, /최저임금법/],
  },
  {
    label: '근로조건 일반',
    title: '현재 답변은 문서 초안 작성 대상이 아닙니다.',
    description:
      '근로계약, 임금명세, 근로시간, 휴게, 연차 등 일반 설명형 질문은 현재 상담 답변과 근거 확인까지 제공합니다.',
    patterns: [/근로\s*조건/, /임금\s*명세/, /근로\s*시간/, /휴게/, /연차/, /최저\s*임금/],
  },
];

export function classifyDocumentDraftSupport(
  response: AnswerResponse,
): DocumentDraftClassification {
  const hasWageMatch = hasBackendWageComplaintSupport(response);
  const hasDismissalMatch = hasBackendUnfairDismissalSupport(response);
  const availableDocumentTypes = [
    ...(hasWageMatch ? [mustGetDocumentCatalogItem('labor_office_wage_complaint')] : []),
    ...(hasDismissalMatch
      ? [mustGetDocumentCatalogItem('labor_commission_unfair_dismissal_brief')]
      : []),
  ];

  return {
    isEligible: availableDocumentTypes.length > 0,
    availableDocumentTypes,
    documentTypes: {
      labor_office_wage_complaint: hasWageMatch,
      labor_commission_unfair_dismissal_brief: hasDismissalMatch,
      workplace_change_reason_summary: false,
    },
    answerOnlyGuidance: buildAnswerOnlyGuidance(response, {
      hasWageMatch,
      hasDismissalMatch,
    }),
  };
}

export function getDocumentCatalogItem(
  documentType: DocumentType,
): SupportedDraftDocumentOption | null {
  return documentItemByType.get(documentType) ?? null;
}

export function getDocumentTypeLabel(documentType: DocumentType): string {
  return getDocumentCatalogItem(documentType)?.label ?? '문서 초안';
}

export function getDocumentTypeShortLabel(documentType: DocumentType): string {
  return getDocumentCatalogItem(documentType)?.shortLabel ?? getDocumentTypeLabel(documentType);
}

export function getScn001FrozenDraftCatalogItem(): SupportedDraftDocumentOption {
  return mustGetDocumentCatalogItem('workplace_change_reason_summary');
}

function hasBackendWageComplaintSupport(response: AnswerResponse): boolean {
  const citedArticleText = response.cited_articles.join('\n');
  const queryText = response.query;
  const answerSignalText = [
    response.answer,
    ...response.key_points,
    ...response.cautions,
  ].join('\n');
  const combinedSignalText = `${queryText}\n${answerSignalText}`;
  const hasGeneralWageCitation = matchesAny(citedArticleText, wageCitationPatterns);
  const hasRetirementWageCitation = matchesAny(
    citedArticleText,
    retirementWageCitationPatterns,
  );
  const hasGeneralWageSignal =
    matchesAny(combinedSignalText, wageDisputePatterns) ||
    (matchesAny(citedArticleText, [/근로기준법\s*제\s*43\s*조/]) &&
      matchesAny(combinedSignalText, wagePaymentPrinciplePatterns)) ||
    (matchesAny(citedArticleText, [/근로기준법\s*제\s*56\s*조/]) &&
      matchesAny(combinedSignalText, wagePremiumPatterns)) ||
    (matchesAny(citedArticleText, [/최저\s*임금법\s*제\s*6\s*조/]) &&
      matchesAny(combinedSignalText, minimumWageDifferencePatterns));
  const hasRetirementWageSignal =
    hasRetirementWageCitation &&
    matchesAny(combinedSignalText, retirementPaymentPatterns);

  return (
    (hasGeneralWageCitation && hasGeneralWageSignal) ||
    hasRetirementWageSignal
  );
}

function hasBackendUnfairDismissalSupport(response: AnswerResponse): boolean {
  const citedArticleText = response.cited_articles.join('\n');
  const queryText = response.query;
  const clusterBlockText = `${queryText}\n${citedArticleText}`;

  return (
    !matchesAny(clusterBlockText, separateSystemDraftBlockPatterns) &&
    matchesAny(queryText, dismissalQuestionPatterns) &&
    matchesAny(citedArticleText, dismissalCitationPatterns)
  );
}

function buildAnswerOnlyGuidance(
  response: AnswerResponse,
  matches: { hasWageMatch: boolean; hasDismissalMatch: boolean },
): AnswerOnlyDocumentGuidance {
  if (matches.hasWageMatch || matches.hasDismissalMatch) {
    return {
      title: '작성 가능한 문서가 있습니다.',
      description: '상담 결과에서 문서 초안에 필요한 근거와 사건 신호가 확인되었습니다.',
      detectedClusterLabel: '지원 문서',
      supportMode: 'backend',
    };
  }

  const citedArticleText = response.cited_articles.join('\n');
  const combinedText = buildCombinedSignalText(response);
  const unsupportedCluster = unsupportedClusterPatterns.find((cluster) =>
    matchesAny(`${combinedText}\n${citedArticleText}`, cluster.patterns),
  );

  if (unsupportedCluster) {
    return {
      title: unsupportedCluster.title,
      description: unsupportedCluster.description,
      detectedClusterLabel: unsupportedCluster.label,
      supportMode: 'unsupported',
    };
  }

  if (matchesAny(combinedText, dismissalQuestionPatterns)) {
    return {
      title: '해고 관련 답변은 확인할 수 있지만 초안 작성 요건이 부족합니다.',
      description:
        '해고나 해고 절차와 직접 연결되는 근거가 충분히 확인될 때만 부당해고 이유서 초안으로 이어갑니다.',
      detectedClusterLabel: '해고·구제신청',
      supportMode: 'unsupported',
    };
  }

  if (matchesAny(combinedText, wageTopicPatterns)) {
    return {
      title: '임금 관련 답변은 확인할 수 있지만 초안 작성 요건이 부족합니다.',
      description:
        '임금 미지급, 수당, 최저임금 차액, 퇴직 후 금품정산처럼 진정서로 정리할 수 있는 쟁점과 근거가 함께 확인될 때만 초안으로 이어갑니다.',
      detectedClusterLabel: '임금·퇴직금',
      supportMode: 'unsupported',
    };
  }

  return {
    title: '현재 답변은 문서 초안 작성 대상이 아닙니다.',
    description:
      '이 주제는 현재 상담 답변과 근거 확인까지 제공합니다. 문서 초안은 지원 범위가 확인되는 경우에만 열립니다.',
    detectedClusterLabel: 'answer-only',
    supportMode: 'unsupported',
  };
}

function buildCombinedSignalText(response: AnswerResponse): string {
  return [
    response.query,
    response.answer,
    ...response.key_points,
    ...response.cautions,
    ...response.cited_articles,
    ...getRelevantChunks(response).map(buildChunkRuleText),
  ].join('\n');
}

function getRelevantChunks(response: AnswerResponse): GroundedChunkResult[] {
  if (response.grounded_context_ids.length === 0) {
    return response.retrieved_chunks;
  }

  const groundedIds = new Set(response.grounded_context_ids);
  const groundedChunks = response.retrieved_chunks.filter((chunk) =>
    groundedIds.has(chunk.context_id),
  );

  return groundedChunks.length > 0 ? groundedChunks : response.retrieved_chunks;
}

function buildChunkRuleText(chunk: GroundedChunkResult): string {
  return [
    chunk.citation_label,
    chunk.law_name,
    chunk.article_no,
    chunk.article_title,
    chunk.structure_path ?? '',
    chunk.content,
  ].join('\n');
}

function mustGetDocumentCatalogItem(
  documentType: DocumentType,
): SupportedDraftDocumentOption {
  const item = getDocumentCatalogItem(documentType);

  if (!item) {
    throw new Error(`Unsupported document type: ${documentType}`);
  }

  return item;
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}
