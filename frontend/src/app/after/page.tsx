'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, EyeOff, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { Button } from '@/components/ui/Button';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { Notification } from '@/components/ui/Notification';
import { SkipLink } from '@/components/ui/SkipLink';
import { useAuth } from '@/context/AuthContext';
import { useFlow } from '@/context/FlowContext';
import { ApiError, fetchAnswer } from '@/lib/api';
import { BridgeApiError, fetchBridgeAnswer } from '@/lib/bridge-api';
import {
  buildBridgeContextQuery,
  getBridgeHandoffDisplayFields,
  type BridgeIssueDisplay,
} from '@/lib/bridge-handoff';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  buildScn001CaseHistoryRecords,
  bridgeHistoryItemToHandoffItem,
  filterVisibleScn001History,
  getBridgeRunHistoryDisplayFields,
  type Scn001CaseHistoryRecord,
} from '@/lib/scn001-history-display';
import {
  SCENARIO_PRESETS,
  getScenarioPreset,
  type ScenarioPresetId,
} from '@/lib/scenarioPresets';
import {
  deleteBeforeReviewJobHistory,
  deleteBridgeRunHistory,
  fetchBeforeReviewHistory,
  fetchBridgeRunHistory,
  Scn001HistoryApiError,
} from '@/lib/scn001-history-api';
import type { AnswerRequest } from '@/types/api';
import type { BridgeHandoffItem } from '@/types/bridge-handoff';
import type { AnswerOrigin } from '@/types/flow';
import type {
  BeforeReviewJobHistoryItem,
  BridgeRunHistoryItem,
  Scn001HistoryOverallResult,
  Scn001HistorySeverity,
} from '@/types/scn001-history';

import styles from './page.module.css';

interface AnswerErrorState {
  message: string;
  retryable: boolean;
  submission: AnswerSubmission;
}

interface AnswerSubmission {
  payload: AnswerRequest;
  selectedPresetId: ScenarioPresetId | null;
  useFixedAnswer: boolean;
  statementForState: string;
  answerOrigin: AnswerOrigin;
  primaryBridgeRunId: string | null;
}

type Scn001AfterHistoryStatus = 'idle' | 'loading' | 'success' | 'error';
type HistoryDeleteKind = 'before' | 'bridge';
type HistoryDeleteTarget = { kind: HistoryDeleteKind; id: string };
type HistoryMutationMessage = { kind: 'notice' | 'error'; message: string };

const SCN001_AFTER_HISTORY_LIMIT = 10;
const SCN001_AFTER_HISTORY_BACKEND_AUTH_MESSAGE =
  '서버 인증 확인이 완료되지 않아 기록을 불러올 수 없습니다. 인증 확인 또는 다시 로그인 후 시도해주세요.';
const AFTER_FALLBACK_NOTICE_PARAM = 'fallback';
const AFTER_FALLBACK_NOTICE_VALUE = 'missing-state';
const consultationFlowSteps = [
  '검토 결과',
  '법령 후보',
  'AI 상담',
] as const;

export default function AfterPage() {
  const router = useRouter();
  const { state, dispatch } = useFlow();
  const {
    firebaseConfigured,
    firebaseUser,
    backendUser,
    isInitializing,
    isCheckingBackend,
    isSigningIn,
    refreshBackendAuth,
  } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerSubmittingRef = useRef(false);
  const [statement, setStatement] = useState(state.user_statement);
  const [selectedPresetId, setSelectedPresetId] = useState<ScenarioPresetId | null>(
    state.selected_preset_id,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<AnswerErrorState | null>(null);
  const [historyStatus, setHistoryStatus] = useState<Scn001AfterHistoryStatus>('idle');
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(null);
  const [beforeHistory, setBeforeHistory] = useState<BeforeReviewJobHistoryItem[]>([]);
  const [bridgeHistory, setBridgeHistory] = useState<BridgeRunHistoryItem[]>([]);
  const [historyRefreshNonce, setHistoryRefreshNonce] = useState(0);
  const [historyDeleteTarget, setHistoryDeleteTarget] =
    useState<HistoryDeleteTarget | null>(null);
  const [historyMutationMessage, setHistoryMutationMessage] =
    useState<HistoryMutationMessage | null>(null);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);

  const bridgeItems = state.bridge_handoff.items;
  const hasBridgeHandoffItems = bridgeItems.length > 0;
  const includedBridgeItems = bridgeItems.filter(
    (item) => item.include_in_query,
  );
  const includedBridgeItemCount = includedBridgeItems.length;
  const hasIncludedBridgeItems = includedBridgeItemCount > 0;
  const bridgeContextQuery = useMemo(
    () => buildBridgeContextQuery(bridgeItems, statement).trim(),
    [bridgeItems, statement],
  );
  const authBusy = isInitializing || isSigningIn || isCheckingBackend;
  const isBackendAuthenticated = backendUser.logged_in;
  const trimmedStatement = statement.trim();
  const characterCount = trimmedStatement.length;
  const selectedPreset = getScenarioPreset(selectedPresetId);
  const isPresetQueryMatched =
    selectedPreset !== null && trimmedStatement === selectedPreset.query;
  const isExactPresetSubmission = selectedPreset !== null && isPresetQueryMatched;
  const isShort =
    !isExactPresetSubmission && characterCount > 0 && characterCount < 10;
  const helperTextClassName =
    !hasIncludedBridgeItems && isShort ? styles.warningText : styles.helperText;
  const canSubmit =
    !isLoading &&
    (isExactPresetSubmission ||
      (hasIncludedBridgeItems
        ? bridgeContextQuery.length > 0
        : characterCount >= 10));
  const selectedBridgeRunIds = useMemo(
    () => new Set(bridgeItems.map((item) => item.bridge_run_id)),
    [bridgeItems],
  );
  const hasRememberedBeforeReview = Boolean(state.before_review.review);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const focusTarget = textareaRef.current ?? mainRef.current;
      focusTarget?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowFallbackNotice(
      params.get(AFTER_FALLBACK_NOTICE_PARAM) === AFTER_FALLBACK_NOTICE_VALUE,
    );
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || authBusy || !firebaseUser || !isBackendAuthenticated) {
      setHistoryStatus('idle');
      setHistoryErrorMessage(null);
      setBeforeHistory([]);
      setBridgeHistory([]);
      setHistoryMutationMessage(null);
      return;
    }

    let cancelled = false;

    async function fetchCurrentHistory(forceRefresh: boolean): Promise<{
      beforeJobs: BeforeReviewJobHistoryItem[];
      bridgeRuns: BridgeRunHistoryItem[];
    }> {
      const idToken = await getCurrentScn001HistoryIdToken(forceRefresh);

      try {
        const [beforeJobs, bridgeRuns] = await Promise.all([
          fetchBeforeReviewHistory({ idToken, limit: SCN001_AFTER_HISTORY_LIMIT }),
          fetchBridgeRunHistory({ idToken, limit: SCN001_AFTER_HISTORY_LIMIT }),
        ]);

        return { beforeJobs, bridgeRuns };
      } catch (error) {
        if (
          error instanceof Scn001HistoryApiError &&
          error.status === 401 &&
          !forceRefresh
        ) {
          return fetchCurrentHistory(true);
        }

        throw error;
      }
    }

    setHistoryStatus('loading');
    setHistoryErrorMessage(null);

    void fetchCurrentHistory(false)
      .then(({ beforeJobs, bridgeRuns }) => {
        if (cancelled) {
          return;
        }

        const visibleHistory = filterVisibleScn001History({ beforeJobs, bridgeRuns });
        setBeforeHistory(visibleHistory.beforeJobs);
        setBridgeHistory(visibleHistory.bridgeRuns);
        setHistoryStatus('success');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof Scn001HistoryApiError && error.status === 401) {
          void refreshBackendAuth({ forceRefresh: true });
        }

        setBeforeHistory([]);
        setBridgeHistory([]);
        setHistoryErrorMessage(getScn001HistoryErrorMessage(error));
        setHistoryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [
    authBusy,
    firebaseConfigured,
    firebaseUser,
    historyRefreshNonce,
    isBackendAuthenticated,
    refreshBackendAuth,
  ]);

  const helperText = useMemo(() => {
    if (selectedPreset) {
      const presetTitle = getPresetDisplayTitle(selectedPreset.id);

      if (isPresetQueryMatched) {
        return `${presetTitle} 예시가 입력되었습니다. 그대로 제출하면 준비된 상담 결과를 사용합니다.`;
      }

      return hasIncludedBridgeItems
        ? `${presetTitle} 예시를 바탕으로 수정 중입니다. 체크된 검토 결과 맥락도 함께 사용합니다.`
        : `${presetTitle} 예시를 바탕으로 수정 중입니다.`;
    }

    if (hasIncludedBridgeItems) {
      return characterCount === 0
        ? '체크된 계약서 검토 결과를 바탕으로 상담을 시작할 수 있습니다. 필요한 내용을 추가로 적어도 됩니다.'
        : '체크된 계약서 검토 결과와 추가 질문을 함께 참고합니다.';
    }

    if (hasBridgeHandoffItems && characterCount === 0) {
      return '검토 결과를 포함하지 않으려면 추가 질문을 10자 이상 입력해주세요.';
    }

    if (isShort) {
      return '상황을 10자 이상 입력하면 상담을 시작할 수 있습니다.';
    }

    return '해고, 임금, 퇴직금, 사업장 변경, 육아휴직처럼 핵심 사실을 함께 적어주세요.';
  }, [
    characterCount,
    hasBridgeHandoffItems,
    hasIncludedBridgeItems,
    isPresetQueryMatched,
    isShort,
    selectedPreset,
  ]);

  function buildAnswerSubmission(): AnswerSubmission | null {
    const preset = getScenarioPreset(selectedPresetId);
    const usesExactPreset = preset !== null && trimmedStatement === preset.query;

    if (usesExactPreset) {
      return {
        payload: {
          query: trimmedStatement,
          top_k: preset.recommendedTopK,
          ef_search: 100,
        },
        selectedPresetId: preset.id,
        useFixedAnswer: true,
        statementForState: trimmedStatement,
        answerOrigin: 'regular_after',
        primaryBridgeRunId: null,
      };
    }

    if (hasBridgeHandoffItems) {
      if (hasIncludedBridgeItems && bridgeContextQuery.length === 0) {
        return null;
      }

      if (!hasIncludedBridgeItems && trimmedStatement.length < 10) {
        return null;
      }

      return {
        payload: {
          query: hasIncludedBridgeItems ? bridgeContextQuery : trimmedStatement,
          top_k: 10,
          ef_search: 100,
        },
        selectedPresetId: preset?.id ?? null,
        useFixedAnswer: false,
        statementForState:
          trimmedStatement.length > 0
            ? trimmedStatement
            : '저장된 사건 기록 기반 질문',
        answerOrigin: 'bridge_handoff',
        primaryBridgeRunId: hasIncludedBridgeItems
          ? includedBridgeItems[0]?.bridge_run_id ?? ''
          : null,
      };
    }

    if (trimmedStatement.length < 10) {
      return null;
    }

    return {
      payload: {
        query: trimmedStatement,
        top_k: preset ? preset.recommendedTopK : 5,
        ef_search: 100,
      },
      selectedPresetId: preset?.id ?? null,
      useFixedAnswer: preset !== null && trimmedStatement === preset.query,
      statementForState: trimmedStatement,
      answerOrigin: 'regular_after',
      primaryBridgeRunId: null,
    };
  }

  async function submitStatement(submission = buildAnswerSubmission()) {
    if (!submission || answerSubmittingRef.current) {
      return;
    }

    answerSubmittingRef.current = true;
    setIsLoading(true);
    setErrorState(null);
    const preset = getScenarioPreset(submission.selectedPresetId);
    dispatch({
      type: 'SET_STATEMENT',
      payload: {
        statement: submission.statementForState,
        selected_preset_id: submission.selectedPresetId,
        answer_origin: submission.answerOrigin,
      },
    });

    try {
      const answer =
        preset && submission.useFixedAnswer
          ? preset.fixedAnswer
          : await fetchAnswerForSubmission(submission);

      dispatch({ type: 'SET_ANSWER', payload: answer });
      router.push('/after/result');
    } catch (error) {
      const { message, retryable } = getAnswerSubmissionError(error);

      setErrorState({ message, retryable, submission });
    } finally {
      setIsLoading(false);
      answerSubmittingRef.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitStatement();
  }

  function handleStatementChange(value: string) {
    setStatement(value);
    setErrorState(null);
  }

  async function fetchAnswerForSubmission(submission: AnswerSubmission) {
    if (submission.primaryBridgeRunId !== null) {
      return fetchProtectedBridgeAnswer(
        submission.primaryBridgeRunId,
        submission.payload,
      );
    }

    return fetchAnswer(submission.payload);
  }

  async function fetchProtectedBridgeAnswer(
    bridgeRunId: string,
    request: AnswerRequest,
  ) {
    const idToken = await getCurrentBridgeAnswerIdToken(false);

    try {
      return await fetchBridgeAnswer({
        bridge_run_id: bridgeRunId,
        idToken,
        request,
      });
    } catch (error) {
      if (error instanceof BridgeApiError && error.status === 401) {
        const refreshedIdToken = await getCurrentBridgeAnswerIdToken(true);

        return fetchBridgeAnswer({
          bridge_run_id: bridgeRunId,
          idToken: refreshedIdToken,
          request,
        });
      }

      throw error;
    }
  }

  async function getCurrentBridgeAnswerIdToken(forceRefresh: boolean): Promise<string> {
    const idTokenRequest = getFirebaseAuth()?.currentUser?.getIdToken(forceRefresh);

    if (!idTokenRequest) {
      throw new BridgeApiError(
        401,
        '연결된 검토 결과로 답변을 만들려면 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
        false,
      );
    }

    try {
      return await idTokenRequest;
    } catch {
      throw new BridgeApiError(
        401,
        '로그인 인증을 확인하지 못했습니다. 다시 로그인한 뒤 시도해주세요.',
        false,
      );
    }
  }

  function handlePresetClick(presetId: ScenarioPresetId) {
    const preset = getScenarioPreset(presetId);

    if (!preset) {
      return;
    }

    setStatement(preset.query);
    setSelectedPresetId(preset.id);
    setErrorState(null);
    dispatch({
      type: 'SET_STATEMENT',
      payload: {
        statement: preset.query,
        selected_preset_id: preset.id,
        answer_origin: 'regular_after',
      },
    });
  }

  function handleBridgeIncludedChange(
    item: BridgeHandoffItem,
    includeInQuery: boolean,
  ) {
    dispatch({
      type: 'SET_BRIDGE_HANDOFF_ITEM_INCLUDED',
      payload: {
        bridge_run_id: item.bridge_run_id,
        include_in_query: includeInQuery,
      },
    });
    setErrorState(null);
  }

  function handleBridgeExclude(item: BridgeHandoffItem) {
    dispatch({
      type: 'REMOVE_BRIDGE_HANDOFF_ITEM',
      payload: { bridge_run_id: item.bridge_run_id },
    });
    setErrorState(null);
  }

  function handleToggleBridgeHistory(bridgeRun: BridgeRunHistoryItem) {
    if (selectedBridgeRunIds.has(bridgeRun.bridge_run_id)) {
      dispatch({
        type: 'REMOVE_BRIDGE_HANDOFF_ITEM',
        payload: { bridge_run_id: bridgeRun.bridge_run_id },
      });
      setHistoryMutationMessage({
        kind: 'notice',
        message: '검토 결과 맥락을 이번 질문에서 제외했습니다.',
      });
      setErrorState(null);
      return;
    }

    dispatch({
      type: 'ADD_BRIDGE_HANDOFF_ITEM',
      payload: bridgeHistoryItemToHandoffItem(bridgeRun),
    });
    setHistoryMutationMessage({
      kind: 'notice',
      message: '검토 결과 맥락을 이번 질문에 포함했습니다. 체크박스에서 포함 여부를 조정할 수 있습니다.',
    });
    setErrorState(null);
  }

  async function handleDeleteHistoryRecord(target: HistoryDeleteTarget) {
    if (historyDeleteTarget) {
      return;
    }

    if (!window.confirm(getHistoryDeleteConfirmMessage(target.kind))) {
      return;
    }

    if (!isBackendAuthenticated) {
      setHistoryMutationMessage({
        kind: 'error',
        message: SCN001_AFTER_HISTORY_BACKEND_AUTH_MESSAGE,
      });
      void refreshBackendAuth({ forceRefresh: true });
      return;
    }

    setHistoryDeleteTarget(target);
    setHistoryMutationMessage(null);

    try {
      await deleteHistoryRecordWithCurrentToken(target, false);
      applyLocalHistoryDeletion(target);
      setHistoryMutationMessage({
        kind: 'notice',
        message: '기록을 목록에서 숨겼습니다.',
      });
      setHistoryRefreshNonce((current) => current + 1);
    } catch (error) {
      if (error instanceof Scn001HistoryApiError && error.status === 401) {
        void refreshBackendAuth({ forceRefresh: true });
      }

      setHistoryMutationMessage({
        kind: 'error',
        message: getScn001HistoryDeleteErrorMessage(error),
      });
    } finally {
      setHistoryDeleteTarget(null);
    }
  }

  async function deleteHistoryRecordWithCurrentToken(
    target: HistoryDeleteTarget,
    forceRefresh: boolean,
  ): Promise<void> {
    const idToken = await getCurrentScn001HistoryIdToken(forceRefresh);

    try {
      if (target.kind === 'before') {
        await deleteBeforeReviewJobHistory({
          idToken,
          beforeReviewJobId: target.id,
        });
        return;
      }

      await deleteBridgeRunHistory({
        idToken,
        bridgeRunId: target.id,
      });
    } catch (error) {
      if (
        error instanceof Scn001HistoryApiError &&
        error.status === 401 &&
        !forceRefresh
      ) {
        return deleteHistoryRecordWithCurrentToken(target, true);
      }

      throw error;
    }
  }

  async function getCurrentScn001HistoryIdToken(forceRefresh: boolean): Promise<string> {
    const currentUser = getFirebaseAuth()?.currentUser ?? null;

    if (!currentUser) {
      throw new Scn001HistoryApiError(
        401,
        '로그인 후 기록을 관리할 수 있습니다. 다시 로그인한 뒤 시도해주세요.',
        false,
      );
    }

    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch {
      throw new Scn001HistoryApiError(
        401,
        '로그인 인증을 확인하지 못했습니다. 다시 로그인한 뒤 시도해주세요.',
        false,
      );
    }
  }

  function applyLocalHistoryDeletion(target: HistoryDeleteTarget) {
    if (target.kind === 'before') {
      const linkedBridgeRunIds = bridgeHistory
        .filter((bridgeRun) => bridgeRun.before_review_job_id === target.id)
        .map((bridgeRun) => bridgeRun.bridge_run_id);

      setBeforeHistory((current) =>
        current.filter((job) => job.before_review_job_id !== target.id),
      );
      setBridgeHistory((current) =>
        current.filter((bridgeRun) => bridgeRun.before_review_job_id !== target.id),
      );
      // Only remove Bridge handoff items linked to the delete target.
      linkedBridgeRunIds.forEach((bridgeRunId) => {
        dispatch({
          type: 'REMOVE_BRIDGE_HANDOFF_ITEM',
          payload: { bridge_run_id: bridgeRunId },
        });
      });
      return;
    }

    setBridgeHistory((current) =>
      current.filter((bridgeRun) => bridgeRun.bridge_run_id !== target.id),
    );
    dispatch({
      type: 'REMOVE_BRIDGE_HANDOFF_ITEM',
      payload: { bridge_run_id: target.id },
    });
  }

  function retryHistoryLoad() {
    setHistoryMutationMessage(null);
    void refreshBackendAuth({ forceRefresh: true });
    setHistoryRefreshNonce((current) => current + 1);
  }

  function goToBefore() {
    router.push('/before');
  }

  function startNewConsultation() {
    dispatch({ type: 'RESET' });
    setStatement('');
    setSelectedPresetId(null);
    setErrorState(null);
    setHistoryMutationMessage(null);
    setShowFallbackNotice(false);
    router.push('/after');
  }

  function dismissFallbackNotice() {
    setShowFallbackNotice(false);
    router.replace('/after', { scroll: false });
  }

  return (
    <>
      <SkipLink />
      <Masthead isLoading={isLoading} />
      <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.main}>
        <div className={styles.workspaceShell}>
          <WorkspaceSidebar
            activeItem="after"
            actionLabel="새 상담 시작"
            actionDescription="AI 법률 상담 질문 입력 화면으로 이동"
            actionDisabled={isLoading}
            onAction={startNewConsultation}
            ariaLabel="AI 법률 상담 메뉴"
            summary={
              <>
                <span>Current workspace</span>
                <strong>AI 법률 상담</strong>
                <p>
                  질문 입력 후 참고 조문, 주의사항, 가능한 문서 초안 흐름으로 이어집니다.
                </p>
              </>
            }
          />

          <section className={styles.consultWorkspace} aria-labelledby="after-title">
            <header className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderCopy}>
                <h1 id="after-title" className={styles.title}>
                  AI 법률 상담
                </h1>
                <p className={styles.lead}>
                  질문을 입력하면 관련 조문 후보, 핵심 포인트, 주의사항을 함께 확인합니다.
                </p>
              </div>
              <ol className={styles.flowSteps} aria-label="상담 진행 흐름">
                {consultationFlowSteps.map((step) => (
                  <li key={step}>
                    {step === '검토 결과' ? (
                      <button
                        type="button"
                        className={`${styles.flowStep} ${styles.flowStepButton}`}
                        onClick={goToBefore}
                        aria-label={
                          hasRememberedBeforeReview
                            ? '이전 계약서 검토 결과로 이동'
                            : '계약서 검토 화면으로 이동'
                        }
                      >
                        {step}
                      </button>
                    ) : (
                      <span
                        className={
                          step === 'AI 상담' ? styles.flowStepActive : styles.flowStep
                        }
                        aria-current={step === 'AI 상담' ? 'step' : undefined}
                      >
                        {step}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </header>

            <section className={styles.formSection} aria-labelledby="statement-title">
              {showFallbackNotice ? (
                <div className={styles.fallbackNotice} role="status">
                  <p>
                    이전 단계 데이터가 없어 AI 법률 상담 시작 화면으로 돌아왔습니다. 질문을
                    다시 입력하면 상담을 이어갈 수 있습니다.
                  </p>
                  <button
                    type="button"
                    className={styles.fallbackNoticeClose}
                    onClick={dismissFallbackNotice}
                  >
                    닫기
                  </button>
                </div>
              ) : null}
              <form
                className={styles.form}
                onSubmit={handleSubmit}
                aria-busy={isLoading || undefined}
              >
              <div className={styles.formHeader}>
                <div>
                  <p className={styles.eyebrow}>Question</p>
                  <h2 id="statement-title" className={styles.sectionTitle}>
                    질문 입력
                  </h2>
                </div>
                <span className={styles.counter}>{characterCount}자</span>
              </div>

              <div className={styles.presetBlock}>
                <div className={styles.presetBlockHeader}>
                  <p id="after-preset-shortcuts-title">예시 사례에서 시작</p>
                  <span>선택하면 질문 입력란에 예시가 채워집니다.</span>
                </div>
                <div
                  className={styles.presetRow}
                  aria-labelledby="after-preset-shortcuts-title"
                >
                  {SCENARIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`${styles.presetButton} ${
                        selectedPresetId === preset.id ? styles.presetButtonSelected : ''
                      }`}
                      onClick={() => handlePresetClick(preset.id)}
                      disabled={isLoading}
                      aria-pressed={selectedPresetId === preset.id}
                    >
                      <span className={styles.presetButtonLabel}>
                        {getPresetDisplayTitle(preset.id)}
                      </span>
                      <span className={styles.presetButtonMeta}>
                        {getPresetDisplayMeta(preset.id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.directInputDivider} aria-hidden="true">
                <span>또는 직접 입력</span>
              </div>

              <label className={styles.label} htmlFor="statement">
                {hasBridgeHandoffItems ? '추가 질문' : '상담 질문'}
              </label>
              <textarea
                id="statement"
                ref={textareaRef}
                className={styles.textarea}
                value={statement}
                onChange={(event) => handleStatementChange(event.target.value)}
                disabled={isLoading}
                aria-label="노동권 상황 진술"
                aria-describedby="statement-helper"
                placeholder={
                  hasBridgeHandoffItems
                    ? '추가로 묻고 싶은 내용을 입력하세요.'
                    : '예: 회사에서 갑자기 그만 나오라고 했고 서면통지는 받지 못했습니다. 마지막 임금과 퇴직금도 아직 받지 못했습니다.'
                }
              />
              <p
                id="statement-helper"
                className={helperTextClassName}
              >
                {helperText}
              </p>

              {errorState ? (
                <Notification
                  variant="error"
                  title="법 조문 검색 실패"
                  actionLabel={errorState.retryable ? '다시 시도하기' : undefined}
                  onAction={
                    errorState.retryable
                      ? () => void submitStatement(errorState.submission)
                      : undefined
                  }
                  onClose={() => setErrorState(null)}
                >
                  <p>{errorState.message}</p>
                </Notification>
              ) : null}

              <div className={styles.actionRow}>
                <Button
                  type="submit"
                  className={styles.submitButton}
                  isLoading={isLoading}
                  disabled={!canSubmit}
                >
                  상담 시작
                </Button>
              </div>
            </form>

            <div className={styles.entryDisclaimer}>
              <DisclaimerBanner>
                <p className={styles.entryDisclaimerTitle}>
                  이 서비스는 법률 판단을 확정하지 않습니다.
                </p>
                <p className={styles.entryDisclaimerBody}>
                  답변과 문서 초안은 참고용이며, 실제 제출 전 사실관계와 관할 기관
                  안내를 확인하세요.
                </p>
              </DisclaimerBanner>
            </div>

            <AfterHistorySelector
              firebaseConfigured={firebaseConfigured}
              isAuthBusy={authBusy}
              hasFirebaseSession={Boolean(firebaseUser)}
              isAuthenticated={isBackendAuthenticated}
              status={historyStatus}
              errorMessage={historyErrorMessage}
              mutationMessage={historyMutationMessage}
              beforeJobs={beforeHistory}
              bridgeRuns={bridgeHistory}
              selectedBridgeRunIds={selectedBridgeRunIds}
              deletingTarget={historyDeleteTarget}
              disabled={isLoading}
              onRetry={retryHistoryLoad}
              onSelectBridge={handleToggleBridgeHistory}
              onDelete={(target) => void handleDeleteHistoryRecord(target)}
              onGoToBefore={goToBefore}
            />
            </section>
          </section>

          <AfterConsultContextPanel
            bridgeItems={bridgeItems}
            includedBridgeItemCount={includedBridgeItemCount}
            isExactPresetSubmission={isExactPresetSubmission}
            disabled={isLoading}
            onIncludedChange={handleBridgeIncludedChange}
            onExclude={handleBridgeExclude}
          />
        </div>
      </main>
    </>
  );
}

interface AfterConsultContextPanelProps {
  bridgeItems: BridgeHandoffItem[];
  includedBridgeItemCount: number;
  isExactPresetSubmission: boolean;
  disabled: boolean;
  onIncludedChange: (item: BridgeHandoffItem, includeInQuery: boolean) => void;
  onExclude: (item: BridgeHandoffItem) => void;
}

function AfterConsultContextPanel({
  bridgeItems,
  includedBridgeItemCount,
  isExactPresetSubmission,
  disabled,
  onIncludedChange,
  onExclude,
}: AfterConsultContextPanelProps) {
  const hasBridgeHandoffItems = bridgeItems.length > 0;

  return (
    <aside className={styles.contextPanel} aria-label="상담 맥락">
      <div className={styles.contextHeader}>
        <p className={styles.contextEyebrow}>CONSULT CONTEXT</p>
        <h2>상담 맥락</h2>
      </div>

      {hasBridgeHandoffItems ? (
        <section className={styles.handoffPanel} aria-labelledby="bridge-handoff-title">
          <div className={styles.handoffHeader}>
            <div>
              <p className={styles.eyebrow}>연결된 계약서 검토</p>
              <h3 id="bridge-handoff-title" className={styles.contextSectionTitle}>
                검토 결과 맥락
              </h3>
            </div>
            <span className={styles.handoffCount}>
              {isExactPresetSubmission
                ? '예시 질문 우선'
                : `${includedBridgeItemCount}/${bridgeItems.length} 참고`}
            </span>
          </div>

          <div className={styles.handoffList}>
            {bridgeItems.map((item, index) => (
              <BridgeHandoffCard
                key={item.bridge_run_id}
                item={item}
                index={index}
                itemCount={bridgeItems.length}
                disabled={disabled}
                fixedPresetMode={isExactPresetSubmission}
                onIncludedChange={onIncludedChange}
                onExclude={onExclude}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.contextEmptyCard} aria-label="연결된 계약서 검토 없음">
          <strong>질문 중심 상담</strong>
          <p>저장된 검토 결과가 없어도 직접 입력한 질문으로 상담을 시작합니다.</p>
        </section>
      )}

      <div className={styles.contextNotice}>
        <p>
          연결된 검토 결과가 있을 때는 표시된 요약, 주요 항목, 참고 조항 후보만
          상담 맥락으로 이어갑니다.
        </p>
      </div>
    </aside>
  );
}

interface BridgeHandoffCardProps {
  item: BridgeHandoffItem;
  index: number;
  itemCount: number;
  disabled: boolean;
  fixedPresetMode: boolean;
  onIncludedChange: (item: BridgeHandoffItem, includeInQuery: boolean) => void;
  onExclude: (item: BridgeHandoffItem) => void;
}

function BridgeHandoffCard({
  item,
  index,
  itemCount,
  disabled,
  fixedPresetMode,
  onIncludedChange,
  onExclude,
}: BridgeHandoffCardProps) {
  const checkboxId = `bridge-handoff-include-${index}`;
  const titleId = `bridge-handoff-card-title-${index}`;
  const displayFields = getBridgeHandoffDisplayFields(item);
  const title =
    itemCount > 1 ? `연결된 검토 ${index + 1}` : '연결된 검토';

  return (
    <article className={styles.handoffCard} aria-labelledby={titleId}>
      <div className={styles.handoffCardTop}>
        <div className={styles.handoffCardTitleGroup}>
          <p className={styles.handoffCardEyebrow}>
            검토 결과 맥락 + 참고 조항 후보
          </p>
          <h3 id={titleId} className={styles.handoffCardTitle}>
            {title}
          </h3>
        </div>

        <button
          type="button"
          className={styles.excludeButton}
          onClick={() => onExclude(item)}
          disabled={disabled}
        >
          상담에서 제외
        </button>
      </div>

      <label className={styles.includeControl} htmlFor={checkboxId}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={item.include_in_query}
          disabled={disabled || fixedPresetMode}
          onChange={(event) => onIncludedChange(item, event.target.checked)}
        />
        <span>
          {fixedPresetMode
            ? '예시 질문 제출에서는 검토 결과를 질문에 넣지 않음'
            : '계약서 검토 결과를 함께 참고'}
        </span>
      </label>

      <p className={styles.handoffSummary}>{displayFields.userVisibleSummary}</p>

      <div className={styles.handoffMetaGrid}>
        <HandoffMetaList title="주요 위험·누락 항목" values={displayFields.issueLabels} />
        <HandoffMetaList title="참고할 법 조항 후보" values={displayFields.lawRefs} />
        <HandoffMetaList
          title="권장 다음 행동"
          values={displayFields.recommendedNextActions}
        />
      </div>

      <p className={styles.handoffNote}>
        {fixedPresetMode
          ? '예시 질문을 수정하면 체크된 검토 결과를 다시 질문에 사용할 수 있습니다.'
          : '표시된 요약과 후보만 현재 질문에 포함됩니다.'}
      </p>
    </article>
  );
}

interface HandoffMetaListProps {
  title: string;
  values: string[];
}

function HandoffMetaList({ title, values }: HandoffMetaListProps) {
  const displayValues = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (displayValues.length === 0) {
    return null;
  }

  return (
    <div className={styles.handoffMetaGroup}>
      <h4 className={styles.handoffMetaTitle}>{title}</h4>
      <ul className={styles.handoffPillList}>
        {displayValues.map((value, index) => (
          <li key={`${value}-${index}`}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

interface AfterHistorySelectorProps {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
  isAuthenticated: boolean;
  status: Scn001AfterHistoryStatus;
  errorMessage: string | null;
  mutationMessage: HistoryMutationMessage | null;
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
  selectedBridgeRunIds: Set<string>;
  deletingTarget: HistoryDeleteTarget | null;
  disabled: boolean;
  onRetry: () => void;
  onSelectBridge: (bridgeRun: BridgeRunHistoryItem) => void;
  onDelete: (target: HistoryDeleteTarget) => void;
  onGoToBefore: () => void;
}

function AfterHistorySelector({
  firebaseConfigured,
  isAuthBusy,
  hasFirebaseSession,
  isAuthenticated,
  status,
  errorMessage,
  mutationMessage,
  beforeJobs,
  bridgeRuns,
  selectedBridgeRunIds,
  deletingTarget,
  disabled,
  onRetry,
  onSelectBridge,
  onDelete,
  onGoToBefore,
}: AfterHistorySelectorProps) {
  const caseRecords = useMemo(
    () => buildScn001CaseHistoryRecords({ beforeJobs, bridgeRuns }),
    [beforeJobs, bridgeRuns],
  );
  const notice = getAfterHistoryNotice({
    firebaseConfigured,
    isAuthBusy,
    hasFirebaseSession,
    isAuthenticated,
    status,
    errorMessage,
    mutationMessage,
    beforeJobs,
    bridgeRuns,
  });
  const totalCount = caseRecords.length;

  if (!isAuthenticated) {
    return (
      <section className={styles.historyGatePanel} aria-labelledby="after-history-gate-title">
        <div>
          <p className={styles.historyEyebrow}>Saved history</p>
          <h2 id="after-history-gate-title" className={styles.historyTitle}>
            저장된 사건 기록
          </h2>
          <p className={styles.historyDescription}>
            {getAfterHistoryGateMessage({
              firebaseConfigured,
              isAuthBusy,
              hasFirebaseSession,
            })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <details className={styles.historyPanel}>
      <summary className={styles.historySummary}>
        <span className={styles.historySummaryText}>
          <span className={styles.historyEyebrow}>Saved history</span>
          <span id="after-history-title" className={styles.historyTitle}>
            저장된 사건 기록
          </span>
          <span className={styles.historyDescription}>
            사건별로 상황, 쟁점, 참고할 법 조항 후보를 이번 질문에 이어볼 수 있습니다.
          </span>
        </span>
        <span className={styles.historySummaryMeta}>
          <span className={styles.historyCount}>{totalCount}건</span>
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </summary>

      <div className={styles.historyBody}>
        {notice ? (
          <HistoryNotice
            notice={notice}
            onRetry={onRetry}
          />
        ) : null}

        {status === 'success' ? (
          <AfterHistoryCaseList
            records={caseRecords}
            selectedBridgeRunIds={selectedBridgeRunIds}
            deletingTarget={deletingTarget}
            disabled={disabled}
            onSelectBridge={onSelectBridge}
            onDelete={onDelete}
            onGoToBefore={onGoToBefore}
          />
        ) : null}
      </div>
    </details>
  );
}

function HistoryNotice({
  notice,
  onRetry,
}: {
  notice: { kind: 'notice' | 'error'; message: string; canRetry: boolean };
  onRetry: () => void;
}) {
  return (
    <div
      className={notice.kind === 'error' ? styles.historyError : styles.historyNotice}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.message}</span>
      {notice.canRetry ? (
        <button className={styles.historyRetryButton} type="button" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

function AfterHistoryCaseList({
  records,
  selectedBridgeRunIds,
  deletingTarget,
  disabled,
  onSelectBridge,
  onDelete,
  onGoToBefore,
}: {
  records: Scn001CaseHistoryRecord[];
  selectedBridgeRunIds: Set<string>;
  deletingTarget: HistoryDeleteTarget | null;
  disabled: boolean;
  onSelectBridge: (bridgeRun: BridgeRunHistoryItem) => void;
  onDelete: (target: HistoryDeleteTarget) => void;
  onGoToBefore: () => void;
}) {
  return (
    <section className={styles.historyGroupedSection} aria-label="사건 중심 저장 기록">
      <div className={styles.historyGroupedHeader}>
        <div>
          <h3 className={styles.historyColumnTitle}>사건 중심 기록</h3>
          <p className={styles.historyGroupedDescription}>
            하나의 카드에서 상황, 위험·쟁점, 참고할 법 조항 후보, 권장 다음 단계를 확인합니다.
          </p>
        </div>
        <span className={styles.historyColumnCount}>{records.length}건</span>
      </div>

      {records.length === 0 ? (
        <p className={styles.historyEmpty}>최근 표시 가능한 사건 기록이 없습니다.</p>
      ) : (
        <ol className={styles.historyGroupedList}>
          {records.map((record, index) => (
            <AfterHistoryCaseCard
              key={record.caseId}
              record={record}
              index={index}
              selectedBridgeRunIds={selectedBridgeRunIds}
              deletingTarget={deletingTarget}
              disabled={disabled}
              onSelectBridge={onSelectBridge}
              onDelete={onDelete}
              onGoToBefore={onGoToBefore}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function AfterHistoryCaseCard({
  record,
  index,
  selectedBridgeRunIds,
  deletingTarget,
  disabled,
  onSelectBridge,
  onDelete,
  onGoToBefore,
}: {
  record: Scn001CaseHistoryRecord;
  index: number;
  selectedBridgeRunIds: Set<string>;
  deletingTarget: HistoryDeleteTarget | null;
  disabled: boolean;
  onSelectBridge: (bridgeRun: BridgeRunHistoryItem) => void;
  onDelete: (target: HistoryDeleteTarget) => void;
  onGoToBefore: () => void;
}) {
  const beforeJob = record.beforeJob;
  const bridgeRuns = record.bridgeRuns;
  const caseLabel = `사건 ${index + 1}`;
  const isSelected = bridgeRuns.some((bridgeRun) =>
    selectedBridgeRunIds.has(bridgeRun.bridge_run_id),
  );
  const foldClassName = isSelected
    ? `${styles.historyCaseFold} ${styles.historyCaseFoldSelected}`
    : styles.historyCaseFold;

  return (
    <li className={styles.historyItem}>
      <details className={foldClassName}>
        <summary className={styles.historyCaseSummary}>
          <span className={styles.historyCaseSummaryText}>
            <span className={styles.historyCardEyebrow}>사건 기록</span>
            <span className={styles.historyCaseSummaryTitle}>{caseLabel}</span>
            <span className={styles.historyCompactSummary}>
              {record.compactSummary}
            </span>
          </span>
          <span className={styles.historyCaseSummaryMeta}>
            {isSelected ? (
              <span className={styles.historySelectedPill}>선택됨</span>
            ) : null}
            <span>
              {bridgeRuns.length > 0 ? `연결 후보 ${bridgeRuns.length}건` : '연결 후보 없음'}
            </span>
            <span>최근 {formatHistoryDateTime(record.updatedAt)}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </span>
        </summary>

        <div className={styles.historyCaseDetailBody}>
          <div className={styles.historyCardTop}>
            <div className={styles.historyCardTitleGroup}>
              <p className={styles.historyCardEyebrow}>사건 상세</p>
              <h4 className={styles.historyCardTitle}>상황 설명과 연결 후보</h4>
            </div>
            {beforeJob ? (
              <HistoryDeleteButton
                label={`사건 기록 숨기기: ${formatInlineText(
                  beforeJob.summary,
                  formatHistoryDateTime(beforeJob.created_at),
                )}`}
                isDeleting={isHistoryDeletePending(
                  deletingTarget,
                  'before',
                  beforeJob.before_review_job_id,
                )}
                disabled={disabled || Boolean(deletingTarget)}
                onDelete={() =>
                  onDelete({ kind: 'before', id: beforeJob.before_review_job_id })
                }
              />
            ) : null}
          </div>

          <HistorySummaryBlock
            title="상황 설명"
            body={record.caseSummary}
            fallback="요약이 없는 사건 기록입니다."
          />

          {record.sourceBeforeMissing ? (
            <p className={styles.beforeBridgeHint}>
              원 계약서 검토 요약은 현재 목록에서 불러오지 못했습니다. 표시된 연결 요약만 참고합니다.
            </p>
          ) : null}

          <dl className={styles.historyMetaGrid}>
            {beforeJob ? (
              <>
                <HistoryMeta label="검토 판정" value={formatOverallResult(beforeJob.overall_result)} />
                <HistoryMeta label="심각도" value={formatSeverity(beforeJob.overall_severity)} />
              </>
            ) : null}
            <HistoryMeta
              label="연결 후보"
              value={bridgeRuns.length > 0 ? `${bridgeRuns.length}건` : '없음'}
            />
            <HistoryMeta label="최근 갱신" value={formatHistoryDateTime(record.updatedAt)} />
          </dl>

          <section className={styles.historyCaseFlow} aria-label={`${caseLabel} 연결 흐름`}>
            {bridgeRuns.length === 0 ? (
              <div className={styles.historyBridgeEmptyState}>
                <p className={styles.historyBridgeEmpty}>아직 연결 후보 없음</p>
                <p className={styles.beforeBridgeHint}>{getCaseBridgeEmptyHint(record)}</p>
                {beforeJob?.status === 'completed' ? (
                  <button
                    className={styles.beforeBridgeLinkButton}
                    type="button"
                    onClick={onGoToBefore}
                    disabled={disabled || Boolean(deletingTarget)}
                  >
                    계약서 검토에서 연결 후보 만들기
                  </button>
                ) : null}
              </div>
            ) : (
              bridgeRuns.map((bridgeRun, bridgeIndex) => (
                <AfterHistoryBridgeCandidate
                  key={bridgeRun.bridge_run_id}
                  bridgeRun={bridgeRun}
                  index={bridgeIndex}
                  selectedBridgeRunIds={selectedBridgeRunIds}
                  deletingTarget={deletingTarget}
                  disabled={disabled}
                  onSelectBridge={onSelectBridge}
                  onDelete={onDelete}
                />
              ))
            )}
          </section>
        </div>
      </details>
    </li>
  );
}

function AfterHistoryBridgeCandidate({
  bridgeRun,
  index,
  selectedBridgeRunIds,
  deletingTarget,
  disabled,
  onSelectBridge,
  onDelete,
}: {
  bridgeRun: BridgeRunHistoryItem;
  index: number;
  selectedBridgeRunIds: Set<string>;
  deletingTarget: HistoryDeleteTarget | null;
  disabled: boolean;
  onSelectBridge: (bridgeRun: BridgeRunHistoryItem) => void;
  onDelete: (target: HistoryDeleteTarget) => void;
}) {
  const displayFields = getBridgeRunHistoryDisplayFields(bridgeRun);
  const isSelected = selectedBridgeRunIds.has(bridgeRun.bridge_run_id);

  return (
    <div
      className={
        isSelected
          ? `${styles.historyBridgeCandidate} ${styles.historyBridgeCandidateSelected}`
          : styles.historyBridgeCandidate
      }
      aria-label={isSelected ? '이번 질문에 포함된 사건 연결점' : '선택 가능한 사건 연결점'}
    >
      <div className={styles.historyCardTop}>
        <div className={styles.historyCardTitleGroup}>
          <p className={styles.historyCardEyebrow}>상담 연결점</p>
          <h5 className={styles.historyBridgeSectionTitle}>
            <span>상담 연결점 {index + 1}</span>
            {isSelected ? (
              <span
                className={`${styles.historySelectedPill} ${styles.historySelectedPillInline}`}
              >
                이번 질문에 포함됨
              </span>
            ) : null}
          </h5>
        </div>
        <HistoryDeleteButton
          label={`연결 후보 숨기기: ${formatInlineText(
            displayFields.userVisibleSummary,
            formatHistoryDateTime(bridgeRun.created_at),
          )}`}
          isDeleting={isHistoryDeletePending(
            deletingTarget,
            'bridge',
            bridgeRun.bridge_run_id,
          )}
          disabled={disabled || Boolean(deletingTarget)}
          onDelete={() => onDelete({ kind: 'bridge', id: bridgeRun.bridge_run_id })}
        />
      </div>

      <HistorySummaryBlock
        title="질문과 연결점"
        body={displayFields.connectionSummary}
        fallback="연결 요약이 없습니다."
      />

      <div className={styles.historyCaseGrid}>
        <HistoryIssueList title="확인된 쟁점" issues={displayFields.issueDetails} />
        <HistoryTagList title="참고할 법 조항 후보" values={displayFields.lawRefs} />
        <HistoryActionList values={displayFields.recommendedNextActions} />
      </div>

      <p className={styles.historyConnectionNote}>
        법적 근거 확정이 아니라 이번 상담 질문에 이어볼 참고 맥락입니다.
      </p>

      <div className={styles.historyCardFooter}>
        <span className={styles.historyDate}>표시된 요약과 후보만 포함</span>
        <button
          className={isSelected ? styles.historySelectButtonSelected : styles.historySelectButton}
          type="button"
          aria-pressed={isSelected}
          aria-label={
            isSelected ? '이미 포함됨, 클릭하면 이번 질문에서 제외' : '이번 질문에 포함'
          }
          onClick={() => onSelectBridge(bridgeRun)}
          disabled={disabled || Boolean(deletingTarget)}
        >
          {isSelected ? '이미 포함됨' : '이번 질문에 포함'}
        </button>
      </div>
    </div>
  );
}

function getCaseBridgeEmptyHint(record: Scn001CaseHistoryRecord): string {
  if (record.hasKnownBridge) {
    return '연결 후보가 있지만 현재 최근 목록에서는 불러오지 못했습니다.';
  }

  return '계약서 검토 화면에서 이 사건의 참고 법 조항 후보를 만든 뒤 상담 질문에 이어볼 수 있습니다.';
}

function HistorySummaryBlock({
  title,
  body,
  fallback,
}: {
  title: string;
  body: string | null | undefined;
  fallback: string;
}) {
  return (
    <div className={styles.historySummaryBlock}>
      <p className={styles.historySummaryLabel}>{title}</p>
      <p className={styles.historySummaryBody}>
        {formatInlineText(body, fallback)}
      </p>
    </div>
  );
}

function HistoryDeleteButton({
  label,
  isDeleting,
  disabled,
  onDelete,
}: {
  label: string;
  isDeleting: boolean;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      className={styles.historyDeleteButton}
      type="button"
      onClick={onDelete}
      disabled={disabled}
      aria-label={label}
    >
      <EyeOff size={15} aria-hidden="true" />
      {isDeleting ? '처리 중' : '목록에서 숨기기'}
    </button>
  );
}

function HistoryTagList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className={styles.historyTagGroup}>
      <p className={styles.historyTagTitle}>{title}</p>
      <ul className={styles.historyTagList}>
        {values.map((value, index) => (
          <li className={styles.historyTag} key={`${title}-${value}-${index}`}>
            {formatInlineText(value, '확인 필요')}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryIssueList({
  title,
  issues,
}: {
  title: string;
  issues: BridgeIssueDisplay[];
}) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={styles.historyTagGroup}>
      <p className={styles.historyTagTitle}>{title}</p>
      <ul className={styles.historyIssueList}>
        {issues.map((issue, index) => (
          <li className={styles.historyIssueItem} key={`${issue.label}-${index}`}>
            <strong className={styles.historyIssueLabel}>
              {formatInlineText(issue.label, '확인 필요')}
            </strong>
            <span className={styles.historyIssueDescription}>
              {formatInlineText(issue.description, '추가 확인이 필요합니다.')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryActionList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className={styles.historyActionGroup}>
      <p className={styles.historyTagTitle}>권장 다음 행동</p>
      <ul className={styles.historyActionList}>
        {values.map((value, index) => (
          <li key={`${value}-${index}`}>{formatInlineText(value, '확인 필요')}</li>
        ))}
      </ul>
    </div>
  );
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.historyMetaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getAfterHistoryNotice(input: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
  isAuthenticated: boolean;
  status: Scn001AfterHistoryStatus;
  errorMessage: string | null;
  mutationMessage: HistoryMutationMessage | null;
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
}): { kind: 'notice' | 'error'; message: string; canRetry: boolean } | null {
  if (!input.firebaseConfigured) {
    return {
      kind: 'notice',
      message: 'Firebase 설정 후 로그인하면 저장된 사건 기록을 사용할 수 있습니다.',
      canRetry: false,
    };
  }

  if (input.isAuthBusy) {
    return {
      kind: 'notice',
      message: '로그인 상태를 확인하는 중입니다.',
      canRetry: false,
    };
  }

  if (!input.isAuthenticated) {
    if (input.hasFirebaseSession) {
      return {
        kind: 'error',
        message: SCN001_AFTER_HISTORY_BACKEND_AUTH_MESSAGE,
        canRetry: true,
      };
    }

    return {
      kind: 'notice',
      message: 'Google 로그인 후 저장된 사건 기록을 선택할 수 있습니다.',
      canRetry: false,
    };
  }

  if (input.status === 'loading') {
    return {
      kind: 'notice',
      message: '기록을 불러오는 중입니다.',
      canRetry: false,
    };
  }

  if (input.status === 'error') {
    return {
      kind: 'error',
      message: input.errorMessage ?? '기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      canRetry: true,
    };
  }

  if (input.status === 'success' && input.mutationMessage) {
    return {
      kind: input.mutationMessage.kind,
      message: input.mutationMessage.message,
      canRetry: false,
    };
  }

  if (
    input.status === 'success' &&
    input.beforeJobs.length === 0 &&
    input.bridgeRuns.length === 0
  ) {
    return {
      kind: 'notice',
      message: '아직 이 계정에 저장된 사건 기록이 없습니다.',
      canRetry: true,
    };
  }

  return null;
}

function getAfterHistoryGateMessage(input: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
}): string {
  if (!input.firebaseConfigured) {
    return 'Firebase 설정 후 로그인하면 이전 기록을 불러올 수 있습니다.';
  }

  if (input.isAuthBusy) {
    return '로그인 상태를 확인하는 중입니다.';
  }

  if (input.hasFirebaseSession) {
    return SCN001_AFTER_HISTORY_BACKEND_AUTH_MESSAGE;
  }

  return '로그인하지 않아도 예시 질문과 자유 상담은 그대로 사용할 수 있습니다.';
}

function getScn001HistoryErrorMessage(error: unknown): string {
  if (error instanceof Scn001HistoryApiError) {
    if (error.status === 401) {
      return '로그인 후 기록을 볼 수 있습니다. 다시 로그인한 뒤 시도해주세요.';
    }

    if (error.status === 0 || error.status >= 500) {
      return '기록 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.';
    }

    return error.message;
  }

  return '기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function getScn001HistoryDeleteErrorMessage(error: unknown): string {
  if (error instanceof Scn001HistoryApiError && error.status === 401) {
    return '로그인 후 기록을 숨길 수 있습니다. 다시 로그인한 뒤 시도해주세요.';
  }

  return '기록 숨기기 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function getHistoryDeleteConfirmMessage(kind: HistoryDeleteKind): string {
  if (kind === 'before') {
    return '이 사건 기록을 목록에서 숨길까요? 숨긴 뒤 연결 후보도 보이지 않습니다.';
  }

  return '이 연결 후보를 목록에서 숨길까요? 숨긴 뒤 상담 연결 후보에서 보이지 않습니다.';
}

function isHistoryDeletePending(
  target: HistoryDeleteTarget | null,
  kind: HistoryDeleteKind,
  id: string,
): boolean {
  return target?.kind === kind && target.id === id;
}

function formatOverallResult(value: Scn001HistoryOverallResult | null): string {
  switch (value) {
    case 'PASS':
      return '문제 없음';
    case 'WARNING':
      return '주의';
    case 'VIOLATION':
      return '위반 가능';
    default:
      return '미정';
  }
}

function formatSeverity(value: Scn001HistorySeverity | null): string {
  switch (value) {
    case 'NONE':
      return '없음';
    case 'LOW':
      return '낮음';
    case 'MEDIUM':
      return '중간';
    case 'HIGH':
      return '높음';
    case 'CRITICAL':
      return '매우 높음';
    default:
      return '미정';
  }
}

function formatHistoryDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '확인 불가';
  }

  return date.toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatInlineText(value: string | null | undefined, fallback: string): string {
  return optionalInlineText(value) ?? fallback;
}

function optionalInlineText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim();
  return trimmed && trimmed.length > 0 ? trimmed.replace(/\s+/g, ' ') : undefined;
}

function getPresetDisplayTitle(presetId: ScenarioPresetId): string {
  switch (presetId) {
    case 'SCN-001-BRIDGE-DEMO':
      return '사업장 변경 사유 정리서 초안';
    case 'SCN-004-DEMO-FREEZE':
      return '임금체불·부당해고 상담';
  }
}

function getPresetDisplayMeta(presetId: ScenarioPresetId): string {
  switch (presetId) {
    case 'SCN-001-BRIDGE-DEMO':
      return '계약서 검토 결과를 함께 참고하는 예시';
    case 'SCN-004-DEMO-FREEZE':
      return '문서 초안까지 이어지는 예시';
  }
}

function getAnswerSubmissionError(error: unknown): {
  message: string;
  retryable: boolean;
} {
  if (error instanceof ApiError || error instanceof BridgeApiError) {
    return {
      message: error.message,
      retryable: error.retryable,
    };
  }

  return {
    message: '연결을 확인하고 다시 시도해주세요.',
    retryable: true,
  };
}
