'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Scn001ContinuityPanel } from '@/components/continuity/Scn001ContinuityPanel';
import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { Button } from '@/components/ui/Button';
import { CitationPill } from '@/components/ui/CitationPill';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { Notification } from '@/components/ui/Notification';
import { SkipLink } from '@/components/ui/SkipLink';
import { useFlow } from '@/context/FlowContext';
import { buildLegalBasis, hasDraftGrounding } from '@/lib/api';
import { getBridgeHandoffDisplayFields } from '@/lib/bridge-handoff';
import {
  classifyDocumentDraftSupport,
  getScn001FrozenDraftCatalogItem,
  type SupportedDraftDocumentOption,
} from '@/lib/documentDraftCatalog';
import { shouldShowScn001FixedPresetResultContinuityPanel } from '@/lib/scn001ContinuityPanel';
import {
  SCN001_FROZEN_DRAFT_DOCUMENT_TYPE,
  isScn001FrozenDraftPath,
} from '@/lib/scenarioPresetDrafts';
import { getScenarioPreset } from '@/lib/scenarioPresets';
import type { BridgeHandoffItem } from '@/types/bridge-handoff';
import type { AnswerResponse, DocumentType } from '@/types/api';

import styles from './page.module.css';

const resultFlowSteps = ['상담 입력', '상담 결과'] as const;
const AFTER_FALLBACK_HREF = '/after?fallback=missing-state';

type ContinuityPanelModel = {
  strength: 'strong' | 'weak';
  issueLabels: string[];
  lawRefs: string[];
  recommendedNextActions: string[];
};

export default function AfterResultPage() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { state, dispatch } = useFlow();
  const answer = state.answer_response;
  const activePreset = getScenarioPreset(state.selected_preset_id);
  const isBridgeHandoffAnswer = state.answer_origin === 'bridge_handoff';
  const supportsDraft = !isBridgeHandoffAnswer && (activePreset?.supportsDraft ?? true);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(
    state.selected_document_type,
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const hasGrounding = answer ? hasDraftGrounding(answer) : false;
  const canShowScn001FrozenDraftCta = isScn001FrozenDraftPath({
    answer,
    selectedPresetId: state.selected_preset_id,
    userStatement: state.user_statement,
    answerOrigin: state.answer_origin,
  });
  const canShowScn001FixedPresetContinuityPanel =
    shouldShowScn001FixedPresetResultContinuityPanel({
      answer,
      selectedPresetId: state.selected_preset_id,
      userStatement: state.user_statement,
      answerOrigin: state.answer_origin,
    });
  const continuityPanel = useMemo(
    () =>
      answer
        ? getBridgeContinuityPanel({
            isBridgeHandoffAnswer,
            hasGrounding,
            citedArticles: answer.cited_articles,
            bridgeItems: state.bridge_handoff.items,
          })
        : null,
    [answer, hasGrounding, isBridgeHandoffAnswer, state.bridge_handoff.items],
  );

  useEffect(() => {
    if (!answer) {
      router.replace(AFTER_FALLBACK_HREF);
    }
  }, [answer, router]);

  useEffect(() => {
    if (answer) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      const frameId = window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        headingRef.current?.focus({ preventScroll: true });
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [answer]);

  if (!answer) {
    return (
      <>
        <SkipLink />
        <Masthead />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <p className={styles.redirectMessage}>
            이전 단계 데이터가 없어 상담 시작 화면으로 이동합니다.
          </p>
        </main>
      </>
    );
  }

  const draftClassification = supportsDraft
    ? classifyDocumentDraftSupport(answer)
    : null;
  const scn001FrozenDraftOption = canShowScn001FrozenDraftCta
    ? getScn001FrozenDraftCatalogItem()
    : null;
  const availableDocumentTypes = canShowScn001FrozenDraftCta
    ? scn001FrozenDraftOption
      ? [scn001FrozenDraftOption]
      : []
    : draftClassification?.availableDocumentTypes ?? [];
  const hasAvailableDocumentTypes = availableDocumentTypes.length > 0;
  const canProceedToDraftFlow =
    hasGrounding &&
    hasAvailableDocumentTypes &&
    (supportsDraft || canShowScn001FrozenDraftCta);
  const statementSummary = truncateText(state.user_statement || answer.query, 100);
  const canShowAnswer = hasGrounding;
  const groundedChunks = answer.retrieved_chunks.filter((chunk) =>
    answer.grounded_context_ids.includes(chunk.context_id),
  );
  const displayedGroundingContextCount =
    groundedChunks.length > 0 ? groundedChunks.length : answer.grounded_context_ids.length;
  const legalBasisIsCompact =
    answer.cited_articles.length + displayedGroundingContextCount <= 6;
  const selectorPanelClassName = canShowScn001FrozenDraftCta
    ? `${styles.selectorPanel} ${styles.selectorPanelStatic}`
    : styles.selectorPanel;
  const answerOnlyReason = getAnswerOnlyReason({
    hasGrounding,
    isBridgeHandoffAnswer,
    supportsDraft,
    hasAvailableDocumentTypes,
    canShowScn001FrozenDraftCta,
    draftGuidance: draftClassification?.answerOnlyGuidance ?? null,
  });

  function proceedToDraftIntake(documentType: DocumentType) {
    if (!canProceedToDraftFlow) {
      return;
    }

    if (
      canShowScn001FrozenDraftCta &&
      documentType !== SCN001_FROZEN_DRAFT_DOCUMENT_TYPE
    ) {
      return;
    }

    if (
      !canShowScn001FrozenDraftCta &&
      !isAvailableDocumentType(documentType, availableDocumentTypes)
    ) {
      return;
    }

    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    setSelectedDocumentType(documentType);
    dispatch({ type: 'SET_DOCUMENT_TYPE', payload: documentType });

    if (answer && canShowScn001FrozenDraftCta) {
      dispatch({ type: 'SET_LEGAL_BASIS', payload: buildLegalBasis(answer) });
    }

    router.push('/after/intake');
  }

  function resetFlow() {
    dispatch({ type: 'RESET' });
    router.push('/after');
  }

  return (
    <>
      <SkipLink />
      <Masthead />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.workspaceShell}>
          <WorkspaceSidebar
            activeItem="after"
            actionLabel="새 상담 시작"
            actionDescription="AI 법률 상담 질문 입력 화면으로 이동"
            onAction={resetFlow}
            ariaLabel="AI 법률 상담 메뉴"
            summary={
              <>
                <span>Current workspace</span>
                <strong>AI 법률 상담</strong>
                <p>상담 결과를 확인하고 가능한 문서 초안 흐름으로 이어갑니다.</p>
              </>
            }
          />

          <section className={styles.resultWorkspace} aria-labelledby="result-title">
            <header className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderCopy}>
                <h1 id="result-title" ref={headingRef} tabIndex={-1} className={styles.title}>
                  AI 법률 상담
                </h1>
                <p className={styles.lead}>
                  상담 결과에서 관련 조문, 핵심 포인트, 주의사항을 확인합니다.
                </p>
              </div>
              <ol className={styles.flowSteps} aria-label="상담 진행 흐름">
                {resultFlowSteps.map((step) => (
                  <li key={step}>
                    {step === '상담 입력' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        onClick={resetFlow}
                      >
                        {step}
                      </button>
                    ) : (
                      <span className={styles.flowStepActive} aria-current="step">
                        {step}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </header>

            <section className={styles.resultSummary} aria-label="상담 결과">
              <p className={styles.eyebrow}>Consult result</p>
              <h2 className={styles.resultSummaryTitle}>
                상담 답변
              </h2>
              {canShowAnswer ? (
                <div className={styles.answerText}>
                  {answer.answer.trim().length > 0 ? (
                    <p>{answer.answer}</p>
                  ) : (
                    <p>답변 본문을 생성하지 못했습니다.</p>
                  )}
                </div>
              ) : (
                <p className={styles.summaryText}>
                  근거가 확인되지 않아 답변 본문을 표시하지 않습니다.
                </p>
              )}
              <div className={styles.questionSummary}>
                <span>질문 요약</span>
                <p>{statementSummary}</p>
              </div>
            </section>

            <section className={styles.resultColumn} aria-label="법 조문 검색 결과">
            {!canShowAnswer ? (
              <Notification variant="warning" title="근거 확인 필요">
                <p>
                  인용된 법 조문 또는 근거 컨텍스트가 확인되지 않아 답변을 표시하지
                  않습니다. 입력을 보완해 다시 검색해주세요.
                </p>
              </Notification>
            ) : (
              <>
                <section className={styles.section} aria-labelledby="key-points-title">
                  <h2 id="key-points-title" className={styles.sectionTitle}>
                    핵심 포인트
                  </h2>
                  {answer.key_points.length > 0 ? (
                    <ul className={styles.list}>
                      {answer.key_points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyText}>표시할 핵심 포인트가 없습니다.</p>
                  )}
                </section>

                <details
                  className={styles.evidenceSection}
                  open={legalBasisIsCompact}
                  aria-labelledby="evidence-title"
                >
                  <summary className={styles.evidenceSummary}>
                    <span className={styles.evidenceSummaryText}>
                      <span className={styles.evidenceEyebrow}>법령 근거</span>
                      <span id="evidence-title" className={styles.evidenceTitle}>
                        근거 조문
                      </span>
                      <span className={styles.evidenceDescription}>
                        답변에 사용된 인용 조문과 출처 컨텍스트입니다.
                      </span>
                    </span>
                    <span className={styles.evidenceCount}>
                      {answer.cited_articles.length}개 조문
                    </span>
                  </summary>
                  <div className={styles.evidenceBody}>
                    <div className={styles.citationList}>
                      {answer.cited_articles.map((article) => (
                        <CitationPill key={article} label={article} />
                      ))}
                    </div>
                    {groundedChunks.length > 0 ? (
                      <ul className={styles.contextList} aria-label="출처 컨텍스트">
                        {groundedChunks.map((chunk) => (
                          <li key={chunk.chunk_id}>
                            <span className={styles.contextId}>#{chunk.context_id}</span>
                            <span>{chunk.citation_label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : answer.grounded_context_ids.length > 0 ? (
                      <ul className={styles.contextList} aria-label="출처 컨텍스트">
                        {answer.grounded_context_ids.map((contextId, index) => (
                          <li key={`${contextId}-${index}`}>
                            <span className={styles.contextId}>#{contextId}</span>
                            <span>근거 컨텍스트</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.emptyText}>근거 컨텍스트 표시 정보가 없습니다.</p>
                    )}
                  </div>
                </details>

                <section className={styles.cautionSection} aria-labelledby="cautions-title">
                  <h2 id="cautions-title" className={styles.sectionTitle}>
                    주의사항
                  </h2>
                  {answer.cautions.length > 0 ? (
                    <ul className={styles.list}>
                      {answer.cautions.map((caution) => (
                        <li key={caution}>{caution}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyText}>추가 주의사항이 없습니다.</p>
                  )}
                </section>
              </>
            )}

            {hasGrounding &&
            activePreset &&
            !activePreset.supportsDraft &&
            !canShowScn001FrozenDraftCta ? (
              <Notification variant="info" title="예시 질문 초안만 지원">
                <p>
                  이 예시의 문서 초안은 고정 입력과 고정 답변이 그대로 일치할 때만
                  표시합니다. 수정 입력에서는 조문 확인만 제공합니다.
                </p>
              </Notification>
            ) : null}

            {hasGrounding && isBridgeHandoffAnswer ? (
              <Notification variant="warning" title="계약서 검토 연결 답변 확인 전용">
                <p>
                  이 답변은 계약서 검토 결과에서 이어진 조문 확인용입니다. 연결된 검토 결과
                  기반 상담에서는 문서 초안을 열지 않습니다.
                </p>
              </Notification>
            ) : null}

            {hasGrounding && supportsDraft && !hasAvailableDocumentTypes ? (
                <Notification
                  variant="warning"
                  title="현재 지원 문서 초안은 없습니다"
                >
                  <p>
                    상담 답변과 근거를 먼저 확인하세요.
                    {' '}
                    {draftClassification?.answerOnlyGuidance.description ??
                      '이 주제는 현재 상담 답변으로만 제공합니다.'}
                  </p>
                </Notification>
              ) : null}

            {!hasGrounding ? (
              <Notification variant="warning" title="문서 초안 진행 불가">
                <p>
                  인용된 법 조문 또는 근거 컨텍스트가 확인되지 않았습니다. 문서 초안을 만들 수
                  없습니다.
                </p>
              </Notification>
            ) : null}

            <DisclaimerBanner />
            </section>
          </section>

          <aside className={styles.contextPanel} aria-label="상담 결과 요약">
            <div className={styles.contextHeader}>
              <p className={styles.contextEyebrow}>CONSULT RESULT</p>
              <h2>상담 결과 요약</h2>
            </div>
            <section className={selectorPanelClassName}>
              <p className={styles.eyebrow}>
                {isBridgeHandoffAnswer
                  ? '조문 확인 전용'
                  : canShowScn001FrozenDraftCta
                  ? '고정 초안'
                  : '작성 가능한 문서'}
              </p>
              <h2 id="document-type-title" className={styles.selectorTitle}>
                {isBridgeHandoffAnswer
                  ? '문서 초안 없이 조문만 확인합니다'
                  : canShowScn001FrozenDraftCta
                  ? '사업장 변경 사유 정리서 초안으로 이어집니다'
                  : canProceedToDraftFlow
                  ? '다음 단계에서 작성할 수 있는 문서입니다'
                  : '문서 초안 없이 상담 답변을 확인합니다'}
              </h2>
              {canProceedToDraftFlow ? (
                <div className={styles.documentCardList}>
                  {availableDocumentTypes.map((documentType) => {
                    const isSelected = selectedDocumentType === documentType.documentType;
                    const cardCopy = getDocumentCardCopy(documentType, answer);

                    return (
                      <article
                        key={documentType.documentType}
                        className={
                          isSelected ? styles.documentCardSelected : styles.documentCard
                        }
                      >
                        <div className={styles.documentCardCopy}>
                          <h3 className={styles.documentCardTitle}>
                            {documentType.label}
                          </h3>
                          <p className={styles.documentCardSubtitle}>
                            {documentType.subtitle}
                          </p>
                          <p className={styles.documentCardReason}>
                            {cardCopy.reason}
                          </p>
                          <p className={styles.documentCardBody}>{cardCopy.body}</p>
                        </div>
                        <Button
                          type="button"
                          fullWidth
                          className={styles.primaryCta}
                          disabled={isNavigating}
                          isLoading={isNavigating && isSelected}
                          onClick={() => proceedToDraftIntake(documentType.documentType)}
                        >
                          초안 정보 입력으로 이동
                        </Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Notification
                  variant="warning"
                  title="현재 지원 문서 초안은 없습니다"
                >
                  <p>상담 답변과 근거를 먼저 확인하세요.</p>
                  <p>
                    {answerOnlyReason}
                  </p>
                </Notification>
              )}

              <Button
                type="button"
                variant="ghost"
                fullWidth
                className={styles.resetButton}
                onClick={resetFlow}
              >
                처음으로 돌아가기
              </Button>
            </section>

            {canShowScn001FixedPresetContinuityPanel ? (
              <Scn001ContinuityPanel titleId="scn001-result-continuity-title" />
            ) : null}

            {continuityPanel ? (
              <BridgeContinuityPanel model={continuityPanel} />
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}

function BridgeContinuityPanel({ model }: { model: ContinuityPanelModel }) {
  const isStrong = model.strength === 'strong';

  return (
    <section className={styles.continuityPanel} aria-labelledby="bridge-continuity-title">
      <p className={styles.eyebrow}>연결된 검토 결과</p>
      <h2 id="bridge-continuity-title" className={styles.selectorTitle}>
        이전 계약서 검토와 이어지는 내용
      </h2>
      <p className={styles.continuityText}>
        {isStrong
          ? '이 상담은 이전 계약서 검토 내용을 맥락으로 참고합니다. 법적 근거는 상담 답변의 근거 조문에서 별도로 확인하세요.'
          : '이전 계약서 검토의 후보 조항과 이번 답변의 근거 조문이 일부 겹칩니다. 연결된 검토 결과는 법적 근거가 아니라 상담 흐름을 이해하기 위한 맥락입니다.'}
      </p>

      {model.issueLabels.length > 0 ? (
        <ContinuityList title="검토에서 확인한 쟁점" values={model.issueLabels} />
      ) : null}
      {model.lawRefs.length > 0 ? (
        <ContinuityList title="답변 인용과 겹치는 후보 조항" values={model.lawRefs} />
      ) : null}
      {model.recommendedNextActions.length > 0 ? (
        <ContinuityList
          title="이어볼 수 있는 다음 행동"
          values={model.recommendedNextActions}
        />
      ) : null}

      <p className={styles.continuityBoundary}>
        연결된 검토 결과는 보조 설명이며, 현재 답변의 인용 조문이나 근거 컨텍스트를 만들지 않습니다.
      </p>
    </section>
  );
}

function getAnswerOnlyReason({
  hasGrounding,
  isBridgeHandoffAnswer,
  supportsDraft,
  hasAvailableDocumentTypes,
  canShowScn001FrozenDraftCta,
  draftGuidance,
}: {
  hasGrounding: boolean;
  isBridgeHandoffAnswer: boolean;
  supportsDraft: boolean;
  hasAvailableDocumentTypes: boolean;
  canShowScn001FrozenDraftCta: boolean;
  draftGuidance: { description: string } | null;
}): string {
  if (!hasGrounding) {
    return '인용된 법 조문 또는 근거 컨텍스트가 확인되지 않아 초안 정보 입력으로 이동하지 않습니다.';
  }

  if (isBridgeHandoffAnswer) {
    return '계약서 검토에서 이어진 답변은 조문 확인 전용이며, 연결 맥락을 법적 근거로 승격하지 않습니다.';
  }

  if (!supportsDraft && !canShowScn001FrozenDraftCta) {
    return '고정 입력과 고정 답변이 그대로 일치하는 데모 경로에서만 사업장 변경 사유 정리서 초안을 제공합니다.';
  }

  if (!hasAvailableDocumentTypes) {
    return (
      draftGuidance?.description ??
      '이 주제는 현재 상담 답변으로만 제공합니다.'
    );
  }

  return '현재 답변은 지원 중인 문서 초안 흐름과 연결되지 않습니다.';
}

function getDocumentCardCopy(
  documentType: SupportedDraftDocumentOption,
  answer: AnswerResponse,
): { reason: string; body: string } {
  if (documentType.documentType === 'labor_office_wage_complaint') {
    return getWageComplaintCardCopy(answer);
  }

  if (documentType.documentType === 'labor_commission_unfair_dismissal_brief') {
    return getUnfairDismissalCardCopy(answer);
  }

  if (documentType.documentType === SCN001_FROZEN_DRAFT_DOCUMENT_TYPE) {
    return {
      reason:
        '고정 예시의 상담 결과와 근거가 그대로 확인되어 사업장 변경 사유를 정리할 수 있습니다.',
      body:
        '계약서 검토에서 나온 쟁점과 실제 근무 중 겪은 사정을 구분해, 제출 전 검토용 정리서로 이어갑니다.',
    };
  }

  return {
    reason: documentType.reason,
    body: documentType.body,
  };
}

function getWageComplaintCardCopy(answer: AnswerResponse): { reason: string; body: string } {
  const signalText = buildAnswerSignalText(answer);

  if (
    hasCitedArticle(answer, /근로자\s*퇴직\s*급여\s*보장법\s*제\s*9\s*조/) ||
    (hasCitedArticle(answer, /근로기준법\s*제\s*36\s*조/) &&
      /퇴사|퇴직|마지막\s*근무|14\s*일|십사\s*일|금품\s*청산/.test(signalText))
  ) {
    return {
      reason:
        '퇴직 후 임금·퇴직금 지급기한과 관련된 근거가 확인되어 진정서 작성으로 이어갈 수 있습니다.',
      body:
        '마지막 근무일, 아직 받지 못한 임금·퇴직금, 지급 요청 내역과 증거를 정리합니다.',
    };
  }

  if (hasCitedArticle(answer, /근로기준법\s*제\s*56\s*조/)) {
    return {
      reason:
        '연장·야간·휴일근로 가산수당 근거가 확인되어 미지급 수당 항목을 정리할 수 있습니다.',
      body:
        '실제 근무시간, 지급받은 금액, 근무표나 출퇴근 기록 등 확인 가능한 자료를 입력합니다.',
    };
  }

  if (hasCitedArticle(answer, /최저\s*임금법\s*제\s*6\s*조/)) {
    return {
      reason:
        '최저임금보다 낮은 임금 약정이나 차액 쟁점이 확인되어 임금 진정서로 이어갈 수 있습니다.',
      body:
        '약정 시급, 실제 지급액, 근무기간과 급여 자료를 바탕으로 확인이 필요한 차액을 정리합니다.',
    };
  }

  if (hasCitedArticle(answer, /근로기준법\s*제\s*43\s*조/)) {
    return {
      reason:
        '임금 지급 방식과 지급일에 관한 근거가 확인되어 임금 지급 문제를 정리할 수 있습니다.',
      body:
        '정해진 지급일, 실제 지급 방식, 공제나 현물 지급 여부 등 확인 가능한 사실을 입력합니다.',
    };
  }

  return {
    reason:
      '임금 미지급 또는 금품정산과 관련된 근거가 확인되어 진정서 작성으로 이어갈 수 있습니다.',
    body:
      '미지급 금액, 기간, 지급 요청 내역과 증거 자료를 중심으로 사실관계를 정리합니다.',
  };
}

function getUnfairDismissalCardCopy(
  answer: AnswerResponse,
): { reason: string; body: string } {
  const issueLabels = [
    hasCitedArticle(answer, /근로기준법\s*제\s*23\s*조/) ? '해고 제한' : null,
    hasCitedArticle(answer, /근로기준법\s*제\s*26\s*조/) ? '해고예고' : null,
    hasCitedArticle(answer, /근로기준법\s*제\s*27\s*조/) ? '서면통지' : null,
    hasCitedArticle(answer, /근로기준법\s*제\s*28\s*조/) ? '구제신청' : null,
  ].filter(Boolean);
  const issueText =
    issueLabels.length > 0 ? issueLabels.join('·') : '해고 절차와 구제신청';

  return {
    reason: `${issueText} 근거가 확인되어 부당해고 구제신청 이유서로 이어갈 수 있습니다.`,
    body:
      '해고 통보일, 통지 방식, 회사가 설명한 사유, 복직 또는 금전보상 의사를 정리합니다.',
  };
}

function hasCitedArticle(answer: AnswerResponse, pattern: RegExp): boolean {
  return answer.cited_articles.some((citation) => pattern.test(citation));
}

function buildAnswerSignalText(answer: AnswerResponse): string {
  return [
    answer.query,
    answer.answer,
    ...answer.key_points,
    ...answer.cautions,
    ...answer.cited_articles,
  ].join('\n');
}

function isAvailableDocumentType(
  documentType: DocumentType,
  availableDocumentTypes: SupportedDraftDocumentOption[],
): boolean {
  return availableDocumentTypes.some((candidate) => candidate.documentType === documentType);
}

function ContinuityList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className={styles.continuityGroup}>
      <h3 className={styles.continuityGroupTitle}>{title}</h3>
      <ul className={styles.continuityList}>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

function getBridgeContinuityPanel({
  isBridgeHandoffAnswer,
  hasGrounding,
  citedArticles,
  bridgeItems,
}: {
  isBridgeHandoffAnswer: boolean;
  hasGrounding: boolean;
  citedArticles: string[];
  bridgeItems: BridgeHandoffItem[];
}): ContinuityPanelModel | null {
  if (!isBridgeHandoffAnswer || !hasGrounding || citedArticles.length === 0) {
    return null;
  }

  const includedItems = bridgeItems.filter((item) => item.include_in_query);

  if (includedItems.length === 0) {
    return null;
  }

  const citedArticleKeys = citedArticles.map(normalizeContinuityText);
  const issueLabels = new UniqueTextList();
  const recommendedNextActions = new UniqueTextList();
  const overlappingLawRefs = new UniqueTextList();

  includedItems.forEach((item) => {
    const displayFields = getBridgeHandoffDisplayFields(item);

    displayFields.issueLabels.forEach((value) => issueLabels.add(value));
    displayFields.recommendedNextActions.forEach((value) =>
      recommendedNextActions.add(value),
    );
    displayFields.lawRefs
      .filter((lawRef) => hasLawRefOverlap(lawRef, citedArticleKeys))
      .forEach((lawRef) => overlappingLawRefs.add(lawRef));
  });

  const lawRefs = overlappingLawRefs.values();

  if (lawRefs.length === 0) {
    return null;
  }

  const hasContinuityContext =
    issueLabels.size > 0 || recommendedNextActions.size > 0;

  return {
    strength: hasContinuityContext ? 'strong' : 'weak',
    issueLabels: issueLabels.values(4),
    lawRefs: lawRefs.slice(0, 5),
    recommendedNextActions: recommendedNextActions.values(3),
  };
}

function hasLawRefOverlap(lawRef: string, citedArticleKeys: string[]): boolean {
  const lawRefKey = normalizeContinuityText(lawRef);

  if (lawRefKey.length < 4) {
    return false;
  }

  return citedArticleKeys.some(
    (citedArticleKey) =>
      citedArticleKey.length > 0 &&
      (citedArticleKey.includes(lawRefKey) || lawRefKey.includes(citedArticleKey)),
  );
}

function normalizeContinuityText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[(){}\[\]〈〉《》「」『』.,·:;'"“”‘’]/g, '')
    .toLowerCase();
}

class UniqueTextList {
  private readonly seen = new Set<string>();
  private readonly items: string[] = [];

  get size() {
    return this.items.length;
  }

  add(value: string) {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return;
    }

    const key = normalizeContinuityText(trimmed);

    if (this.seen.has(key)) {
      return;
    }

    this.seen.add(key);
    this.items.push(trimmed);
  }

  values(maxItems?: number) {
    return typeof maxItems === 'number' ? this.items.slice(0, maxItems) : [...this.items];
  }
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}
