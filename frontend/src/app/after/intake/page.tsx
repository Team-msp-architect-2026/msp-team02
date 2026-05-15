'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import {
  EvidenceSection,
  ensureEvidenceRowIds,
  ensureTimelineRowIds,
  type EvidenceItemRow,
  type TimelineRow,
} from '@/components/intake/EvidenceSection';
import { UnfairDismissalForm } from '@/components/intake/UnfairDismissalForm';
import { WageComplaintForm } from '@/components/intake/WageComplaintForm';
import { WorkplaceChangeReasonForm } from '@/components/intake/WorkplaceChangeReasonForm';
import { Button } from '@/components/ui/Button';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { Notification } from '@/components/ui/Notification';
import { SkipLink } from '@/components/ui/SkipLink';
import { useFlow } from '@/context/FlowContext';
import {
  ApiError,
  buildCaseIntake,
  buildLegalBasis,
  fetchDraft,
  hasDraftGrounding,
} from '@/lib/api';
import {
  classifyDocumentDraftSupport,
  getDocumentTypeLabel,
} from '@/lib/documentDraftCatalog';
import {
  SCN001_FROZEN_DRAFT_DOCUMENT_TYPE,
  SCN001_FROZEN_DRAFT_PRESET_ID,
  buildScn001CaseIntakeSnapshot,
  buildScn001FrozenDraftFromIntake,
  getScenarioPresetDraft,
  isScn001FrozenDraftPath,
} from '@/lib/scenarioPresetDrafts';
import { getScenarioPreset } from '@/lib/scenarioPresets';
import type { CaseIntakeFormValues, DocumentType } from '@/types/api';

import styles from './page.module.css';

const intakeFlowSteps = [
  'AI 법률 상담',
  '상담 결과',
  '초안 정보 입력',
  '문서 초안',
] as const;
const AFTER_FALLBACK_HREF = '/after?fallback=missing-state';

interface DraftErrorState {
  message: string;
  retryable: boolean;
}

export default function AfterIntakePage() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const draftSubmittingRef = useRef(false);
  const { state, dispatch } = useFlow();
  const answer = state.answer_response;
  const selectedDocumentType = state.selected_document_type;
  const activePreset = getScenarioPreset(state.selected_preset_id);
  const isBridgeHandoffAnswer = state.answer_origin === 'bridge_handoff';
  const supportsDraft = !isBridgeHandoffAnswer && (activePreset?.supportsDraft ?? true);
  const hasGrounding = answer ? hasDraftGrounding(answer) : false;
  const draftClassification =
    answer && supportsDraft ? classifyDocumentDraftSupport(answer) : null;
  const selectedDocumentTypeIsEligible =
    supportsDraft && selectedDocumentType !== null && draftClassification !== null
      ? draftClassification.documentTypes[selectedDocumentType]
      : false;
  const canUseScn004DraftFlow =
    supportsDraft && hasGrounding && selectedDocumentTypeIsEligible;
  const canUseScn001FrozenDraftPath = isScn001FrozenDraftPath({
    answer,
    selectedPresetId: state.selected_preset_id,
    userStatement: state.user_statement,
    answerOrigin: state.answer_origin,
    selectedDocumentType,
  });
  const scn001FrozenDraft = canUseScn001FrozenDraftPath
    ? getScenarioPresetDraft(SCN001_FROZEN_DRAFT_PRESET_ID)
    : null;
  const canUseScn001FrozenDraftFlow = scn001FrozenDraft !== null;
  const canUseDraftFlow = canUseScn004DraftFlow || canUseScn001FrozenDraftFlow;
  const [formValues, setFormValues] = useState<CaseIntakeFormValues>(
    () => state.case_intake_form ?? {},
  );
  const [incidentTimeline, setIncidentTimeline] = useState<TimelineRow[]>(() =>
    ensureTimelineRowIds(
      state.case_intake?.incident_timeline.length
        ? state.case_intake.incident_timeline
        : [],
    ),
  );
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItemRow[]>(() =>
    ensureEvidenceRowIds(
      state.case_intake?.evidence_items.length ? state.case_intake.evidence_items : [],
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<DraftErrorState | null>(null);

  useEffect(() => {
    if (!answer) {
      router.replace(AFTER_FALLBACK_HREF);
      return;
    }

    if (!hasGrounding || !selectedDocumentType || !canUseDraftFlow) {
      router.replace('/after/result');
      return;
    }
  }, [
    answer,
    canUseDraftFlow,
    hasGrounding,
    router,
    selectedDocumentType,
  ]);

  useEffect(() => {
    if (answer && selectedDocumentType && canUseDraftFlow) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      const frameId = window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        headingRef.current?.focus({ preventScroll: true });
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [answer, canUseDraftFlow, selectedDocumentType]);

  if (!answer || !selectedDocumentType || !canUseDraftFlow) {
    return (
      <>
        <SkipLink />
        <Masthead />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <p className={styles.redirectMessage}>
            {answer
              ? '이전 단계로 이동합니다.'
              : '이전 단계 데이터가 없어 상담 시작 화면으로 이동합니다.'}
          </p>
        </main>
      </>
    );
  }

  const documentTypeLabel = getDocumentTypeLabel(selectedDocumentType);
  const pageTitle = '문서 초안 정보 입력';
  const pageLead =
    '상담 결과에서 선택한 문서 초안에 반영할 사실관계를 확인합니다. 빈 항목은 제출을 막지 않고 초안 결과에서 확인 필요 항목으로 표시됩니다.';
  const formTitle = canUseScn001FrozenDraftFlow
    ? '사업장 변경 사유 초안에 반영할 정보'
    : '초안에 반영할 사실관계';
  const statementSummary = truncateText(state.user_statement || answer.query, 96);
  const answerSummary = truncateText(
    answer.answer.trim() || '상담 답변 본문을 생성하지 못했습니다.',
    140,
  );
  const citationPreview = answer.cited_articles.slice(0, 4);
  const cautionPreview = answer.cautions.slice(0, 3);
  const preparationItems = getDraftPreparationItems(
    selectedDocumentType,
    canUseScn001FrozenDraftFlow,
  );

  async function submitDraft() {
    if (!answer || !selectedDocumentType || draftSubmittingRef.current) {
      return;
    }

    if (canUseScn001FrozenDraftFlow) {
      submitScn001FrozenDraft();
      return;
    }

    if (!hasDraftGrounding(answer)) {
      setErrorState({
        message:
          '인용된 법 조문 또는 근거 컨텍스트가 확인되지 않아 문서 초안을 만들 수 없습니다.',
        retryable: false,
      });
      return;
    }

    if (!supportsDraft) {
      setErrorState({
        message: isBridgeHandoffAnswer
          ? '이 답변은 계약서 검토 결과에서 이어진 조문 확인용이라 문서 초안을 만들 수 없습니다.'
          : '이 경로에서는 문서 초안을 만들 수 없습니다. 고정 초안은 결과 화면에서 고정 입력과 고정 답변이 그대로 일치할 때만 열 수 있습니다.',
        retryable: false,
      });
      return;
    }

    const selectedEligibility = classifyDocumentDraftSupport(answer);

    if (!selectedEligibility.documentTypes[selectedDocumentType]) {
      setErrorState({
        message:
          '선택한 문서 타입을 뒷받침하는 근거가 없어 문서 초안을 만들 수 없습니다.',
        retryable: false,
      });
      return;
    }

    draftSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorState(null);

    const legalBasis = buildLegalBasis(answer);
    const caseIntake = buildCaseIntake({
      selected_document_type: selectedDocumentType,
      form_values: formValues,
      evidence_items: evidenceItems,
      incident_timeline: incidentTimeline,
    });

    dispatch({ type: 'SET_LEGAL_BASIS', payload: legalBasis });
    dispatch({ type: 'SET_CASE_INTAKE_FORM', payload: formValues });
    dispatch({ type: 'SET_CASE_INTAKE', payload: caseIntake });

    try {
      const draft = await fetchDraft({
        case_intake: caseIntake,
        legal_basis: legalBasis,
      });

      dispatch({ type: 'SET_DRAFT', payload: draft });
      router.push('/after/draft');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : '연결을 확인하고 다시 시도해주세요.';
      const retryable = error instanceof ApiError ? error.retryable : true;

      setErrorState({ message, retryable });
    } finally {
      setIsSubmitting(false);
      draftSubmittingRef.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitDraft();
  }

  function submitScn001FrozenDraft() {
    if (!answer || !scn001FrozenDraft || draftSubmittingRef.current) {
      return;
    }

    draftSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorState(null);

    const legalBasis = buildLegalBasis(answer);
    const caseIntake = buildScn001CaseIntakeSnapshot({
      baseDraft: scn001FrozenDraft,
      selectedDocumentType: SCN001_FROZEN_DRAFT_DOCUMENT_TYPE,
      formValues,
      evidenceItems,
      incidentTimeline,
    });
    const draft = buildScn001FrozenDraftFromIntake({
      baseDraft: scn001FrozenDraft,
      formValues,
      evidenceItems,
      incidentTimeline,
      legalBasis,
    });

    dispatch({ type: 'SET_LEGAL_BASIS', payload: legalBasis });
    dispatch({ type: 'SET_CASE_INTAKE_FORM', payload: formValues });
    dispatch({ type: 'SET_CASE_INTAKE', payload: caseIntake });
    dispatch({ type: 'SET_DRAFT', payload: draft });
    router.push('/after/draft');

    setIsSubmitting(false);
    draftSubmittingRef.current = false;
  }

  function handleFormValuesChange(values: CaseIntakeFormValues) {
    setFormValues(values);
    setErrorState(null);
  }

  function handleEvidenceItemsChange(items: EvidenceItemRow[]) {
    setEvidenceItems(ensureEvidenceRowIds(items));
    setErrorState(null);
  }

  function handleIncidentTimelineChange(items: TimelineRow[]) {
    setIncidentTimeline(ensureTimelineRowIds(items));
    setErrorState(null);
  }

  function resetFlow() {
    dispatch({ type: 'RESET' });
    router.push('/after');
  }

  function goBackToResult() {
    router.push('/after/result');
  }

  return (
    <>
      <SkipLink />
      <Masthead isLoading={isSubmitting} />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.workspaceShell}>
          <WorkspaceSidebar
            activeItem="after"
            actionLabel="새 상담 시작"
            actionDescription="AI 법률 상담 질문 입력 화면으로 이동"
            actionDisabled={isSubmitting}
            onAction={resetFlow}
            ariaLabel="AI 법률 상담 메뉴"
            summary={
              <>
                <span>Current workspace</span>
                <strong>AI 법률 상담</strong>
                <p>상담 결과에서 문서 초안 정보 입력으로 이어갑니다.</p>
              </>
            }
          />

          <section className={styles.intakeWorkspace} aria-labelledby="intake-title">
            <header className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderCopy}>
                <h1
                  id="intake-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className={styles.title}
                >
                  {pageTitle}
                </h1>
                <p className={styles.lead}>{pageLead}</p>
              </div>
              <ol className={styles.flowSteps} aria-label="문서 초안 진행 흐름">
                {intakeFlowSteps.map((step) => (
                  <li key={step}>
                    {step === 'AI 법률 상담' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        disabled={isSubmitting}
                        onClick={resetFlow}
                      >
                        {step}
                      </button>
                    ) : step === '상담 결과' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        disabled={isSubmitting}
                        onClick={goBackToResult}
                      >
                        {step}
                      </button>
                    ) : step === '초안 정보 입력' ? (
                      <span className={styles.flowStepActive} aria-current="step">
                        {step}
                      </span>
                    ) : (
                      <span className={styles.flowStep}>{step}</span>
                    )}
                  </li>
                ))}
              </ol>
            </header>

            <form
              className={styles.form}
              onSubmit={handleSubmit}
              aria-busy={isSubmitting || undefined}
            >
              <div className={styles.formIntro}>
                <p className={styles.eyebrow}>초안 정보</p>
                <h2 className={styles.sectionTitle}>{formTitle}</h2>
                <div className={styles.badgeRow}>
                  <span className={styles.documentBadge}>{documentTypeLabel}</span>
                </div>
                <p className={styles.helperText}>
                  필요한 항목만 입력해도 됩니다. 확인이 필요한 정보는 초안에서 누락 항목으로
                  따로 정리됩니다.
                </p>
              </div>
              <div className={isSubmitting ? styles.formContentDisabled : styles.formContent}>
            {canUseScn001FrozenDraftFlow ? (
              <>
                <WorkplaceChangeReasonForm
                  values={formValues}
                  disabled={isSubmitting}
                  onChange={handleFormValuesChange}
                />

                <EvidenceSection
                  evidenceItems={evidenceItems}
                  incidentTimeline={incidentTimeline}
                  disabled={isSubmitting}
                  onEvidenceItemsChange={handleEvidenceItemsChange}
                  onIncidentTimelineChange={handleIncidentTimelineChange}
                />
              </>
            ) : (
              <>
                {selectedDocumentType === 'labor_office_wage_complaint' ? (
                  <WageComplaintForm
                    values={formValues}
                    disabled={isSubmitting}
                    onChange={handleFormValuesChange}
                  />
                ) : (
                  <UnfairDismissalForm
                    values={formValues}
                    disabled={isSubmitting}
                    onChange={handleFormValuesChange}
                  />
                )}

                <EvidenceSection
                  evidenceItems={evidenceItems}
                  incidentTimeline={incidentTimeline}
                  disabled={isSubmitting}
                  onEvidenceItemsChange={handleEvidenceItemsChange}
                  onIncidentTimelineChange={handleIncidentTimelineChange}
                />
              </>
            )}

            <DisclaimerBanner>
              {canUseScn001FrozenDraftFlow ? (
                <p>
                  이 고정 데모 초안은 제출 전 검토용입니다. 연결된 계약서 검토 내용은 사건
                  경위 설명으로만 사용하고 법적 근거로 승격하지 않습니다.
                </p>
              ) : (
                <p>
                  이 문서 초안은 제출 전 검토용입니다. 입력하지 않은 사실은 확정하지 않고
                  확인 필요 항목으로 남깁니다.
                </p>
              )}
            </DisclaimerBanner>
              </div>

              <div className={styles.stickyBar}>
                <div className={styles.stickyInner}>
                  <div className={styles.stickyMessage}>
                    {errorState ? (
                      <Notification
                        variant="error"
                        title="문서 초안 생성 실패"
                        actionLabel={errorState.retryable ? '다시 시도하기' : undefined}
                        onAction={errorState.retryable ? () => void submitDraft() : undefined}
                        onClose={() => setErrorState(null)}
                      >
                        <p>{errorState.message}</p>
                      </Notification>
                    ) : null}
                  </div>
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      variant="ghost"
                      className={styles.backButton}
                      disabled={isSubmitting}
                      onClick={goBackToResult}
                    >
                      상담 결과로 돌아가기
                    </Button>
                    <Button
                      type="submit"
                      className={styles.submitButton}
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {canUseScn001FrozenDraftFlow
                        ? '사업장 변경 사유 정리서 초안 생성하기 →'
                        : '문서 초안 생성하기 →'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </section>

          <aside className={styles.contextPanel} aria-label="초안 정보 확인">
            <div className={styles.contextHeader}>
              <p className={styles.contextEyebrow}>DRAFT CONTEXT</p>
              <h2>초안 정보 확인</h2>
            </div>

            <section className={styles.contextCard} aria-labelledby="intake-context-summary">
              <p className={styles.eyebrow}>상담 결과 요약</p>
              <h3 id="intake-context-summary" className={styles.contextCardTitle}>
                초안에 이어지는 상담 내용
              </h3>
              <p className={styles.contextText}>{answerSummary}</p>
              <div className={styles.questionSummary}>
                <span>질문 요약</span>
                <p>{statementSummary}</p>
              </div>
            </section>

            <section className={styles.contextCard} aria-labelledby="intake-document-type">
              <p className={styles.eyebrow}>선택 문서 유형</p>
              <h3 id="intake-document-type" className={styles.contextCardTitle}>
                {documentTypeLabel}
              </h3>
              <p className={styles.contextText}>
                입력한 사실관계와 상담 결과의 근거 조문을 바탕으로 제출 전 검토용 초안을
                만듭니다.
              </p>
            </section>

            <section className={styles.contextCard} aria-labelledby="intake-legal-basis">
              <p className={styles.eyebrow}>근거 조문</p>
              <h3 id="intake-legal-basis" className={styles.contextCardTitle}>
                상담 결과에서 확인된 법령 근거
              </h3>
              {citationPreview.length > 0 ? (
                <ul className={styles.contextPillList} aria-label="근거 조문 요약">
                  {citationPreview.map((article) => (
                    <li key={article}>{article}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.contextText}>표시할 근거 조문이 없습니다.</p>
              )}
            </section>

            {cautionPreview.length > 0 ? (
              <details className={styles.contextDisclosure}>
                <summary>주의사항 {cautionPreview.length}건</summary>
                <ul className={styles.contextList}>
                  {cautionPreview.map((caution) => (
                    <li key={caution}>{caution}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <section className={styles.contextNotice} aria-labelledby="intake-preparation">
              <p className={styles.eyebrow}>입력 안내</p>
              <h3 id="intake-preparation" className={styles.contextCardTitle}>
                초안 작성 전에 확인할 정보
              </h3>
              <ul className={styles.contextList}>
                {preparationItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function getDraftPreparationItems(
  documentType: DocumentType,
  isScn001FrozenDraftFlow: boolean,
): string[] {
  if (isScn001FrozenDraftFlow) {
    return [
      '숙소비 공제, 기숙사 환경, 차별·폭언 등 사업장 변경 사유를 구분해 적어주세요.',
      '날짜와 증거가 불확실하면 비워두고 초안 결과의 확인 필요 항목에서 다시 점검하세요.',
      '계약서 검토 내용은 사건 경위 설명으로만 참고합니다.',
    ];
  }

  if (documentType === 'labor_office_wage_complaint') {
    return [
      '근무 기간, 퇴사일, 지급일, 미지급 임금·퇴직금 금액을 확인해 주세요.',
      '임금명세서, 계좌 입금 내역, 근로계약서 등 증거가 있으면 함께 적어주세요.',
      '불확실한 금액은 단정하지 말고 초안 결과에서 확인 필요 항목으로 남겨두세요.',
    ];
  }

  return [
    '해고 통보일, 마지막 근무일, 서면통지 여부, 해고예고 여부를 확인해 주세요.',
    '해고 통보 메시지, 근로계약서, 출근 기록 등 증거가 있으면 함께 적어주세요.',
    '불확실한 날짜나 사유는 단정하지 말고 초안 결과에서 확인 필요 항목으로 남겨두세요.',
  ];
}
