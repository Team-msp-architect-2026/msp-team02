import type {
  BeforeReviewJobHistoryItem,
  BridgeRunHistoryItem,
} from '@/types/scn001-history';
import type { BridgeHandoffItem } from '@/types/bridge-handoff';

import {
  buildBridgeIssueDisplayItems,
  formatBridgeSafeInlineText,
  getBridgeHandoffDisplayFields,
  type BridgeHandoffDisplayFields,
  type BridgeIssueDisplay,
} from '@/lib/bridge-handoff';

export interface VisibleScn001History {
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
}

export type Scn001BridgeHistoryDisplayFields = BridgeHandoffDisplayFields & {
  connectionSummary: string;
};

export type Scn001CaseHistoryRecord =
  | {
      kind: 'before-case';
      caseId: string;
      beforeJob: BeforeReviewJobHistoryItem;
      bridgeRuns: BridgeRunHistoryItem[];
      caseSummary: string;
      compactSummary: string;
      caseIssueDetails: BridgeIssueDisplay[];
      sourceBeforeMissing: false;
      hasKnownBridge: boolean;
      createdAt: string;
      updatedAt: string;
    }
  | {
      kind: 'bridge-only-case';
      caseId: string;
      beforeJob: null;
      bridgeRuns: [BridgeRunHistoryItem];
      caseSummary: string;
      compactSummary: string;
      caseIssueDetails: BridgeIssueDisplay[];
      sourceBeforeMissing: true;
      hasKnownBridge: true;
      createdAt: string;
      updatedAt: string;
    };

export function filterVisibleScn001History(input: {
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
}): VisibleScn001History {
  const beforeStatusById = new Map(
    input.beforeJobs.map((job) => [job.before_review_job_id, job.status]),
  );

  return {
    beforeJobs: input.beforeJobs.filter(isBeforeReviewJobUserVisible),
    bridgeRuns: input.bridgeRuns.filter((bridgeRun) =>
      isBridgeRunUserVisible(bridgeRun, beforeStatusById),
    ),
  };
}

export function isBeforeReviewJobUserVisible(
  job: BeforeReviewJobHistoryItem,
): boolean {
  return job.status === 'completed';
}

export function buildScn001CaseHistoryRecords(input: {
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
}): Scn001CaseHistoryRecord[] {
  const bridgeRunsByBeforeId = new Map<string, BridgeRunHistoryItem[]>();

  input.bridgeRuns.forEach((bridgeRun) => {
    if (!bridgeRun.before_review_job_id) {
      return;
    }

    const currentRuns = bridgeRunsByBeforeId.get(bridgeRun.before_review_job_id) ?? [];
    currentRuns.push(bridgeRun);
    bridgeRunsByBeforeId.set(bridgeRun.before_review_job_id, currentRuns);
  });

  const visibleBeforeIds = new Set(
    input.beforeJobs.map((job) => job.before_review_job_id),
  );
  const beforeRecords: Scn001CaseHistoryRecord[] = input.beforeJobs.map((beforeJob) => {
    const linkedBridgeRuns = bridgeRunsByBeforeId.get(beforeJob.before_review_job_id) ?? [];
    const caseIssueDetails = collectBridgeIssueDetails(linkedBridgeRuns);

    return {
      kind: 'before-case',
      caseId: beforeJob.before_review_job_id,
      beforeJob,
      bridgeRuns: linkedBridgeRuns,
      caseSummary: buildBeforeCaseSituationSummary({
        beforeJob,
        issueDetails: caseIssueDetails,
      }),
      compactSummary: buildBeforeCaseCompactSummary({
        beforeJob,
        issueDetails: caseIssueDetails,
      }),
      caseIssueDetails,
      sourceBeforeMissing: false,
      hasKnownBridge: linkedBridgeRuns.length > 0 || beforeJob.has_bridge_run,
      createdAt: beforeJob.created_at,
      updatedAt: beforeJob.updated_at,
    };
  });
  const bridgeOnlyRecords: Scn001CaseHistoryRecord[] = input.bridgeRuns.flatMap((bridgeRun) => {
    if (
      bridgeRun.before_review_job_id &&
      visibleBeforeIds.has(bridgeRun.before_review_job_id)
    ) {
      return [];
    }

    const caseIssueDetails = collectBridgeIssueDetails([bridgeRun]);

    return [
      {
        kind: 'bridge-only-case',
        caseId: bridgeRun.bridge_run_id,
        beforeJob: null,
        bridgeRuns: [bridgeRun],
        caseSummary: buildBridgeOnlyCaseSituationSummary({
          bridgeRun,
          issueDetails: caseIssueDetails,
        }),
        compactSummary: buildBridgeOnlyCaseCompactSummary({
          bridgeRun,
          issueDetails: caseIssueDetails,
        }),
        caseIssueDetails,
        sourceBeforeMissing: true,
        hasKnownBridge: true,
        createdAt: bridgeRun.created_at,
        updatedAt: bridgeRun.updated_at,
      },
    ];
  });

  return [...beforeRecords, ...bridgeOnlyRecords];
}

export function getBridgeRunHistoryDisplayFields(
  bridgeRun: BridgeRunHistoryItem,
): Scn001BridgeHistoryDisplayFields {
  const displayFields = getBridgeHandoffDisplayFields(
    bridgeHistoryItemToHandoffItem(bridgeRun),
  );

  return {
    ...displayFields,
    connectionSummary: buildBridgeConnectionSummary(bridgeRun, displayFields.issueDetails),
  };
}

export function bridgeHistoryItemToHandoffItem(
  bridgeRun: BridgeRunHistoryItem,
): BridgeHandoffItem {
  return {
    bridge_run_id: bridgeRun.bridge_run_id,
    scenario_id: 'SCN-001',
    user_visible_summary:
      formatBridgeSafeInlineText(bridgeRun.user_visible_summary) ??
      '상황 설명이 제공되지 않았습니다.',
    issue_categories: normalizeVisibleValues(bridgeRun.issue_categories),
    risk_tags: normalizeVisibleValues(bridgeRun.risk_tags),
    law_refs: normalizeVisibleValues(bridgeRun.law_refs),
    recommended_next_actions: normalizeVisibleValues(
      bridgeRun.recommended_next_actions,
    ),
    after_query_seed: null,
    include_in_query: true,
  };
}

function buildBeforeCaseSituationSummary(input: {
  beforeJob: BeforeReviewJobHistoryItem;
  issueDetails: BridgeIssueDisplay[];
}): string {
  const safeSummary = formatBridgeSafeInlineText(input.beforeJob.summary);
  const issueSentence = buildSituationIssueSentence(input.issueDetails);
  const reviewSentence = buildReviewStatusSentence(input.beforeJob);

  if (safeSummary && issueSentence) {
    return `${safeSummary} ${issueSentence}`;
  }

  if (safeSummary && reviewSentence) {
    return `${safeSummary} ${reviewSentence}`;
  }

  if (safeSummary) {
    return safeSummary;
  }

  if (issueSentence) {
    return issueSentence;
  }

  return reviewSentence ?? '계약서와 실제 근무조건에 관한 추가 확인이 필요한 사건 기록입니다.';
}

function buildBeforeCaseCompactSummary(input: {
  beforeJob: BeforeReviewJobHistoryItem;
  issueDetails: BridgeIssueDisplay[];
}): string {
  const issueSummary = buildCompactIssueSummary(input.issueDetails);

  if (issueSummary) {
    return issueSummary;
  }

  if (input.beforeJob.overall_result === 'PASS') {
    return '이전 검토는 큰 위반 가능성이 낮지만 실제 조건 일치 여부를 확인할 수 있습니다.';
  }

  if (
    input.beforeJob.overall_result === 'WARNING' ||
    input.beforeJob.overall_result === 'VIOLATION' ||
    (input.beforeJob.overall_severity && input.beforeJob.overall_severity !== 'NONE')
  ) {
    return '계약서 내용과 실제 근무조건에 추가 확인이 필요한 기록입니다.';
  }

  const safeSummary = formatBridgeSafeInlineText(input.beforeJob.summary);

  return (
    shortenInlineText(safeSummary, 72) ??
    '계약서와 실제 근무조건을 이어서 확인해야 하는 사건입니다.'
  );
}

function buildBridgeOnlyCaseSituationSummary(input: {
  bridgeRun: BridgeRunHistoryItem;
  issueDetails: BridgeIssueDisplay[];
}): string {
  const safeSummary = formatBridgeSafeInlineText(input.bridgeRun.user_visible_summary);
  const issueSentence = buildSituationIssueSentence(input.issueDetails);

  if (safeSummary && issueSentence) {
    return `${safeSummary} ${issueSentence}`;
  }

  return (
    safeSummary ??
    issueSentence ??
    '원 Before 요약은 현재 목록에서 불러오지 못했습니다. 추가 확인이 필요한 연결 기록입니다.'
  );
}

function buildBridgeOnlyCaseCompactSummary(input: {
  bridgeRun: BridgeRunHistoryItem;
  issueDetails: BridgeIssueDisplay[];
}): string {
  const issueSummary = buildCompactIssueSummary(input.issueDetails);

  if (issueSummary) {
    return issueSummary;
  }

  const safeSummary = formatBridgeSafeInlineText(input.bridgeRun.user_visible_summary);

  return (
    shortenInlineText(safeSummary, 72) ??
    '이전 검토에서 이어진 연결 후보를 After 질문과 대조할 수 있습니다.'
  );
}

function buildCompactIssueSummary(issueDetails: BridgeIssueDisplay[]): string | null {
  if (issueDetails.length === 0) {
    return null;
  }

  const labels = issueDetails.map((issue) => issue.label);
  const issueAxes = getIssueAxes(issueDetails);
  const conditionAxisText = buildConditionAxisText(issueAxes);

  if (issueAxes.hasMandatoryTerms && conditionAxisText) {
    return `계약서 필수 항목 및 ${conditionAxisText} 확인이 필요합니다.`;
  }

  if (issueAxes.hasMandatoryTerms) {
    return '계약서 필수 근로조건 누락 가능성을 확인해야 합니다.';
  }

  if (conditionAxisText) {
    return `${conditionAxisText}을 계약 내용과 실제 조건 기준으로 확인할 필요가 있습니다.`;
  }

  if (issueAxes.hasWorkEnvironment) {
    return '근무환경 쟁점과 실제 조건 차이를 이어서 확인해야 합니다.';
  }

  return `${formatKoreanList(labels.slice(0, 2))}을(를) 이어서 확인해야 합니다.`;
}

function buildSituationIssueSentence(issueDetails: BridgeIssueDisplay[]): string | null {
  if (issueDetails.length === 0) {
    return null;
  }

  const labels = issueDetails.map((issue) => issue.label);
  const labelText = formatKoreanList(labels);
  const issueAxes = getIssueAxes(issueDetails);
  const conditionAxisText = buildConditionAxisText(issueAxes);

  if (issueAxes.hasMandatoryTerms && conditionAxisText) {
    return `계약서 필수 항목과 ${conditionAxisText}을 함께 확인할 필요가 있습니다. 계약 내용과 실제 근무조건의 차이가 있는지는 [확인 필요]로 남겨야 합니다.`;
  }

  if (issueAxes.hasMandatoryTerms) {
    return '계약서 필수 근로조건 항목이 충분한지 확인이 필요합니다.';
  }

  if (conditionAxisText) {
    return `이전 검토에서 ${conditionAxisText}을 추가 확인할 필요가 있는 기록입니다. 계약 내용과 실제 근무조건의 차이가 있는지는 [확인 필요]로 남겨야 합니다.`;
  }

  if (issueAxes.hasWorkEnvironment) {
    return `이전 검토에서 ${labelText}을(를) 추가 확인할 필요가 있는 기록입니다. 계약 내용과 실제 근무조건의 차이가 있는지는 [확인 필요]로 남겨야 합니다.`;
  }

  return `이전 검토에서 ${labelText}을(를) 추가 확인할 필요가 있는 기록입니다. 구체 자료가 부족한 부분은 추가 확인이 필요합니다.`;
}

type IssueAxes = {
  hasMandatoryTerms: boolean;
  hasDormitory: boolean;
  hasWageIssue: boolean;
  hasDeductionIssue: boolean;
  hasWorkEnvironment: boolean;
};

function getIssueAxes(issueDetails: BridgeIssueDisplay[]): IssueAxes {
  const labels = issueDetails.map((issue) => issue.label);

  return {
    hasMandatoryTerms: labels.some((label) => label.includes('필수 근로조건')),
    hasDormitory: labels.some((label) => label.includes('기숙사') || label.includes('숙소')),
    hasWageIssue: labels.some(hasWageIssueLabel),
    hasDeductionIssue: labels.some(hasDeductionIssueLabel),
    hasWorkEnvironment: labels.some(
      (label) => label.includes('차별') || label.includes('폭언') || label.includes('근무환경'),
    ),
  };
}

function hasWageIssueLabel(label: string): boolean {
  if (hasDeductionIssueLabel(label)) {
    return false;
  }

  const normalizedLabel = label.toLowerCase();
  return (
    label.includes('임금') ||
    label.includes('급여') ||
    normalizedLabel.includes('wage') ||
    normalizedLabel.includes('salary')
  );
}

function hasDeductionIssueLabel(label: string): boolean {
  const normalizedLabel = label.toLowerCase();
  return label.includes('공제') || normalizedLabel.includes('deduction');
}

function buildConditionAxisText(issueAxes: IssueAxes): string | null {
  const { hasDormitory, hasWageIssue, hasDeductionIssue } = issueAxes;

  if (hasDormitory && hasWageIssue && hasDeductionIssue) {
    return '숙소·임금·공제 조건';
  }

  if (hasDormitory && hasWageIssue) {
    return '숙소 조건과 임금 조건';
  }

  if (hasDormitory && hasDeductionIssue) {
    return '숙소 조건과 공제 조건';
  }

  if (hasWageIssue && hasDeductionIssue) {
    return '임금·공제 조건';
  }

  if (hasDormitory) {
    return '숙소 조건';
  }

  if (hasWageIssue) {
    return '임금 조건';
  }

  if (hasDeductionIssue) {
    return '공제 조건';
  }

  return null;
}

function buildReviewStatusSentence(job: BeforeReviewJobHistoryItem): string | null {
  if (job.overall_result === 'PASS') {
    return '이전 검토에서 큰 위반 가능성은 낮게 보였지만, 실제 근무조건과 계약 내용이 일치하는지는 필요시 추가 확인할 수 있습니다.';
  }

  if (job.overall_result === 'WARNING' || job.overall_result === 'VIOLATION') {
    return '이전 검토에서 계약서 내용 또는 실제 근무조건에 추가 확인이 필요한 기록입니다.';
  }

  if (job.overall_severity && job.overall_severity !== 'NONE') {
    return '이전 검토에서 확인이 필요한 항목이 있어 계약서와 실제 근무조건을 함께 살펴봐야 하는 기록입니다.';
  }

  return null;
}

function buildBridgeConnectionSummary(
  bridgeRun: BridgeRunHistoryItem,
  issueDetails: BridgeIssueDisplay[],
): string {
  const issueLabelText = formatKoreanList(issueDetails.map((issue) => issue.label));
  const hasIssueLabels = issueDetails.length > 0;
  const hasLawRefs = normalizeVisibleValues(bridgeRun.law_refs).length > 0;

  if (hasIssueLabels) {
    return `이 기록은 ${issueLabelText}을(를) After 질문에서 사업장 변경 사유나 후속 상담 쟁점으로 이어서 검토할 수 있는 참고 맥락입니다. Bridge 정보는 답변의 법적 근거가 아니라 이전 검토에서 이어지는 쟁점을 놓치지 않기 위한 참고 정보입니다.`;
  }

  if (hasLawRefs) {
    return '이 기록은 이전 검토에서 표시된 법 조항 후보를 After 질문과 대조해 볼 수 있는 참고 맥락입니다. Bridge 정보는 답변의 법적 근거가 아니라 이어지는 쟁점을 놓치지 않기 위한 참고 정보입니다.';
  }

  return '이 기록은 이전 Before 검토와 After 질문 사이에서 이어질 수 있는 쟁점을 확인하기 위한 참고 맥락입니다. Bridge 정보는 답변의 법적 근거가 아니라 이전 검토를 놓치지 않기 위한 참고 정보입니다.';
}

function collectBridgeIssueDetails(bridgeRuns: BridgeRunHistoryItem[]): BridgeIssueDisplay[] {
  const seenLabels = new Set<string>();
  const issueDetails: BridgeIssueDisplay[] = [];

  bridgeRuns.forEach((bridgeRun) => {
    const issueCategoryDetails = buildBridgeIssueDisplayItems(
      normalizeVisibleValues(bridgeRun.issue_categories),
    );
    const riskTagDetails = buildBridgeIssueDisplayItems(
      normalizeVisibleValues(bridgeRun.risk_tags),
    );
    const displayDetails =
      issueCategoryDetails.length > 0 ? issueCategoryDetails : riskTagDetails;

    displayDetails.forEach((issue) => {
      if (seenLabels.has(issue.label) || issueDetails.length >= 4) {
        return;
      }

      seenLabels.add(issue.label);
      issueDetails.push(issue);
    });
  });

  return issueDetails;
}

function formatKoreanList(values: string[]): string {
  const cleanedValues = values.flatMap((value) => {
    const text = optionalInlineText(value);
    return text ? [text] : [];
  });

  if (cleanedValues.length === 0) {
    return '추가 확인 필요 항목';
  }

  if (cleanedValues.length === 1) {
    return cleanedValues[0] ?? '추가 확인 필요 항목';
  }

  const lastValue = cleanedValues[cleanedValues.length - 1] ?? '추가 확인 필요 항목';
  return `${cleanedValues.slice(0, -1).join(', ')} 및 ${lastValue}`;
}

function isBridgeRunUserVisible(
  bridgeRun: BridgeRunHistoryItem,
  beforeStatusById: Map<string, string>,
): boolean {
  if (!bridgeRun.before_review_job_id) {
    return true;
  }

  const sourceBeforeStatus = beforeStatusById.get(bridgeRun.before_review_job_id);
  if (sourceBeforeStatus === undefined) {
    return true;
  }

  return sourceBeforeStatus === 'completed';
}

function normalizeVisibleValues(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const text = optionalInlineText(value);
    return text ? [text] : [];
  });
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function optionalInlineText(value: string | null | undefined): string | undefined {
  return optionalText(value)?.replace(/\s+/g, ' ');
}

function shortenInlineText(
  value: string | null | undefined,
  maxLength: number,
): string | undefined {
  const inlineText = optionalInlineText(value);

  if (!inlineText || inlineText.length <= maxLength) {
    return inlineText;
  }

  return `${inlineText.slice(0, maxLength - 3).trimEnd()}...`;
}
