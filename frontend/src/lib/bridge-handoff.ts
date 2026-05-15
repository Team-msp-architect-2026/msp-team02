import type {
  BridgeHandoffItem,
  BridgeHandoffState,
} from '@/types/bridge-handoff';

const MAX_ITEM_CONTEXT_CHARS = 900;
const MAX_TOTAL_BRIDGE_CONTEXT_CHARS = 2500;
const MAX_FINAL_QUERY_CHARS = 3500;
const MAX_VISIBLE_ISSUE_LABELS = 4;
const MAX_VISIBLE_LAW_REFS = 5;
const MAX_VISIBLE_RECOMMENDED_ACTIONS = 3;

export interface BridgeIssueDisplay {
  label: string;
  description: string;
}

export interface BridgeHandoffDisplayFields {
  userVisibleSummary: string;
  issueLabels: string[];
  issueDetails: BridgeIssueDisplay[];
  lawRefs: string[];
  recommendedNextActions: string[];
}

export function buildBridgeContextQuery(
  bridgeHandoffItems: BridgeHandoffItem[],
  userAdditionalQuestion: string,
): string {
  const question = optionalText(userAdditionalQuestion) ?? '';
  const includedItems = bridgeHandoffItems.filter((item) => item.include_in_query);

  if (includedItems.length === 0) {
    return question;
  }

  const bridgeContext = joinClippedSections(
    includedItems
      .map((item, index) => buildBridgeItemContext(item, index + 1))
      .filter((section) => section.length > 0),
    '\n\n',
    MAX_TOTAL_BRIDGE_CONTEXT_CHARS,
  );
  const sections = [
    bridgeContext,
    question.length > 0 ? `[사용자 추가 질문]\n${question}` : '',
  ].filter((section) => section.length > 0);

  return clipText(sections.join('\n\n'), MAX_FINAL_QUERY_CHARS);
}

export function hasIncludedBridgeContext(state: BridgeHandoffState): boolean {
  return state.items.some((item) => item.include_in_query);
}

export function getBridgeHandoffDisplayFields(
  item: BridgeHandoffItem,
): BridgeHandoffDisplayFields {
  const issueCategoryDetails = buildBridgeIssueDisplayItems(item.issue_categories);
  const riskTagDetails = buildBridgeIssueDisplayItems(item.risk_tags);
  const issueDetails =
    issueCategoryDetails.length > 0 ? issueCategoryDetails : riskTagDetails;

  return {
    userVisibleSummary: formatBridgeSafeText(item.user_visible_summary) ?? '',
    issueLabels: issueDetails.map((issue) => issue.label),
    issueDetails,
    lawRefs: normalizeVisibleList(item.law_refs, MAX_VISIBLE_LAW_REFS),
    recommendedNextActions: normalizeVisibleList(
      item.recommended_next_actions,
      MAX_VISIBLE_RECOMMENDED_ACTIONS,
    ),
  };
}

export function buildBridgeIssueDisplayItems(
  values: string[],
  maxItems = MAX_VISIBLE_ISSUE_LABELS,
): BridgeIssueDisplay[] {
  const seenLabels = new Set<string>();

  return normalizeVisibleList(values, maxItems).flatMap((value) => {
    const issue = getBridgeIssueDisplay(value);

    if (seenLabels.has(issue.label)) {
      return [];
    }

    seenLabels.add(issue.label);
    return [issue];
  });
}

export function formatBridgeSafeText(value: string | null | undefined): string | undefined {
  const text = optionalText(value);
  return text ? replaceRawDisplayTokens(text) : undefined;
}

export function formatBridgeSafeInlineText(
  value: string | null | undefined,
): string | undefined {
  return formatBridgeSafeText(value)?.replace(/\s+/g, ' ');
}

function buildBridgeItemContext(item: BridgeHandoffItem, position: number): string {
  const displayFields = getBridgeHandoffDisplayFields(item);

  return joinClippedSections(
    [
      formatTextSection(`[Before 검토 요약 ${position}]`, displayFields.userVisibleSummary),
      formatListSection('[주요 쟁점]', displayFields.issueLabels),
      formatListSection('[관련 법령 후보]', displayFields.lawRefs),
      formatListSection('[권장 다음 행동]', displayFields.recommendedNextActions),
    ].filter((section) => section.length > 0),
    '\n\n',
    MAX_ITEM_CONTEXT_CHARS,
  );
}

function formatTextSection(title: string, value: string): string {
  const text = optionalText(value);
  return text ? `${title}\n${text}` : '';
}

function formatListSection(title: string, values: string[]): string {
  const items = values.map((value) => `- ${value}`);

  return items.length > 0 ? `${title}\n${items.join('\n')}` : '';
}

function normalizeVisibleList(values: string[], maxItems: number): string[] {
  return values
    .flatMap((value) => {
      const text = optionalInlineText(value);
      return text ? [text] : [];
    })
    .slice(0, maxItems);
}

const ISSUE_DISPLAY_BY_KEY: Record<string, BridgeIssueDisplay> = {
  mandatory_terms_missing: {
    label: '필수 근로조건 누락 가능성',
    description:
      '계약서에 임금, 근로시간, 휴일, 근무장소 등 필수 항목이 충분히 적혀 있는지 확인이 필요합니다.',
  },
  mandatory_missing: {
    label: '필수 근로조건 확인 필요',
    description:
      '계약서에 반드시 적어야 하는 근로조건 항목이 빠졌거나 불충분한지 확인이 필요합니다.',
  },
  dormitory_or_housing_issue: {
    label: '기숙사·숙소 조건 확인 필요',
    description:
      '숙소 제공 조건, 비용 부담, 생활환경이 계약 내용과 실제 운영에서 일치하는지 확인이 필요합니다.',
  },
  dormitory_missing_info: {
    label: '기숙사·숙소 조건 확인 필요',
    description:
      '숙소 제공 조건, 비용 부담, 생활환경이 계약 내용과 실제 운영에서 일치하는지 확인이 필요합니다.',
  },
  dormitory: {
    label: '기숙사·숙소 조건 확인 필요',
    description:
      '숙소 제공 조건과 비용 공제 방식이 계약서와 실제 운영에서 어떻게 정해졌는지 확인이 필요합니다.',
  },
  housing_issue: {
    label: '기숙사·숙소 조건 확인 필요',
    description:
      '숙소 제공 조건, 비용 부담, 생활환경이 계약 내용과 실제 운영에서 일치하는지 확인이 필요합니다.',
  },
  wage_or_deduction_issue: {
    label: '임금·공제 내역 확인 필요',
    description:
      '급여에서 공제된 금액과 공제 사유가 계약서와 법령 기준에 맞는지 확인이 필요합니다.',
  },
  deduction_risk: {
    label: '임금·공제 내역 확인 필요',
    description:
      '급여에서 공제된 금액과 공제 사유가 계약서와 법령 기준에 맞는지 확인이 필요합니다.',
  },
  wage: {
    label: '임금 조건 확인 필요',
    description:
      '임금 금액, 지급일, 지급 방식이 계약서와 실제 지급 내역에서 일치하는지 확인이 필요합니다.',
  },
  minimum_wage: {
    label: '최저임금 기준 확인 필요',
    description:
      '약정 임금과 실제 근로시간을 기준으로 최저임금 기준을 충족하는지 확인이 필요합니다.',
  },
  discrimination_or_abuse_issue: {
    label: '차별·폭언 등 근무환경 쟁점',
    description:
      '근무 중 차별, 폭언, 부당한 대우가 있었는지 구체적 사실과 증거 확인이 필요합니다.',
  },
  discrimination: {
    label: '차별 등 근무환경 쟁점',
    description:
      '근무 중 차별이나 부당한 대우가 있었는지 구체적 사실과 증거 확인이 필요합니다.',
  },
  abuse: {
    label: '폭언 등 근무환경 쟁점',
    description:
      '근무 중 폭언, 위협, 부당한 대우가 있었는지 구체적 사실과 증거 확인이 필요합니다.',
  },
  standard_form_misuse: {
    label: '표준근로계약서 사용 여부 확인 필요',
    description:
      '외국인 근로자에게 필요한 표준근로계약서가 사용되었는지, 자체 양식으로 핵심 조건이 빠지지 않았는지 확인이 필요합니다.',
  },
  custom_form: {
    label: '계약서 양식 확인 필요',
    description:
      '자체 양식 계약서가 사용된 경우 외국인 근로자에게 필요한 항목이 충분히 포함됐는지 확인이 필요합니다.',
  },
  passport_custody: {
    label: '여권·외국인등록증 보관 위험',
    description:
      '회사나 관리자가 여권 또는 외국인등록증을 보관했는지, 근로자의 자유로운 보관·반환이 보장됐는지 확인이 필요합니다.',
  },
  mobility_restriction: {
    label: '이직 제한·손해배상 조항 확인 필요',
    description:
      '사업장 변경이나 이직을 제한하거나 손해배상을 예정한 조항이 있는지 확인이 필요합니다.',
  },
  liquidated_damages: {
    label: '손해배상 예정 조항 확인 필요',
    description:
      '퇴사나 사업장 변경을 이유로 미리 정한 손해배상이나 위약금 조항이 있는지 확인이 필요합니다.',
  },
  immediate_illegal: {
    label: '즉시 검토가 필요한 권리침해 가능성',
    description:
      '계약 조항이나 실제 운영 중 즉시 법률 검토가 필요한 권리침해 가능성이 있는지 확인이 필요합니다.',
  },
  enforceability_risk: {
    label: '계약 조항 효력 확인 필요',
    description:
      '계약서 조항이 실제로 유효하게 적용될 수 있는지, 근로자에게 과도하게 불리하지 않은지 확인이 필요합니다.',
  },
  foreign_worker: {
    label: '외국인 근로자 계약 조건 확인',
    description:
      '외국인 근로자에게 적용되는 계약서 형식, 숙소, 사업장 변경 관련 조건을 함께 확인할 필요가 있습니다.',
  },
  working_hours: {
    label: '근로시간 조건 확인 필요',
    description:
      '소정근로시간, 휴게시간, 휴일 등 근로시간 관련 조건이 계약서와 실제 근무에서 일치하는지 확인이 필요합니다.',
  },
  other: {
    label: '추가 확인 필요',
    description: '이전 검토에서 분류되지 않은 쟁점이 있어 구체적인 사실 확인이 필요합니다.',
  },
};

const FALLBACK_KOREAN_WORDS: Record<string, string> = {
  abuse: '폭언·부당대우',
  contract: '계약',
  custom: '자체 양식',
  deduction: '공제',
  discrimination: '차별',
  dormitory: '기숙사',
  enforceability: '효력',
  foreign: '외국인',
  form: '양식',
  housing: '숙소',
  hours: '근로시간',
  illegal: '위법 가능성',
  immediate: '즉시 검토',
  issue: '쟁점',
  liquidated: '손해배상 예정',
  mandatory: '필수',
  minimum: '최저임금',
  missing: '누락',
  misuse: '사용 여부',
  mobility: '사업장 변경',
  passport: '여권',
  restriction: '제한',
  risk: '위험',
  standard: '표준',
  terms: '근로조건',
  wage: '임금',
  worker: '근로자',
  working: '근로',
};

const STATUS_DISPLAY_REPLACEMENTS: Record<string, string> = {
  CRITICAL: '매우 높은 수준',
  HIGH: '높은 수준',
  LOW: '낮은 수준',
  MEDIUM: '중간 수준',
  NONE: '특이사항 없음',
  PASS: '큰 문제 없음',
  VIOLATION: '위반 가능성',
  WARNING: '주의가 필요한 상태',
};

function getBridgeIssueDisplay(value: string): BridgeIssueDisplay {
  const text = optionalInlineText(value) ?? '추가 확인 필요';
  const knownIssue = ISSUE_DISPLAY_BY_KEY[normalizeIssueKey(text)];

  if (knownIssue) {
    return knownIssue;
  }

  if (/[가-힣]/.test(text)) {
    const label = replaceRawDisplayTokens(text);

    return {
      label,
      description: `${label}에 관한 구체적 사실과 자료를 추가 확인할 필요가 있습니다.`,
    };
  }

  const fallbackLabel = formatUnknownIssueLabel(text);
  return {
    label: fallbackLabel,
    description: `${fallbackLabel}에 해당하는 내용이 있는지 추가 확인이 필요합니다.`,
  };
}

function normalizeIssueKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function replaceRawDisplayTokens(value: string): string {
  const knownIssueKeys = Object.keys(ISSUE_DISPLAY_BY_KEY).sort(
    (a, b) => b.length - a.length,
  );
  let replaced = knownIssueKeys.reduce(
    (current, key) =>
      current.replace(
        new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g'),
        ISSUE_DISPLAY_BY_KEY[key].label,
      ),
    value,
  );

  replaced = Object.entries(STATUS_DISPLAY_REPLACEMENTS).reduce(
    (current, [rawValue, displayValue]) =>
      current.replace(new RegExp(`\\b${escapeRegExp(rawValue)}\\b`, 'g'), displayValue),
    replaced,
  );

  return replaced.replace(/\b[a-z][a-z0-9]+(?:_[a-z0-9]+)+\b/g, (token) =>
    formatUnknownIssueLabel(token),
  );
}

function formatUnknownIssueLabel(value: string): string {
  const words = value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const koreanWords = words.flatMap((word) => {
    const mapped = FALLBACK_KOREAN_WORDS[word];
    return mapped ? [mapped] : [];
  });

  if (koreanWords.length > 0) {
    return `${dedupeStrings(koreanWords).join('·')} 확인 필요`;
  }

  const titleCased = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return titleCased ? `${titleCased} 확인 필요` : '추가 확인 필요';
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function joinClippedSections(
  sections: string[],
  separator: string,
  maxLength: number,
): string {
  let output = '';

  for (const section of sections) {
    const nextOutput = output ? `${output}${separator}${section}` : section;

    if (nextOutput.length <= maxLength) {
      output = nextOutput;
      continue;
    }

    const remainingLength = maxLength - output.length - (output ? separator.length : 0);
    const clippedSection = clipText(section, remainingLength);

    if (clippedSection.length > 0) {
      output = output ? `${output}${separator}${clippedSection}` : clippedSection;
    }

    break;
  }

  return output.trim();
}

function clipText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function optionalInlineText(value: string | null | undefined): string | undefined {
  return optionalText(value)?.replace(/\s+/g, ' ');
}
