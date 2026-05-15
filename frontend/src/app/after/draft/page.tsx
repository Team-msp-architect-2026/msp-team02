'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Scn001ContinuityPanel } from '@/components/continuity/Scn001ContinuityPanel';
import { CautionsPanel } from '@/components/draft/CautionsPanel';
import { DocumentPreview } from '@/components/draft/DocumentPreview';
import { EvidenceChecklist } from '@/components/draft/EvidenceChecklist';
import { LegalBasisPanel } from '@/components/draft/LegalBasisPanel';
import { MissingFieldsPanel } from '@/components/draft/MissingFieldsPanel';
import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { Button } from '@/components/ui/Button';
import { SkipLink } from '@/components/ui/SkipLink';
import { useFlow } from '@/context/FlowContext';
import { getDocumentTypeLabel } from '@/lib/documentDraftCatalog';
import { shouldShowScn001FixedPresetDraftContinuityPanel } from '@/lib/scn001ContinuityPanel';
import type { FlowAction } from '@/types/flow';

import styles from './page.module.css';

const COPY_DISCLAIMER =
  '\n\n---\n이 문서는 제출 전 검토용 초안입니다. 법률 대리 문서가 아닙니다.';

const draftFlowSteps = [
  'AI 법률 상담',
  '상담 결과',
  '초안 정보 입력',
  '문서 초안',
] as const;
const AFTER_FALLBACK_HREF = '/after?fallback=missing-state';

type CopyFeedbackState = 'idle' | 'success' | 'error';

export default function AfterDraftPage() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const pendingDraftCleanupActionRef = useRef<FlowAction | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedbackState>('idle');
  const { state, dispatch } = useFlow();
  const draft = state.draft_response;
  const canShowScn001FixedPresetContinuityPanel =
    shouldShowScn001FixedPresetDraftContinuityPanel({
      answer: state.answer_response,
      draft,
      selectedPresetId: state.selected_preset_id,
      userStatement: state.user_statement,
      answerOrigin: state.answer_origin,
    });

  function clearCopyFeedbackTimer() {
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }
  }

  function showTimedCopyFeedback(nextFeedback: CopyFeedbackState, timeoutMs: number) {
    clearCopyFeedbackTimer();
    setCopyFeedback(nextFeedback);
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback('idle');
      copyFeedbackTimerRef.current = null;
    }, timeoutMs);
  }

  useEffect(() => {
    if (!draft) {
      router.replace(AFTER_FALLBACK_HREF);
    }
  }, [draft, router]);

  useEffect(() => {
    if (draft) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      const frameId = window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        headingRef.current?.focus({ preventScroll: true });
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [draft]);

  useEffect(() => {
    clearCopyFeedbackTimer();
    setCopyFeedback('idle');
  }, [draft?.rendered_text]);

  useEffect(() => {
    return () => {
      clearCopyFeedbackTimer();
    };
  }, []);

  useEffect(() => {
    // Defer draft cleanup until this route unmounts so the direct URL guard
    // does not treat intentional back-navigation as missing draft state.
    return () => {
      const pendingAction = pendingDraftCleanupActionRef.current;

      if (pendingAction) {
        dispatch(pendingAction);
      }
    };
  }, [dispatch]);

  if (!draft) {
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

  const renderedText = draft.rendered_text;
  const hasRenderedText = renderedText.trim().length > 0;
  const copyStatusMessage =
    copyFeedback === 'success'
      ? '초안이 클립보드에 복사되었습니다.'
      : copyFeedback === 'error'
        ? '직접 선택하여 복사해 주세요.'
        : '';
  const copyButtonLabel = copyFeedback === 'success' ? '복사 완료' : '초안 복사하기';
  const documentTypeLabel = getDocumentTypeLabel(draft.document_type);
  const missingFieldCount = draft.missing_fields.length;
  const cautionCount = draft.cautions.length;
  const evidenceCount = draft.evidence_checklist.length;
  const citedArticleCount = draft.cited_articles.length;
  const sourceContextCount = draft.source_context_ids.length;

  async function copyDraftText() {
    if (!hasRenderedText) {
      showTimedCopyFeedback('error', 3000);
      return;
    }

    try {
      await navigator.clipboard.writeText(`${renderedText}${COPY_DISCLAIMER}`);
      showTimedCopyFeedback('success', 1500);
    } catch {
      showTimedCopyFeedback('error', 3000);
    }
  }

  function printDraft() {
    if (!hasRenderedText) {
      return;
    }

    window.print();
  }

  function resetFlow() {
    dispatch({ type: 'RESET' });
    router.push('/after');
  }

  function navigateAfterDraft(targetPath: string, cleanupAction: FlowAction) {
    pendingDraftCleanupActionRef.current = cleanupAction;
    router.push(targetPath);
  }

  function returnToIntake() {
    navigateAfterDraft('/after/intake', { type: 'CLEAR_DRAFT' });
  }

  function returnToDocumentTypeSelection() {
    if (state.answer_response) {
      navigateAfterDraft('/after/result', { type: 'CLEAR_DRAFT_AND_CASE_INTAKE' });
      return;
    }

    router.push('/after');
  }

  return (
    <>
      <SkipLink
        links={[
          { href: '#main-content', label: '본문으로 건너뛰기' },
          { href: '#document-draft', label: '문서 초안으로 건너뛰기' },
        ]}
      />
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
                <p>상담 결과와 입력 정보를 바탕으로 문서 초안을 검토합니다.</p>
              </>
            }
          />

          <section className={styles.draftWorkspace} aria-labelledby="draft-title">
            <header className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderCopy}>
                <h1 id="draft-title" ref={headingRef} tabIndex={-1} className={styles.title}>
                  문서 초안
                </h1>
                <p className={styles.lead}>
                  생성된 초안을 읽고 누락 정보, 주의사항, 증거 체크리스트, 근거 조문을 함께
                  확인합니다.
                </p>
              </div>
              <ol className={styles.flowSteps} aria-label="문서 초안 진행 흐름">
                {draftFlowSteps.map((step) => (
                  <li key={step}>
                    {step === 'AI 법률 상담' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        onClick={resetFlow}
                      >
                        {step}
                      </button>
                    ) : step === '상담 결과' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        onClick={returnToDocumentTypeSelection}
                      >
                        {step}
                      </button>
                    ) : step === '초안 정보 입력' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        onClick={returnToIntake}
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

            <section className={styles.previewPanel} aria-label="문서 초안 본문">
              <div className={styles.documentPreviewShell}>
                <DocumentPreview
                  id="document-draft"
                  title={draft.title}
                  renderedText={renderedText}
                  meta={
                    <>
                      <span className={styles.documentBadge}>{documentTypeLabel}</span>
                      <span className={styles.metaItem}>제출 대상: {draft.recipient}</span>
                    </>
                  }
                  actions={
                    <div className={styles.previewActions}>
                      <div className={styles.actionGroup}>
                        <Button
                          type="button"
                          variant="tertiary"
                          className={styles.copyButton}
                          onClick={copyDraftText}
                          disabled={!hasRenderedText}
                          aria-describedby="copy-feedback"
                        >
                          {copyButtonLabel}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className={styles.printButton}
                          onClick={printDraft}
                          disabled={!hasRenderedText}
                        >
                          인쇄하기
                        </Button>
                      </div>
                      <p
                        id="copy-feedback"
                        className={[
                          styles.copyStatus,
                          copyFeedback === 'success' ? styles.copyStatusSuccess : '',
                          copyFeedback === 'error' ? styles.copyStatusError : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {copyStatusMessage}
                      </p>
                    </div>
                  }
                  notice={
                    <p>
                      이 문서는 제출 전 검토용 초안입니다. 사실관계와 제출 기관 안내를
                      확인하세요.
                    </p>
                  }
                />
              </div>
            </section>

            <section className={styles.navigationPanel} aria-label="다음 작업">
              <div className={styles.navigationCopy}>
                <p className={styles.eyebrow}>다음 작업</p>
                <h2 className={styles.navigationTitle}>초안 검토 후 이동</h2>
              </div>
              <div className={styles.navigationActions}>
                <Button
                  type="button"
                  className={styles.submitButton}
                  onClick={returnToDocumentTypeSelection}
                >
                  상담 결과로 돌아가기
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.backButton}
                  onClick={returnToIntake}
                >
                  초안 정보 수정
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.backButton}
                  onClick={resetFlow}
                >
                  AI 상담 처음으로
                </Button>
              </div>
            </section>
          </section>

          <aside className={styles.contextPanel} aria-label="문서 초안 확인">
            <div className={styles.contextHeader}>
              <p className={styles.contextEyebrow}>DRAFT CONTEXT</p>
              <h2>문서 초안 확인</h2>
            </div>

            <section className={styles.contextCard} aria-labelledby="draft-context-document">
              <p className={styles.eyebrow}>문서 유형</p>
              <h3 id="draft-context-document" className={styles.contextCardTitle}>
                {documentTypeLabel}
              </h3>
              <p className={styles.contextText}>
                제출 전 사실관계, 누락 정보, 근거 조문을 확인해야 하는 초안입니다.
              </p>
            </section>

            <section className={styles.contextCard} aria-labelledby="draft-context-status">
              <p className={styles.eyebrow}>초안 상태</p>
              <h3 id="draft-context-status" className={styles.contextCardTitle}>
                검토 필요 항목 요약
              </h3>
              <dl className={styles.statusGrid}>
                <div>
                  <dt>누락 정보</dt>
                  <dd>{missingFieldCount}건</dd>
                </div>
                <div>
                  <dt>주의사항</dt>
                  <dd>{cautionCount}건</dd>
                </div>
                <div>
                  <dt>증거 항목</dt>
                  <dd>{evidenceCount}건</dd>
                </div>
                <div>
                  <dt>근거 조문</dt>
                  <dd>{citedArticleCount}개</dd>
                </div>
              </dl>
              <p className={styles.contextText}>
                출처 컨텍스트 {sourceContextCount}개를 함께 확인합니다.
              </p>
            </section>

            <MissingFieldsPanel missingFields={draft.missing_fields} />
            <CautionsPanel cautions={draft.cautions} />

            <details className={styles.contextDisclosure} open={evidenceCount <= 4}>
              <summary>증거 체크리스트 {evidenceCount}건</summary>
              <div className={styles.disclosureBody}>
                <EvidenceChecklist items={draft.evidence_checklist} />
              </div>
            </details>

            <details className={styles.contextDisclosure} open={citedArticleCount <= 4}>
              <summary>근거와 출처 확인</summary>
              <div className={styles.disclosureBody}>
                <LegalBasisPanel
                  citedArticles={draft.cited_articles}
                  legalBasis={draft.legal_basis}
                  sourceContextIds={draft.source_context_ids}
                  missingLegalBasis={draft.missing_legal_basis}
                />
              </div>
            </details>

            {canShowScn001FixedPresetContinuityPanel ? (
              <Scn001ContinuityPanel titleId="scn001-draft-continuity-title" />
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}
