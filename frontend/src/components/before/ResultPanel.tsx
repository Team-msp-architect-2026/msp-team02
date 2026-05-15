'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDot } from 'lucide-react';
import Link from 'next/link';

import type {
  BeforeReviewEvidence,
  BeforeReviewResult,
  BeforeReviewStatus,
  BeforeSeverity,
} from '@/types/before';

import styles from './ResultPanel.module.css';

type EvidenceCopyScenario = 'foreignWorker' | 'partTime' | 'disabledWorker';
export type BeforeReviewIssueTone = 'danger' | 'warning' | 'success';
type EvidenceTone = BeforeReviewIssueTone | 'neutral';

export interface BeforeReviewIssueSource {
  title: string;
  status: BeforeReviewStatus;
  severity: BeforeSeverity;
  law_ref: string;
  description: string;
}

type IssueCard = BeforeReviewIssueSource;

export interface BeforeReviewDisplayIssue extends BeforeReviewIssueSource {
  tag: string | null;
  tone: BeforeReviewIssueTone;
}

interface ClausePreviewSentence {
  text: string;
  highlighted: boolean;
}

interface ClausePreviewBlock {
  title: string;
  neutralSentences: string[];
  highlightedSentence: string | null;
  sentences: ClausePreviewSentence[];
  issue: BeforeReviewDisplayIssue | null;
  status: BeforeReviewStatus | null;
  severity: BeforeSeverity | null;
  tag: string | null;
  tone: EvidenceTone;
  lawRef: string | null;
  sourceLabel: string;
  fallbackNote: string | null;
}

interface BeforeReviewFindingSummary {
  riskCount: number;
  needsReviewCount: number;
  passCount: number;
}

const MOCK_REVIEW_EVIDENCE_SCENARIOS: Record<string, EvidenceCopyScenario> = {
  '5f0d77f5-foreign-worker-demo': 'foreignWorker',
  'e4a0fb62-cbb4-4136-ac6a-8a96fb66050f': 'partTime',
  '54a00490-5cfc-4371-87d1-00985108ceb7': 'disabledWorker',
};

const SCENARIO_EVIDENCE_COPY: Record<
  EvidenceCopyScenario,
  Array<{ title: string; excerpt: string }>
> = {
  foreignWorker: [
    {
      title: '표준근로계약서와 핵심 조건 확인',
      excerpt:
        '표준근로계약서 여부와 계약 언어, 임금·근로시간·숙소 조건이 서면에 적혀 있는지 확인합니다.',
    },
    {
      title: '권리 제한으로 이어질 수 있는 조항 확인',
      excerpt:
        '숙소비 공제, 여권 보관, 사업장 이동 제한처럼 실제 근무 중 권리 제한으로 이어질 수 있는 조항을 확인합니다.',
    },
    {
      title: '빠진 근로조건 확인',
      excerpt:
        '계약기간, 근로장소, 업무내용, 휴게시간, 휴일처럼 계약서에서 빠진 항목이 있는지 확인합니다.',
    },
  ],
  partTime: [
    {
      title: '임금 산정에 필요한 항목 확인',
      excerpt:
        '시급, 근로시간, 휴게시간, 주휴수당 등 임금 산정에 필요한 항목이 계약서에 적혀 있는지 확인합니다.',
    },
    {
      title: '실제 근무와 수당 조건 확인',
      excerpt:
        '수습 기간, 공제 항목, 연장·야간·휴일근로 수당 조건이 실제 근무와 맞는지 확인합니다.',
    },
    {
      title: '계약 기간 표시 확인',
      excerpt:
        '근로 시작일과 종료일 또는 기간의 정함이 없는 계약인지가 문서에서 분명하게 확인되는지 살펴봅니다.',
    },
  ],
  disabledWorker: [
    {
      title: '직무·시간·임금 조건 확인',
      excerpt:
        '직무, 근로시간, 임금 조건이 장애를 이유로 불리하게 정해진 부분이 없는지 확인합니다.',
    },
    {
      title: '편의 제공과 근무환경 확인',
      excerpt:
        '필요한 편의 제공, 안전한 근무환경, 의사소통 지원이 계약·근무 조건에서 빠져 있지 않은지 확인합니다.',
    },
  ],
};

interface ResultPanelProps {
  review: BeforeReviewResult;
  onIssueSelect?: (tag: string) => void;
  accessibilityDisclosure?: ReactNode;
}

export function ResultPanel({
  review,
  onIssueSelect,
  accessibilityDisclosure = null,
}: ResultPanelProps) {
  const [isEvidenceDisclosureOpen, setIsEvidenceDisclosureOpen] = useState(false);
  const [isReviewNotesOpen, setIsReviewNotesOpen] = useState(false);
  const [expandedClauseKeys, setExpandedClauseKeys] = useState<Set<string>>(() => new Set());

  const taggedIssueCards = useMemo(() => buildBeforeReviewDisplayIssues(review), [review]);
  const reviewFindingSummary = useMemo(
    () => buildBeforeReviewFindingSummary(review, taggedIssueCards),
    [review, taggedIssueCards],
  );
  const clausePreviewBlocks = useMemo<ClausePreviewBlock[]>(
    () => buildClausePreviewBlocks(review, taggedIssueCards),
    [review, taggedIssueCards],
  );
  const documentName = getDocumentDisplayName(review);

  useEffect(() => {
    setExpandedClauseKeys(new Set());
    setIsEvidenceDisclosureOpen(false);
    setIsReviewNotesOpen(false);
  }, [review.review_id]);

  function toggleClauseBlock(key: string) {
    setExpandedClauseKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }

      return nextKeys;
    });
  }

  function renderClauseDetail(block: ClausePreviewBlock, showBadges = false) {
    const displaySentences = normalizeContractExcerptSentencesForDisplay(block.sentences);

    return (
      <>
        {showBadges && block.status && block.severity ? (
          <div className={styles.clauseDetailBadges}>
            <StatusBadge kind="status" value={block.status} />
            <StatusBadge kind="severity" value={block.severity} />
          </div>
        ) : null}

        <p className={styles.clauseSourceLabel}>{block.sourceLabel}</p>
        {block.fallbackNote ? (
          <p className={styles.clauseFallbackNote}>{block.fallbackNote}</p>
        ) : null}
        <div className={styles.contractExcerptText}>
          {displaySentences.map((sentence, sentenceIndex) =>
            sentence.highlighted ? (
              <span
                key={`${sentence.text}-${sentenceIndex}`}
                className={styles.highlightedSentenceRow}
              >
                <span
                  className={`${styles.sentenceHighlight} ${getEvidenceHighlightClassName(
                    block.tone,
                  )}`}
                >
                  {sentence.text}
                </span>
                {block.tag ? (
                  <span className={`${styles.inlineTagPill} ${getTagClassName(block.tone)}`}>
                    {block.tag}
                  </span>
                ) : null}
              </span>
            ) : (
              <span
                key={`${sentence.text}-${sentenceIndex}`}
                className={styles.neutralSentence}
              >
                {sentence.text}
              </span>
            ),
          )}
        </div>

        {block.lawRef ? (
          <span className={styles.lawRefChip}>{block.lawRef}</span>
        ) : null}
      </>
    );
  }

  return (
    <div className={styles.stack}>
      <header className={styles.resultAppHeader}>
        <div>
          <h2 className={styles.resultAppTitle}>근로계약서 검토</h2>
          <p className={styles.resultAppSummary}>{review.headline}</p>
        </div>
      </header>

      <div className={styles.resultTabs} aria-label="결과 보기">
        <span className={`${styles.resultTab} ${styles.resultTabActive}`} aria-current="page">
          검토 결과
        </span>
        <span className={`${styles.resultTab} ${styles.resultTabDisabled}`} aria-disabled="true">
          법령 후보
        </span>
        <Link
          href="/after"
          className={`${styles.resultTab} ${styles.resultTabLink}`}
          aria-label="AI 법률 상담으로 이동"
        >
          AI 상담
        </Link>
      </div>

      <section
        id="before-contract-document-section"
        className={styles.documentPreview}
        aria-labelledby="document-preview-title"
        tabIndex={-1}
      >
        <div className={styles.documentPreviewHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Contract document</p>
            <h3 id="document-preview-title" className={styles.sectionTitle}>
              {documentName}
            </h3>
          </div>
          <div className={styles.documentToolbar} aria-label="문서 검토 상태">
            <span className={styles.documentToolbarLabel}>
              표시 항목 {clausePreviewBlocks.length}개
            </span>
            <FindingBadge
              label={`위험 ${reviewFindingSummary.riskCount}건`}
              tone={reviewFindingSummary.riskCount > 0 ? 'danger' : 'neutral'}
            />
            <FindingBadge
              label={`누락 ${reviewFindingSummary.needsReviewCount}건`}
              tone={reviewFindingSummary.needsReviewCount > 0 ? 'warning' : 'neutral'}
            />
            <FindingBadge
              label={`확인 ${reviewFindingSummary.passCount}건`}
              tone={reviewFindingSummary.passCount > 0 ? 'success' : 'neutral'}
            />
          </div>
        </div>

        <div className={styles.documentPreviewMeta} aria-label="계약 정보">
          <span>사업주 · {review.contract_info.employer}</span>
          <span>근로자 · {review.contract_info.employee}</span>
          <span>시작일 · {review.contract_info.start_date}</span>
        </div>

        <div className={styles.contractExcerptSurface}>
          {clausePreviewBlocks.length ? (
            clausePreviewBlocks.map((block, index) => {
              const clauseKey = getClauseKey(block, index);
              const panelId = getClausePanelId(block, index);
              const isExpanded = expandedClauseKeys.has(clauseKey);

              return (
                <section
                  key={`${block.title}-${index}`}
                  className={`${styles.contractSection} ${styles.contractSectionAccordion}`}
                >
                  <button
                    id={getClauseButtonId(block, index)}
                    type="button"
                    className={`${styles.clauseAccordionButton} ${getClauseAccordionClassName(
                      block.tone,
                    )}`}
                    data-clause-preview-tag={block.tag ?? undefined}
                    data-clause-preview-kind={block.tag ? 'issue' : 'supporting'}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    aria-label={`${block.tag ?? getClauseHeaderLabel(block)} ${block.title} ${
                      isExpanded ? '접기' : '펼치기'
                    }`}
                    onClick={() => {
                      toggleClauseBlock(clauseKey);
                      if (block.tag) {
                        onIssueSelect?.(block.tag);
                      }
                    }}
                  >
                    <span className={`${styles.clauseHeaderTag} ${getTagClassName(block.tone)}`}>
                      {block.tag ?? getClauseHeaderLabel(block)}
                    </span>
                    <span
                      className={`${styles.clauseSignal} ${getClauseSignalClassName(block.tone)}`}
                      aria-hidden="true"
                    >
                      <ClauseSignalIcon tone={block.tone} />
                    </span>
                    <span className={styles.clauseAccordionContent}>
                      <span className={styles.clauseAccordionMeta}>
                        {getIssueToneLabel(block)}
                      </span>
                      <span className={styles.clauseAccordionTitle}>{block.title}</span>
                      <span className={styles.clauseAccordionSummary}>
                        {getClauseHeaderSummary(block)}
                      </span>
                    </span>
                    <ChevronDown
                      size={17}
                      aria-hidden="true"
                      className={`${styles.clauseAccordionIcon} ${
                        isExpanded ? styles.clauseAccordionIconOpen : ''
                      }`}
                    />
                  </button>
                  <div
                    id={panelId}
                    className={styles.clauseAccordionPanel}
                    hidden={!isExpanded}
                  >
                    {renderClauseDetail(block, true)}
                  </div>
                </section>
              );
            })
          ) : (
            <div className={styles.emptyPositive}>
              현재 결과 기준으로 바로 표시할 계약서 발췌 근거는 없습니다.
            </div>
          )}
        </div>

      </section>

      {accessibilityDisclosure}

      <div className={styles.compactDisclosureStack}>
        <section className={styles.compactDisclosure}>
          <button
            id="before-evidence-detail-button"
            type="button"
            className={styles.compactDisclosureButton}
            aria-expanded={isEvidenceDisclosureOpen}
            aria-controls="before-evidence-disclosure-panel"
            onClick={() => setIsEvidenceDisclosureOpen((isOpen) => !isOpen)}
          >
            <span className={styles.compactDisclosureCopy}>
              <span className={styles.compactDisclosureEyebrow}>Evidence detail</span>
              <span className={styles.compactDisclosureTitle}>세부 근거 보기</span>
              <span className={styles.compactDisclosureSummary}>
                문서 발췌와 시나리오별 확인 포인트 {review.evidence.length}개
              </span>
            </span>
            <ChevronDown
              size={17}
              aria-hidden="true"
              className={`${styles.compactDisclosureIcon} ${
                isEvidenceDisclosureOpen ? styles.compactDisclosureIconOpen : ''
              }`}
            />
          </button>

          <div
            id="before-evidence-disclosure-panel"
            className={styles.compactDisclosurePanel}
            hidden={!isEvidenceDisclosureOpen}
          >
            <div className={styles.evidenceList}>
              {review.evidence.map((evidence, index) => {
                const displayEvidence = getScenarioEvidenceCopy(review, evidence, index);
                const evidenceExcerptLines = normalizeEvidenceExcerptLinesForDisplay(
                  displayEvidence.excerpt,
                );

                return (
                  <article key={evidence.title} className={styles.evidenceCard}>
                    <div className={styles.evidenceBody}>
                      <p className={styles.evidenceIndex}>Evidence {index + 1}</p>
                      <h4 className={styles.evidenceTitle}>{displayEvidence.title}</h4>
                      <div className={styles.evidenceExcerpt}>
                        {evidenceExcerptLines.map((line, lineIndex) => (
                          <span
                            key={`${line}-${lineIndex}`}
                            className={styles.evidenceExcerptLine}
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.compactDisclosure}>
          <button
            type="button"
            className={styles.compactDisclosureButton}
            aria-expanded={isReviewNotesOpen}
            aria-controls="before-review-notes-disclosure-panel"
            onClick={() => setIsReviewNotesOpen((isOpen) => !isOpen)}
          >
            <span className={styles.compactDisclosureCopy}>
              <span className={styles.compactDisclosureEyebrow}>Review notes</span>
              <span className={styles.compactDisclosureTitle}>요약 메모와 권장 조치</span>
              <span className={styles.compactDisclosureSummary}>
                권장 조치 {review.recommended_actions.length}개 · 평가 메모{' '}
                {review.overall_assessment.length}개
              </span>
            </span>
            <ChevronDown
              size={17}
              aria-hidden="true"
              className={`${styles.compactDisclosureIcon} ${
                isReviewNotesOpen ? styles.compactDisclosureIconOpen : ''
              }`}
            />
          </button>

          <div
            id="before-review-notes-disclosure-panel"
            className={styles.compactDisclosurePanel}
            hidden={!isReviewNotesOpen}
          >
            <div className={styles.reviewNotesGrid}>
              <div className={styles.reviewNotesGroup}>
                <p className={styles.reviewNotesTitle}>권장 조치</p>
                <div className={styles.actionList}>
                  {review.recommended_actions.map((action) => (
                    <div key={action} className={styles.actionItem}>
                      {action}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.reviewNotesGroup}>
                <p className={styles.reviewNotesTitle}>전체 평가</p>
                <div className={styles.summaryList}>
                  {review.overall_assessment.map((line) => (
                    <div key={line} className={styles.summaryItem}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function buildBeforeReviewDisplayIssues(
  review: BeforeReviewResult,
): BeforeReviewDisplayIssue[] {
  return tagIssueCards(buildBaseIssueCards(review));
}

function buildBaseIssueCards(review: BeforeReviewResult): IssueCard[] {
  if (review.important_points.length) {
    return review.important_points;
  }

  return Object.entries(review.rule_check ?? {})
    .filter(([, value]) => value.status !== 'PASS')
    .map(([key, value]) => ({
      title: getRuleCheckDisplayTitle(key),
      status: value.status,
      severity: value.severity,
      law_ref: value.law_ref ?? '',
      description: value.message ?? '',
    }));
}

function buildBeforeReviewFindingSummary(
  review: BeforeReviewResult,
  displayIssues: BeforeReviewDisplayIssue[],
): BeforeReviewFindingSummary {
  return {
    riskCount: displayIssues.filter((item) => item.status === 'VIOLATION').length,
    needsReviewCount: displayIssues.filter((item) => item.status === 'WARNING').length,
    passCount: Object.values(review.rule_check ?? {}).filter((item) => item.status === 'PASS')
      .length,
  };
}

function tagIssueCards(issueCards: IssueCard[]): BeforeReviewDisplayIssue[] {
  let riskIndex = 0;
  let missingIndex = 0;

  return issueCards.map<BeforeReviewDisplayIssue>((issue) => {
    if (issue.status === 'VIOLATION') {
      riskIndex += 1;
      return { ...issue, tag: `R${riskIndex}`, tone: 'danger' };
    }

    if (issue.status === 'WARNING') {
      missingIndex += 1;
      return { ...issue, tag: `M${missingIndex}`, tone: 'warning' };
    }

    return { ...issue, tag: null, tone: 'success' };
  });
}

function buildClausePreviewBlocks(
  review: BeforeReviewResult,
  taggedIssueCards: BeforeReviewDisplayIssue[],
): ClausePreviewBlock[] {
  const passCards = buildPassingRuleCards(review).filter(
      (passCard) =>
        !taggedIssueCards.some(
          (issue) =>
            getPrimaryTextCategory(issue.title, issue.description) ===
            getPrimaryTextCategory(passCard.title, passCard.description),
        ),
  );
  const issueBlockByTag = new Map<string, ClausePreviewBlock>();
  const supportingEvidenceBlocks: ClausePreviewBlock[] = [];

  review.evidence.forEach((evidence, index) => {
    const sentences = splitEvidenceExcerpt(evidence.excerpt);
    const issue = findIssueForEvidence(evidence, taggedIssueCards, passCards, index);
    const highlightedIndex = chooseHighlightedSentenceIndex(sentences, issue, evidence.title);
    const renderedSentences = sentences.map((sentence, sentenceIndex) => ({
      text: sentence,
      highlighted: sentenceIndex === highlightedIndex,
    }));

    const block: ClausePreviewBlock = {
      title: evidence.title,
      neutralSentences: renderedSentences
        .filter((sentence) => !sentence.highlighted)
        .map((sentence) => sentence.text),
      highlightedSentence:
        highlightedIndex >= 0 ? renderedSentences[highlightedIndex]?.text ?? null : null,
      sentences: renderedSentences,
      issue,
      status: issue?.status ?? null,
      severity: issue?.severity ?? null,
      tag: issue?.tag ?? null,
      tone: issue?.tone ?? 'neutral',
      lawRef: issue?.law_ref?.trim() || null,
      sourceLabel: '문서 발췌 기준',
      fallbackNote: null,
    };

    if (issue?.tag) {
      if (!issueBlockByTag.has(issue.tag)) {
        issueBlockByTag.set(issue.tag, block);
      }
      return;
    }

    supportingEvidenceBlocks.push(block);
  });

  const issueBlocks = taggedIssueCards
    .filter((issue) => issue.tag)
    .map((issue) => issueBlockByTag.get(issue.tag ?? '') ?? buildFallbackClausePreviewBlock(issue));

  return [...issueBlocks, ...supportingEvidenceBlocks];
}

function findIssueForEvidence(
  evidence: BeforeReviewEvidence,
  taggedIssueCards: BeforeReviewDisplayIssue[],
  passCards: BeforeReviewDisplayIssue[],
  evidenceIndex: number,
): BeforeReviewDisplayIssue | null {
  if (isMissingEvidence(evidence)) {
    const warningIssues = taggedIssueCards.filter((issue) => issue.status === 'WARNING');
    return findBestIssueForEvidence(evidence, warningIssues, evidenceIndex);
  }

  return findBestIssueForEvidence(evidence, [...taggedIssueCards, ...passCards], evidenceIndex);
}

function buildFallbackClausePreviewBlock(issue: BeforeReviewDisplayIssue): ClausePreviewBlock {
  const highlightedText = issue.description.trim() || issue.title;
  return {
    title: issue.title,
    neutralSentences: [],
    highlightedSentence: highlightedText,
    sentences: [{ text: highlightedText, highlighted: true }],
    issue,
    status: issue.status,
    severity: issue.severity,
    tag: issue.tag,
    tone: issue.tone,
    lawRef: issue.law_ref.trim() || null,
    sourceLabel: '검토 항목 기준',
    fallbackNote: '관련 발췌 없음 · 문서에서 추가 확인 필요',
  };
}

function buildPassingRuleCards(review: BeforeReviewResult): BeforeReviewDisplayIssue[] {
  return Object.entries(review.rule_check ?? {})
    .filter(([, value]) => value.status === 'PASS')
    .map(([key, value]) => ({
      title: getRuleCheckDisplayTitle(key),
      status: value.status,
      severity: value.severity,
      law_ref: value.law_ref ?? '',
      description: value.message ?? getRuleCheckDisplayTitle(key),
      tag: null,
      tone: 'success',
    }));
}

function isMissingEvidence(evidence: BeforeReviewEvidence): boolean {
  return /(누락|missing)/i.test(evidence.title);
}

function splitEvidenceExcerpt(excerpt: string): string[] {
  return excerpt
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .flatMap((line) => splitLongSentence(line.trim()))
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeContractExcerptSentencesForDisplay(
  sentences: ClausePreviewSentence[],
): ClausePreviewSentence[] {
  return sentences.reduce<ClausePreviewSentence[]>((displaySentences, sentence) => {
    const text = normalizeContractExcerptForDisplay(sentence.text);
    if (!text) {
      return displaySentences;
    }

    const previousSentence = displaySentences[displaySentences.length - 1];
    if (previousSentence && shouldJoinContractExcerptDisplayLine(previousSentence.text, text)) {
      previousSentence.text = joinContractExcerptDisplayLine(previousSentence.text, text);
      previousSentence.highlighted = previousSentence.highlighted || sentence.highlighted;
      return displaySentences;
    }

    displaySentences.push({ ...sentence, text });
    return displaySentences;
  }, []);
}

function normalizeEvidenceExcerptLinesForDisplay(excerpt: string): string[] {
  return splitEvidenceExcerpt(excerpt).reduce<string[]>((displayLines, line) => {
    const text = normalizeContractExcerptForDisplay(line);
    if (!text) {
      return displayLines;
    }

    const previousLine = displayLines[displayLines.length - 1];
    if (previousLine && shouldJoinContractExcerptDisplayLine(previousLine, text)) {
      displayLines[displayLines.length - 1] = joinContractExcerptDisplayLine(previousLine, text);
      return displayLines;
    }

    displayLines.push(text);
    return displayLines;
  }, []);
}

function normalizeContractExcerptForDisplay(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*([:：])\s*/g, '$1 ')
    .replace(/([[(（])\s+/g, '$1')
    .replace(/\s+([\])）},.，、])/g, '$1')
    .replace(/([)\]}])\s+원(?=$|[\s,])/g, '$1원')
    .replace(/(\d[\d,]*)\s+(원|일|시|분|시간)(?=$|[\s),.])/g, '$1$2')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .trim();
}

function shouldJoinContractExcerptDisplayLine(previousText: string, nextText: string): boolean {
  const previous = previousText.trim();
  const next = nextText.trim();

  if (!previous || !next || isLikelyNewContractField(next)) {
    return false;
  }

  if (isCurrencyOnlyFragment(next) && hasUnclosedOpeningMark(previous)) {
    return true;
  }

  if (
    isDetachedCurrencyUnit(next) &&
    (/[\d\])]$/.test(previous) || isCurrencyOnlyFragment(previous))
  ) {
    return true;
  }

  if (isDetachedClosingFragment(next)) {
    return true;
  }

  if (isShortContractLabel(previous) && isContractValueFragment(next)) {
    return true;
  }

  if (isContractFieldDisplayRow(previous) && isContractFieldContinuationFragment(next)) {
    return true;
  }

  if (hasDanglingOpeningMark(previous) && isShortContractContinuation(next)) {
    return true;
  }

  if (hasUnclosedOpeningMark(previous) && isShortContractContinuation(next)) {
    return true;
  }

  if (/근로자에게$/.test(previous) && /^(직접|계좌)/.test(next)) {
    return true;
  }

  if (/^지급방법(?:\s|$)/.test(previous) && /^(근로자에게|직접|계좌|매월|매주|매일)/.test(next)) {
    return true;
  }

  return false;
}

function joinContractExcerptDisplayLine(previousText: string, nextText: string): string {
  const previous = previousText.trim();
  const next = nextText.trim();
  const separator =
    (isDetachedCurrencyUnit(next) && /[\d\])]$/.test(previous)) ||
    isDetachedClosingFragment(next) ||
    /^[)\]}]/.test(next)
      ? ''
      : ' ';

  return normalizeContractExcerptForDisplay(`${previous}${separator}${next}`);
}

function isDetachedCurrencyUnit(text: string): boolean {
  return /^(원|원,)$/.test(text);
}

function isCurrencyOnlyFragment(text: string): boolean {
  return /^원+[,]?$/.test(text);
}

function isDetachedClosingFragment(text: string): boolean {
  return /^[)\]},.，、]+(?:원|원,)?$/.test(text);
}

function isShortContractLabel(text: string): boolean {
  return /^(월급|일급|시간급|상여금|임금지급일|지급방법|근로자에게|기본급|수당|공제항목)$/.test(
    text,
  );
}

function isContractValueFragment(text: string): boolean {
  return (
    /^[\d,]+(?:원)?$/.test(text) ||
    /^(있음|없음)(?:[\[(].*)?$/.test(text) ||
    /^(매월|매주|매일|직접|계좌|근로자)/.test(text)
  );
}

function isContractFieldDisplayRow(text: string): boolean {
  return /^[-•]?\s*(?:그 밖의 수당|초과근로에 대한 가산임금률|시간\(일,\s*월\)급|월급|일급|시간급|상여금|임금지급일|지급방법|기본급|수당|공제항목)(?=$|[\s:：([（\[])/.test(
    text,
  );
}

function isContractFieldContinuationFragment(text: string): boolean {
  if (isLikelyNewContractField(text)) {
    return false;
  }

  return (
    text.length <= 34 &&
    (/^(있음|없음)(?:\s*[\[(（].*)?$/.test(text) ||
      /^(매월|매주|매일|또는|직접|계좌|근로자|당\)|\d)/.test(text) ||
      isDetachedCurrencyUnit(text) ||
      isDetachedClosingFragment(text))
  );
}

function hasDanglingOpeningMark(text: string): boolean {
  return /[\[(（]$/.test(text);
}

function hasUnclosedOpeningMark(text: string): boolean {
  return (
    countMatches(text, /\(/g) > countMatches(text, /\)/g) ||
    countMatches(text, /\[/g) > countMatches(text, /\]/g) ||
    countMatches(text, /（/g) > countMatches(text, /）/g)
  );
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function isShortContractContinuation(text: string): boolean {
  return text.length <= 16 && !isLikelyNewContractField(text) && !/^원+[,]?$/.test(text);
}

function isLikelyNewContractField(text: string): boolean {
  return (
    isContractFieldDisplayRow(text) ||
    /^[-•]?\s*(?:그 밖의|초과근로|근로시간|휴게)(?=$|[\s:：([（\[])/.test(text) ||
    /^\d+[.)]/.test(text)
  );
}

function splitLongSentence(line: string): string[] {
  if (line.length < 90) {
    return [line];
  }

  const matches = line.match(/.+?(?:다\.|요\.|함\.|[.!?。！？](?:\s|$)|$)/gu);
  return matches?.map((item) => item.trim()).filter(Boolean) ?? [line];
}

function findBestIssueForEvidence(
  evidence: BeforeReviewEvidence,
  candidates: BeforeReviewDisplayIssue[],
  evidenceIndex: number,
): BeforeReviewDisplayIssue | null {
  if (!candidates.length) {
    return null;
  }

  const evidenceText = `${evidence.title} ${evidence.excerpt}`;
  const evidenceCategory = getPrimaryTextCategory(evidence.title, evidence.excerpt);
  let bestMatch: { issue: BeforeReviewDisplayIssue; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateText = `${candidate.title} ${candidate.description} ${candidate.law_ref}`;
    const candidateCategory = getPrimaryTextCategory(candidate.title, candidate.description);
    const score =
      getTokenOverlapScore(evidenceText, candidateText) +
      (evidenceCategory && evidenceCategory === candidateCategory ? 8 : 0);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { issue: candidate, score };
    }
  }

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.issue;
  }

  return candidates[evidenceIndex] ?? null;
}

function chooseHighlightedSentenceIndex(
  sentences: string[],
  issue: BeforeReviewDisplayIssue | null,
  evidenceTitle: string,
): number {
  if (!sentences.length) {
    return -1;
  }

  if (!issue) {
    return getFirstContentSentenceIndex(sentences);
  }

  const targetText = `${issue.title} ${issue.description} ${issue.law_ref}`;
  const targetCategory = getPrimaryTextCategory(issue.title, issue.description);
  let bestMatch = { index: getFirstContentSentenceIndex(sentences), score: -1 };

  sentences.forEach((sentence, index) => {
    const sentenceCategory = getPrimaryTextCategory(evidenceTitle, sentence);
    const score =
      getTokenOverlapScore(sentence, targetText) +
      (targetCategory && targetCategory === sentenceCategory ? 7 : 0) +
      (isLikelyHeading(sentence) ? -2 : 0);

    if (score > bestMatch.score) {
      bestMatch = { index, score };
    }
  });

  if (bestMatch.score <= 0) {
    return getFirstContentSentenceIndex(sentences);
  }

  return bestMatch.index;
}

function getFirstContentSentenceIndex(sentences: string[]): number {
  const contentIndex = sentences.findIndex((sentence) => !isLikelyHeading(sentence));
  return contentIndex >= 0 ? contentIndex : 0;
}

function isLikelyHeading(sentence: string): boolean {
  const compactSentence = sentence.replace(/\s+/g, '');
  const isShortFieldLabel =
    sentence.length <= 16 &&
    /^(월급|일급|시간급|원|상여금|있음|없음|임금지급일|지급방법|근로자에게|직접|당|원원)$/.test(
      compactSentence,
    );

  return isShortFieldLabel || (sentence.length <= 18 && /^\d+[.)]?\s*\S+/.test(sentence));
}

function getTokenOverlapScore(source: string, target: string): number {
  const sourceTokens = new Set(tokenizeForMatch(source));
  return tokenizeForMatch(target).reduce((score, token) => {
    if (sourceTokens.has(token)) {
      return score + (token.length >= 4 ? 2 : 1);
    }

    return score;
  }, 0);
}

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getPrimaryTextCategory(...parts: string[]): string | null {
  const text = parts.join(' ');

  if (/(최저|임금|시급|월급|일급|상여|수당|공제|지급일)/.test(text)) {
    return 'wage';
  }

  if (/(근로시간|근로일|휴게|휴일|소정|초과근무|업무\s*시작|업무\s*종료)/.test(text)) {
    return 'hours';
  }

  if (/(계약기간|근로계약기간|근로개시|시작일|종료일|기간의\s*정함)/.test(text)) {
    return 'period';
  }

  if (/(숙소|기숙사|숙박시설)/.test(text)) {
    return 'dormitory';
  }

  if (/(여권|이직|사업장|손해배상|권리\s*제한|보관|이동\s*제한)/.test(text)) {
    return 'rights';
  }

  if (/(누락|빠진|미기재|불명확)/.test(text)) {
    return 'missing';
  }

  return null;
}

function getRuleCheckDisplayTitle(key: string): string {
  if (key === 'minimum_wage') {
    return '임금 조항';
  }

  if (key === 'working_hours') {
    return '근로시간 조항';
  }

  if (key === 'break_time') {
    return '휴게시간 조항';
  }

  if (key === 'payment_day') {
    return '임금 지급일 조항';
  }

  return key.replace(/_/g, ' ');
}

function getDocumentDisplayName(review: BeforeReviewResult): string {
  const uploadedFileName = review.uploaded_files
    ?.find((file) => file.name.trim())
    ?.name.trim();

  if (uploadedFileName) {
    return uploadedFileName;
  }

  const contractType = getContractTypeDisplayLabel(review.contract_info.type);
  if (contractType) {
    return contractType.endsWith('계약서') ? contractType : `${contractType} 계약서`;
  }

  return '근로계약서';
}

function getContractTypeDisplayLabel(type: string): string {
  return type
    .trim()
    .replace(/_/g, ' ')
    .replace(/기간의\s+정함이\s+없는\s+경우/g, '기간의 정함이 없는')
    .replace(/\s+/g, ' ');
}

function getClausePanelId(block: ClausePreviewBlock, index: number): string {
  return `before-clause-preview-${getClauseKey(block, index)}`;
}

function getClauseButtonId(block: ClausePreviewBlock, index: number): string {
  return `before-clause-preview-button-${getClauseKey(block, index)}`;
}

function getClauseKey(block: ClausePreviewBlock, index: number): string {
  const key = block.tag ?? `support-${index}`;
  return key.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getClauseHeaderLabel(block: ClausePreviewBlock): string {
  if (block.status === 'PASS' || block.tone === 'success') {
    return '확인';
  }

  return '참고';
}

function getIssueToneLabel(block: ClausePreviewBlock): string {
  if (block.status === 'VIOLATION') {
    return '위험 의심';
  }

  if (block.status === 'WARNING') {
    return '누락 정보';
  }

  if (block.status === 'PASS') {
    return '확인 완료';
  }

  return '검토 항목';
}

function getClauseHeaderSummary(block: ClausePreviewBlock): string {
  const displaySentences = normalizeContractExcerptSentencesForDisplay(block.sentences);
  const summary =
    displaySentences.find((sentence) => sentence.highlighted)?.text ??
    block.issue?.description ??
    displaySentences.find((sentence) => sentence.text.trim())?.text ??
    block.sourceLabel;

  return truncatePreviewText(summary);
}

function truncatePreviewText(text: string, maxLength = 92): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 1).trimEnd()}...`;
}

function getEvidenceHighlightClassName(tone: EvidenceTone): string {
  if (tone === 'danger') {
    return styles.sentenceHighlightDanger;
  }

  if (tone === 'warning') {
    return styles.sentenceHighlightWarning;
  }

  if (tone === 'success') {
    return styles.sentenceHighlightSuccess;
  }

  return styles.sentenceHighlightNeutral;
}

function getClauseAccordionClassName(tone: EvidenceTone): string {
  if (tone === 'danger') {
    return styles.clauseAccordionDanger;
  }

  if (tone === 'warning') {
    return styles.clauseAccordionWarning;
  }

  if (tone === 'success') {
    return styles.clauseAccordionSuccess;
  }

  return styles.clauseAccordionNeutral;
}

function getClauseSignalClassName(tone: EvidenceTone): string {
  if (tone === 'danger') {
    return styles.clauseSignalDanger;
  }

  if (tone === 'warning') {
    return styles.clauseSignalWarning;
  }

  if (tone === 'success') {
    return styles.clauseSignalSuccess;
  }

  return styles.clauseSignalNeutral;
}

function ClauseSignalIcon({ tone }: { tone: EvidenceTone }) {
  if (tone === 'danger') {
    return <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />;
  }

  if (tone === 'warning') {
    return <CircleDot size={14} strokeWidth={2.5} aria-hidden="true" />;
  }

  if (tone === 'success') {
    return <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden="true" />;
  }

  return <CircleDot size={14} strokeWidth={2.5} aria-hidden="true" />;
}

function getTagClassName(tone: EvidenceTone): string {
  if (tone === 'danger') {
    return styles.tagPillDanger;
  }

  if (tone === 'warning') {
    return styles.tagPillWarning;
  }

  if (tone === 'success') {
    return styles.tagPillSuccess;
  }

  return styles.tagPillNeutral;
}

function getScenarioEvidenceCopy(
  review: BeforeReviewResult,
  evidence: BeforeReviewEvidence,
  index: number,
): BeforeReviewEvidence {
  const scenario = getEvidenceCopyScenario(review);
  const displayCopy = scenario ? SCENARIO_EVIDENCE_COPY[scenario][index] : null;

  return displayCopy ?? evidence;
}

function getEvidenceCopyScenario(review: BeforeReviewResult): EvidenceCopyScenario | null {
  return MOCK_REVIEW_EVIDENCE_SCENARIOS[review.review_id] ?? null;
}

function FindingBadge({
  label,
  tone,
}: {
  label: string;
  tone: EvidenceTone;
}) {
  const className =
    tone === 'danger'
      ? styles.findingBadgeDanger
      : tone === 'warning'
        ? styles.findingBadgeWarning
        : tone === 'success'
          ? styles.findingBadgeSuccess
          : styles.findingBadgeNeutral;

  return <span className={[styles.findingBadgeBase, className].join(' ')}>{label}</span>;
}

function StatusBadge({
  kind,
  value,
}: {
  kind: 'status' | 'severity';
  value: string;
}) {
  const className =
    kind === 'status'
      ? value === 'PASS'
        ? styles.statusPass
        : value === 'WARNING'
          ? styles.statusWarning
          : styles.statusViolation
      : value === 'NONE'
        ? styles.severityNone
        : value === 'LOW'
          ? styles.severityLow
          : value === 'MEDIUM'
            ? styles.severityMedium
            : value === 'HIGH'
              ? styles.severityHigh
              : styles.severityCritical;

  return <span className={[styles.badgeBase, className].join(' ')}>{value}</span>;
}
