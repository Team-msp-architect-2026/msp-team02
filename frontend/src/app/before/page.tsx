'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CircleDot,
  Plus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AccessibilityPanel } from '@/components/before/AccessibilityPanel';
import { LoadingPanel } from '@/components/before/LoadingPanel';
import {
  buildBeforeReviewDisplayIssues,
  ResultPanel,
  type BeforeReviewDisplayIssue,
  type BeforeReviewIssueTone,
} from '@/components/before/ResultPanel';
import { UploadPanel } from '@/components/before/UploadPanel';
import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar, type WorkspaceNavItem } from '@/components/layout/WorkspaceSidebar';
import { Button } from '@/components/ui/Button';
import { Notification } from '@/components/ui/Notification';
import { SkipLink } from '@/components/ui/SkipLink';
import { useAuth } from '@/context/AuthContext';
import { useFlow } from '@/context/FlowContext';
import {
  BeforeApiError,
  fetchBeforeAccessibility,
  getBeforeReviewJob,
  loadBeforeMockAccessibility,
  loadBeforeMockReview,
  startBeforeReviewJob,
} from '@/lib/before-api';
import { BridgeApiError, bridgeRunToHandoffItem, createBridgeRun } from '@/lib/bridge-api';
import { getFirebaseAuth } from '@/lib/firebase';
import type {
  BeforeAccessibilityRecommendation,
  BeforeDisabilityType,
  BeforeMockScenario,
  BeforeReviewJob,
  BeforeReviewResult,
  BeforeScreenState,
} from '@/types/before';

import styles from './page.module.css';

const mockLoadingSteps = [
  { key: 'file_validation', label: '파일 확인', message: '업로드 형식과 페이지 구성을 확인합니다.' },
  { key: 'ocr', label: 'OCR 추출', message: '계약서 본문을 구조화합니다.' },
  { key: 'section_compare', label: '계약 항목 비교', message: '표준 항목과 실제 조항을 대조합니다.' },
  { key: 'rule_validation', label: '수치 검증', message: '임금, 시간, 휴게 조건을 검토합니다.' },
  { key: 'explanation', label: '설명 생성', message: '사용자용 설명과 결과 요약을 만듭니다.' },
] as const;

type BridgeActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ResultContextSummary {
  riskCount: number;
  needsReviewCount: number;
  passCount: number;
}

interface ResultContextIssue {
  title: string;
  description: string;
  lawRef: string;
  nextAction: string;
  status: BeforeReviewResult['overall_result'];
  tag: string | null;
  tone: BeforeReviewIssueTone;
}

const BEFORE_ANALYZE_LOGIN_REQUIRED_MESSAGE =
  'Before 계약서 분석은 Google 로그인이 필요합니다. 로그인 후 다시 시도해주세요.';
const BEFORE_ANALYZE_AUTH_CHECKING_MESSAGE =
  '로그인 상태를 확인하는 중입니다. 잠시 후 다시 시도해주세요.';
const BEFORE_ANALYZE_FIREBASE_CONFIG_MESSAGE =
  'Before 계약서 분석에는 Firebase 설정이 필요합니다. Firebase public web config 설정 후 다시 시도해주세요.';
const BEFORE_ANALYZE_BACKEND_AUTH_MESSAGE =
  '서버 인증 확인이 완료되지 않았습니다. 인증 확인 또는 다시 로그인 후 분석을 시작해주세요.';
const BRIDGE_BACKEND_AUTH_MESSAGE =
  '서버 인증 확인이 완료되지 않아 AI 법률 상담 연결을 만들 수 없습니다. 인증 확인 또는 다시 로그인 후 시도해주세요.';
const BEFORE_JOB_GENERAL_FAILURE_MESSAGE =
  '계약서 분석 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
const BEFORE_JOB_OCR_QUOTA_FAILURE_MESSAGE =
  'OCR 요청 한도가 일시적으로 초과되었습니다. 잠시 후 다시 시도해주세요.';
const BEFORE_JOB_OCR_TIMEOUT_FAILURE_MESSAGE =
  'OCR 응답 시간이 초과되어 분석을 중단했습니다. 잠시 후 다시 시도해주세요.';
const OCR_QUOTA_ERROR_PATTERNS = [/429/i, /resource exhausted/i, /quota/i, /rate limit/i];
const OCR_TIMEOUT_ERROR_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /hard wall-clock timeout/i,
  /응답 시간이 초과/i,
  /시간이 초과/i,
];
const ACCESSIBILITY_EXTENSION_SECTION_ID = 'before-accessibility-extension-section';
const ACCESSIBILITY_EXTENSION_PANEL_ID = 'before-accessibility-extension-panel';
const DEFAULT_ACCESSIBILITY_EXTENSION_TYPE: BeforeDisabilityType = 'visual';
const BEFORE_MOCK_SCENARIOS: BeforeMockScenario[] = ['sen0', 'sen1', 'sen2'];

function parseBeforeMockScenario(value: string | null): BeforeMockScenario | null {
  if (value && BEFORE_MOCK_SCENARIOS.includes(value as BeforeMockScenario)) {
    return value as BeforeMockScenario;
  }

  return null;
}

function createMockJob(): BeforeReviewJob {
  const now = new Date().toISOString();

  return {
    job_id: 'before-mock-job',
    status: 'running',
    created_at: now,
    updated_at: now,
    steps: mockLoadingSteps.map((step, index) => ({
      key: step.key,
      label: step.label,
      order: index + 1,
      status: index === 0 ? 'running' : 'pending',
      message: index === 0 ? step.message : null,
    })),
    error: null,
  };
}

function advanceMockJob(job: BeforeReviewJob): BeforeReviewJob {
  const currentIndex = job.steps.findIndex((step) => step.status === 'running');

  if (currentIndex === -1) {
    return job;
  }

  return {
    ...job,
    updated_at: new Date().toISOString(),
    steps: job.steps.map((step, index) => {
      if (index < currentIndex) {
        return { ...step, status: 'completed', message: step.message ?? null };
      }

      if (index === currentIndex) {
        return { ...step, status: 'completed', message: step.message ?? null };
      }

      if (index === currentIndex + 1) {
        return { ...step, status: 'running', message: mockLoadingSteps[index].message };
      }

      return step;
    }),
  };
}

export default function BeforePage() {
  const router = useRouter();
  const { state, dispatch } = useFlow();
  const {
    firebaseConfigured,
    firebaseUser,
    backendUser,
    isInitializing,
    isSigningIn,
    isCheckingBackend,
    errorMessage: authErrorMessage,
    signInWithGoogle,
    refreshBackendAuth,
  } = useAuth();
  const loadingRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const accessibilitySectionRef = useRef<HTMLElement | null>(null);
  const accessibilityDisclosureButtonRef = useRef<HTMLButtonElement | null>(null);
  const accessibilityRef = useRef<HTMLDivElement | null>(null);
  const hasHandledUrlMockScenarioRef = useRef(false);
  const rememberedBeforeReview = state.before_review.review;
  const rememberedBeforeReviewJobId = state.before_review.completed_review_job_id;
  const [screenState, setScreenState] = useState<BeforeScreenState>(() =>
    rememberedBeforeReview ? 'result' : 'home',
  );
  const [isUploadVisible, setIsUploadVisible] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loadingJob, setLoadingJob] = useState<BeforeReviewJob | null>(null);
  const [completedReviewJobId, setCompletedReviewJobId] = useState<string | null>(
    rememberedBeforeReviewJobId,
  );
  const [review, setReview] = useState<BeforeReviewResult | null>(rememberedBeforeReview);
  const [selectedDisability, setSelectedDisability] = useState<BeforeDisabilityType | null>(null);
  const [accessibility, setAccessibility] = useState<BeforeAccessibilityRecommendation | null>(null);
  const [accessibilityError, setAccessibilityError] = useState<string | null>(null);
  const [isAccessibilityPanelOpen, setIsAccessibilityPanelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccessibilityLoading, setIsAccessibilityLoading] = useState(false);
  const [isBridgeSubmitting, setIsBridgeSubmitting] = useState(false);
  const [bridgeActionStatus, setBridgeActionStatus] = useState<BridgeActionStatus>('idle');
  const [bridgeActionMessage, setBridgeActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [beforeAnalyzeAuthMessage, setBeforeAnalyzeAuthMessage] = useState<string | null>(null);
  const [shouldScrollToLoading, setShouldScrollToLoading] = useState(false);
  const [selectedResultContextIssueTag, setSelectedResultContextIssueTag] = useState<
    string | null
  >(null);
  const authBusy = isInitializing || isSigningIn || isCheckingBackend;
  const hasBridgeJobId = Boolean(completedReviewJobId);
  const isBackendAuthenticated = backendUser.logged_in;
  const isBridgeAuthenticated = isBackendAuthenticated;
  const shouldShowWorkspaceLanding = screenState === 'home' && !isUploadVisible;
  const shouldShowUploadPanel = screenState === 'home' && isUploadVisible;
  const shouldShowSidebarDocumentList = Boolean(
    (screenState === 'result' && review) || shouldShowUploadPanel,
  );
  const shouldShowBeforeAuthSignInAction =
    (beforeAnalyzeAuthMessage === BEFORE_ANALYZE_LOGIN_REQUIRED_MESSAGE ||
      beforeAnalyzeAuthMessage === BEFORE_ANALYZE_BACKEND_AUTH_MESSAGE) &&
    firebaseConfigured &&
    !authBusy;

  const resultContextSummary = useMemo<ResultContextSummary | null>(() => {
    if (!review) {
      return null;
    }

    const displayIssues = buildBeforeReviewDisplayIssues(review);

    return {
      riskCount: displayIssues.filter((item) => item.status === 'VIOLATION').length,
      needsReviewCount: displayIssues.filter((item) => item.status === 'WARNING').length,
      passCount: Object.values(review.rule_check ?? {}).filter((item) => item.status === 'PASS')
        .length,
    };
  }, [review]);

  const resultContextIssues = useMemo<ResultContextIssue[]>(() => {
    if (!review) {
      return [];
    }

    return buildResultContextIssues(review);
  }, [review]);

  const resultContextSelectableIssues = useMemo(
    () =>
      resultContextIssues.filter(
        (issue): issue is ResultContextIssue & { tag: string } => Boolean(issue.tag),
      ),
    [resultContextIssues],
  );

  const selectedResultContextIssue = useMemo(() => {
    if (!resultContextSelectableIssues.length) {
      return null;
    }

    return (
      resultContextSelectableIssues.find((issue) => issue.tag === selectedResultContextIssueTag) ??
      resultContextSelectableIssues[0]
    );
  }, [resultContextSelectableIssues, selectedResultContextIssueTag]);

  const shouldShowAccessibilityExtension = useMemo(() => {
    if (!review) {
      return false;
    }

    return (
      isAccessibilityRelevantReview(review) ||
      Boolean(selectedDisability || accessibility || isAccessibilityLoading || accessibilityError)
    );
  }, [accessibility, accessibilityError, isAccessibilityLoading, review, selectedDisability]);

  const resultContextSituationSummary = useMemo(() => {
    if (!review || !resultContextSummary) {
      return null;
    }

    return buildResultContextSituationSummary({
      hasAccessibilityGuide: shouldShowAccessibilityExtension,
      review,
      summary: resultContextSummary,
    });
  }, [resultContextSummary, review, shouldShowAccessibilityExtension]);

  const currentReviewDocumentName = useMemo(() => {
    if (!review) {
      return null;
    }

    return getReviewDocumentName(review, selectedFiles);
  }, [review, selectedFiles]);

  useEffect(() => {
    if (!review || !resultContextSelectableIssues.length) {
      setSelectedResultContextIssueTag(null);
      return;
    }

    setSelectedResultContextIssueTag((currentTag) => {
      if (currentTag && resultContextSelectableIssues.some((issue) => issue.tag === currentTag)) {
        return currentTag;
      }

      return resultContextSelectableIssues[0]?.tag ?? null;
    });
  }, [resultContextSelectableIssues, review]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (screenState !== 'result') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [screenState]);

  useEffect(() => {
    if (!shouldScrollToLoading || screenState !== 'loading' || !loadingJob) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollElementIntoView(loadingRef.current);
      setShouldScrollToLoading(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loadingJob, screenState, shouldScrollToLoading]);

  useEffect(() => {
    if (!isAccessibilityPanelOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      accessibilityRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isAccessibilityPanelOpen, accessibility, accessibilityError, isAccessibilityLoading]);

  useEffect(() => {
    if (!loadingJob) {
      return;
    }

    if (loadingJob.job_id === 'before-mock-job') {
      return;
    }

    if (loadingJob.status === 'completed') {
      if (loadingJob.result) {
        setReview(loadingJob.result);
        setCompletedReviewJobId(loadingJob.job_id);
        dispatch({
          type: 'SET_BEFORE_REVIEW_RESULT',
          payload: {
            review: loadingJob.result,
            completed_review_job_id: loadingJob.job_id,
          },
        });
        setScreenState('result');
      } else {
        setErrorMessage('분석은 완료되었지만 결과를 불러오지 못했습니다.');
        setCompletedReviewJobId(null);
        dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });
        setScreenState('home');
      }
      setLoadingJob(null);
      setShouldScrollToLoading(false);
      setIsSubmitting(false);
      return;
    }

    if (loadingJob.status === 'failed') {
      finishFailedBeforeJob(loadingJob);
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      try {
        const nextJob = await getBeforeReviewJob(loadingJob.job_id);
        if (!cancelled) {
          if (nextJob.status === 'failed') {
            finishFailedBeforeJob(nextJob);
            return;
          }

          setLoadingJob(nextJob);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof BeforeApiError
            ? error.message
            : '계약서 분석 상태를 불러오지 못했습니다.';
        setErrorMessage(message);
        setScreenState('home');
        setLoadingJob(null);
        setCompletedReviewJobId(null);
        setShouldScrollToLoading(false);
        setIsSubmitting(false);
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [dispatch, loadingJob]);

  useEffect(() => {
    if (isBackendAuthenticated) {
      setBeforeAnalyzeAuthMessage(null);
    }
  }, [isBackendAuthenticated]);

  useEffect(() => {
    if (hasHandledUrlMockScenarioRef.current) {
      return;
    }

    const scenario = parseBeforeMockScenario(
      new URLSearchParams(window.location.search).get('example'),
    );

    if (!scenario) {
      return;
    }

    hasHandledUrlMockScenarioRef.current = true;
    window.history.replaceState(window.history.state, '', '/before');
    void runMockReview(scenario);
  }, []);

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    setBeforeAnalyzeAuthMessage(null);
  }

  async function runMockReview(scenario: BeforeMockScenario) {
    setErrorMessage(null);
    setBeforeAnalyzeAuthMessage(null);
    clearBridgeActionFeedback();
    setCompletedReviewJobId(null);
    dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });
    setShouldScrollToLoading(false);
    setIsSubmitting(true);
    setScreenState('loading');
    setAccessibility(null);
    setAccessibilityError(null);
    setSelectedDisability(null);
    setIsAccessibilityPanelOpen(false);
    const initialJob = createMockJob();
    setLoadingJob(initialJob);
    setShouldScrollToLoading(true);

    const intervalId = window.setInterval(() => {
      setLoadingJob((currentJob) => {
        if (!currentJob) {
          return currentJob;
        }

        return advanceMockJob(currentJob);
      });
    }, 220);

    try {
      const nextReview = await loadBeforeMockReview(scenario);
      window.clearInterval(intervalId);
      setReview(nextReview);
      setCompletedReviewJobId(null);
      dispatch({
        type: 'SET_BEFORE_REVIEW_RESULT',
        payload: {
          review: nextReview,
          completed_review_job_id: null,
        },
      });
      setScreenState('result');
    } catch {
      window.clearInterval(intervalId);
      setErrorMessage('before mock 결과를 불러오지 못했습니다.');
      setCompletedReviewJobId(null);
      dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });
      setScreenState('home');
      setShouldScrollToLoading(false);
    } finally {
      setLoadingJob(null);
      setIsSubmitting(false);
    }
  }

  async function handleAnalyze() {
    if (!selectedFiles.length) {
      setBeforeAnalyzeAuthMessage(null);
      setErrorMessage('먼저 분석할 파일을 추가해 주세요.');
      return;
    }

    const authGateMessage = getBeforeAnalyzeAuthGateMessage();
    if (authGateMessage) {
      setErrorMessage(null);
      setBeforeAnalyzeAuthMessage(authGateMessage);
      return;
    }

    setErrorMessage(null);
    setBeforeAnalyzeAuthMessage(null);
    clearBridgeActionFeedback();
    setShouldScrollToLoading(false);
    setIsSubmitting(true);
    setScreenState('loading');
    setAccessibility(null);
    setAccessibilityError(null);
    setSelectedDisability(null);
    setIsAccessibilityPanelOpen(false);
    setReview(null);
    setCompletedReviewJobId(null);
    dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });

    try {
      const job = await startBeforeReviewJobWithOptionalAuth(selectedFiles);
      if (job.status === 'failed') {
        finishFailedBeforeJob(job);
        return;
      }

      setLoadingJob(job);
      setShouldScrollToLoading(true);
    } catch (error) {
      const message =
        error instanceof BeforeApiError
          ? error.message
          : '계약서 분석 작업 생성에 실패했습니다.';
      setErrorMessage(message);
      setScreenState('home');
      setLoadingJob(null);
      setCompletedReviewJobId(null);
      setShouldScrollToLoading(false);
      setIsSubmitting(false);
    }
  }

  async function handleLoadMock(scenario: BeforeMockScenario) {
    await runMockReview(scenario);
  }

  async function startBeforeReviewJobWithOptionalAuth(
    files: File[],
  ): Promise<BeforeReviewJob> {
    const currentUser = getFirebaseAuth()?.currentUser ?? null;

    if (!currentUser) {
      if (firebaseUser) {
        throw new BeforeApiError(
          401,
          '로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 분석을 시작해주세요.',
        );
      }

      throw new BeforeApiError(401, BEFORE_ANALYZE_LOGIN_REQUIRED_MESSAGE);
    }

    if (!backendUser.logged_in) {
      throw new BeforeApiError(401, BEFORE_ANALYZE_BACKEND_AUTH_MESSAGE);
    }

    const idToken = await getCurrentBeforeJobIdToken(false);

    try {
      return await startBeforeReviewJob(files, idToken);
    } catch (error) {
      if (error instanceof BeforeApiError && error.status === 401) {
        const refreshedIdToken = await getCurrentBeforeJobIdToken(true);
        return startBeforeReviewJob(files, refreshedIdToken);
      }

      throw error;
    }
  }

  async function getCurrentBeforeJobIdToken(forceRefresh: boolean): Promise<string> {
    const currentUser = getFirebaseAuth()?.currentUser ?? null;

    if (!currentUser) {
      throw new BeforeApiError(
        401,
        '로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 분석을 시작해주세요.',
      );
    }

    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch {
      throw new BeforeApiError(
        401,
        '로그인 인증을 확인하지 못했습니다. 다시 로그인한 뒤 분석을 시작해주세요.',
      );
    }
  }

  async function handleSelectDisability(option: BeforeDisabilityType) {
    setSelectedDisability(option);
    setAccessibilityError(null);
    setIsAccessibilityLoading(true);

    try {
      const recommendation = review
        ? await fetchBeforeAccessibility(option, [])
        : await loadBeforeMockAccessibility(option);
      setAccessibility(recommendation);
    } catch (error) {
      if (review) {
        try {
          const fallback = await loadBeforeMockAccessibility(option);
          setAccessibility(fallback);
          setAccessibilityError(
            error instanceof BeforeApiError
              ? `${error.message} mock 안내를 대신 표시합니다.`
              : '장애 특화 안내를 불러오지 못해 mock 안내를 대신 표시합니다.',
          );
        } catch {
          setAccessibilityError('장애 특화 안내를 불러오지 못했습니다.');
        }
      } else {
        setAccessibilityError('장애 특화 안내를 불러오지 못했습니다.');
      }
    } finally {
      setIsAccessibilityLoading(false);
    }
  }

  function resetBeforeWorkspace({ showUpload }: { showUpload: boolean }) {
    setIsUploadVisible(showUpload);
    setScreenState('home');
    setSelectedFiles([]);
    setLoadingJob(null);
    setCompletedReviewJobId(null);
    setReview(null);
    setAccessibility(null);
    setSelectedDisability(null);
    setIsAccessibilityPanelOpen(false);
    setErrorMessage(null);
    setAccessibilityError(null);
    setShouldScrollToLoading(false);
    setIsSubmitting(false);
    setIsAccessibilityLoading(false);
    setIsBridgeSubmitting(false);
    setBeforeAnalyzeAuthMessage(null);
    clearBridgeActionFeedback();
    dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });
  }

  function handleReset() {
    resetBeforeWorkspace({ showUpload: true });
  }

  function handleWorkspaceNavItemClick(item: WorkspaceNavItem) {
    if (item !== 'before' || isSubmitting || isBridgeSubmitting) {
      return;
    }

    resetBeforeWorkspace({ showUpload: false });
  }

  function handleStartNewReview() {
    if (screenState === 'result' || review || loadingJob) {
      handleReset();
      return;
    }

    setIsUploadVisible(true);
  }

  function ensureAccessibilityRecommendation() {
    if (!selectedDisability && !accessibility && !isAccessibilityLoading && !accessibilityError) {
      void handleSelectDisability(DEFAULT_ACCESSIBILITY_EXTENSION_TYPE);
    }
  }

  function handleAccessibilityDisclosureToggle() {
    const shouldOpen = !isAccessibilityPanelOpen;
    setIsAccessibilityPanelOpen(shouldOpen);

    if (shouldOpen) {
      ensureAccessibilityRecommendation();
    }
  }

  function handleAccessibilityJumpClick() {
    setIsAccessibilityPanelOpen(true);
    ensureAccessibilityRecommendation();

    window.requestAnimationFrame(() => {
      scrollElementIntoView(accessibilitySectionRef.current);
      accessibilityDisclosureButtonRef.current?.focus({ preventScroll: true });
    });
  }

  function clearBridgeActionFeedback() {
    setBridgeActionStatus('idle');
    setBridgeActionMessage(null);
  }

  function finishFailedBeforeJob(job: BeforeReviewJob) {
    setErrorMessage(getBeforeJobFailureMessage(job));
    setScreenState('home');
    setLoadingJob(null);
    setCompletedReviewJobId(null);
    dispatch({ type: 'CLEAR_BEFORE_REVIEW_RESULT' });
    setShouldScrollToLoading(false);
    setIsSubmitting(false);
    setIsAccessibilityPanelOpen(false);
  }

  async function handleBridgeSignIn() {
    clearBridgeActionFeedback();
    await signInWithGoogle();
  }

  async function handleBeforeSignIn() {
    setErrorMessage(null);
    clearBridgeActionFeedback();
    await signInWithGoogle();
  }

  function getBeforeAnalyzeAuthGateMessage(): string | null {
    if (!firebaseConfigured) {
      return BEFORE_ANALYZE_FIREBASE_CONFIG_MESSAGE;
    }

    if (authBusy) {
      return BEFORE_ANALYZE_AUTH_CHECKING_MESSAGE;
    }

    if (!firebaseUser) {
      return BEFORE_ANALYZE_LOGIN_REQUIRED_MESSAGE;
    }

    if (!backendUser.logged_in) {
      return BEFORE_ANALYZE_BACKEND_AUTH_MESSAGE;
    }

    return null;
  }

  async function handleCreateBridgeRun() {
    if (!completedReviewJobId) {
      setBridgeActionStatus('error');
      setBridgeActionMessage(
        'Before 검토 작업 정보를 확인할 수 없습니다. 실제 검토 작업 완료 후 다시 시도해주세요.',
      );
      return;
    }

    const currentUser = getFirebaseAuth()?.currentUser ?? null;
    if (!currentUser) {
      setBridgeActionStatus('error');
      setBridgeActionMessage('AI 법률 상담 연결에는 Google 로그인이 필요합니다.');
      return;
    }

    if (!backendUser.logged_in) {
      setBridgeActionStatus('error');
      setBridgeActionMessage(BRIDGE_BACKEND_AUTH_MESSAGE);
      return;
    }

    setIsBridgeSubmitting(true);
    setBridgeActionStatus('loading');
    setBridgeActionMessage(null);

    try {
      const response = await createBridgeRunWithCurrentToken(completedReviewJobId);
      const handoffItem = bridgeRunToHandoffItem(response);

      dispatch({ type: 'ADD_BRIDGE_HANDOFF_ITEM', payload: handoffItem });
      setBridgeActionStatus('success');
      setBridgeActionMessage('검토 결과를 저장했습니다. AI 법률 상담으로 이동합니다.');
      router.push('/after');
    } catch (error) {
      if (error instanceof BridgeApiError && error.status === 401) {
        void refreshBackendAuth({ forceRefresh: true });
      }

      setBridgeActionStatus('error');
      setBridgeActionMessage(getBridgeActionErrorMessage(error));
    } finally {
      setIsBridgeSubmitting(false);
    }
  }

  async function createBridgeRunWithCurrentToken(
    beforeReviewJobId: string,
  ) {
    const idToken = await getCurrentFirebaseIdToken(false);

    try {
      return await createBridgeRun({
        before_review_job_id: beforeReviewJobId,
        idToken,
      });
    } catch (error) {
      if (error instanceof BridgeApiError && error.status === 401) {
        const refreshedIdToken = await getCurrentFirebaseIdToken(true);
        return createBridgeRun({
          before_review_job_id: beforeReviewJobId,
          idToken: refreshedIdToken,
        });
      }

      throw error;
    }
  }

  async function getCurrentFirebaseIdToken(forceRefresh: boolean): Promise<string> {
    const currentUser = getFirebaseAuth()?.currentUser ?? null;

    if (!currentUser) {
      throw new BridgeApiError(
        401,
        'AI 법률 상담 연결에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
        false,
      );
    }

    return currentUser.getIdToken(forceRefresh);
  }

  return (
    <>
      <SkipLink />
      <Masthead isLoading={isSubmitting || isBridgeSubmitting} />
      <main
        id="main-content"
        tabIndex={-1}
        className={styles.main}
      >
        <div
          className={`${styles.workspaceShell} ${
            screenState === 'result' && review ? styles.workspaceShellResult : ''
          }`}
        >
          <WorkspaceSidebar
            activeItem="before"
            actionLabel="새 검토 시작"
            actionDescription="새 계약서 검토를 시작합니다"
            actionDisabled={isSubmitting || isBridgeSubmitting}
            onAction={handleStartNewReview}
            onNavItemClick={handleWorkspaceNavItemClick}
            ariaLabel="계약서 검토 메뉴"
            summary={
              <>
                <span>Current workspace</span>
                <strong>계약서 검토</strong>
                <p>업로드한 계약서의 위험 조항과 누락 정보를 한 화면에서 확인합니다.</p>

                {shouldShowSidebarDocumentList ? (
                  <section
                    className={styles.documentList}
                    aria-labelledby="before-document-list-title"
                  >
                    <div className={styles.documentListHeader}>
                      <p className={styles.documentListEyebrow}>Documents</p>
                      <h2 id="before-document-list-title">검토 문서</h2>
                    </div>

                    {screenState === 'result' && review && currentReviewDocumentName ? (
                      <article
                        className={`${styles.documentRow} ${styles.documentRowSelected}`}
                        aria-current="true"
                      >
                        <div className={styles.documentRowTopline}>
                          <span className={styles.documentStatusPill}>검토 완료</span>
                          <span className={styles.documentSelectedMark}>선택됨</span>
                        </div>
                        <strong>{currentReviewDocumentName}</strong>
                        {resultContextSummary ? (
                          <p>{formatDocumentRowFindingSummary(resultContextSummary)}</p>
                        ) : null}
                      </article>
                    ) : shouldShowUploadPanel ? (
                      <article className={styles.documentRow}>
                        <div className={styles.documentRowTopline}>
                          <span className={styles.documentStatusPillMuted}>준비 중</span>
                        </div>
                        <strong>새 검토 준비 중</strong>
                        <p>파일을 추가하면 이 목록에 현재 검토 결과가 표시됩니다.</p>
                      </article>
                    ) : null}
                  </section>
                ) : null}
              </>
            }
          />

          <section
            className={`${styles.reviewWorkspace} ${
              screenState === 'result' && review ? styles.reviewWorkspaceResult : ''
            }`}
            aria-labelledby={screenState === 'result' && review ? undefined : 'before-title'}
            aria-label={screenState === 'result' && review ? '근로계약서 검토 결과' : undefined}
          >
            {screenState === 'result' && review ? null : (
              <header className={styles.workspaceHeader}>
                <div>
                  <p className={styles.eyebrow}>Contract review</p>
                  <h1 id="before-title" className={styles.title}>
                    계약서 검토
                  </h1>
                </div>
                <p className={styles.lead}>
                  근로계약서를 올리면 위험 조항, 누락 정보, 참고 조항 후보를 한 화면에서 확인합니다.
                </p>
              </header>
            )}

            {shouldShowWorkspaceLanding ? (
              <section className={styles.emptyStateSection} aria-labelledby="before-empty-title">
                <div className={styles.emptyPanel}>
                  <div className={styles.emptyContent}>
                    <p className={styles.emptyBadge}>Workspace ready</p>
                    <h2 id="before-empty-title" className={styles.emptyTitle}>
                      계약서 검토
                    </h2>
                    <p className={styles.emptyDescription}>
                      새 검토를 시작하면 업로드한 계약서의 위험 조항과 누락 정보를 확인할 수 있습니다.
                    </p>
                    <button
                      type="button"
                      className={styles.emptyPrimaryAction}
                      onClick={handleStartNewReview}
                    >
                      <Plus size={17} aria-hidden="true" />
                      새 검토 시작
                    </button>
                  </div>

                  <div className={styles.emptyStatusGrid} aria-label="검토 작업 상태">
                    <article className={styles.emptyStatusCard}>
                      <span>작업 상태</span>
                      <strong>업로드 대기</strong>
                      <p>계약서 파일을 추가하면 분석 흐름이 이 영역에서 이어집니다.</p>
                    </article>
                    <article className={styles.emptyStatusCard}>
                      <span>검토 항목</span>
                      <strong>위험 의심 · 누락 정보 · 확인 완료</strong>
                      <p>결과 데이터는 분석 완료 후 기존 결과 카드에서 표시됩니다.</p>
                    </article>
                    <article className={styles.emptyStatusCard}>
                      <span>다음 단계</span>
                      <strong>AI 법률 상담 연결 준비</strong>
                      <p>완료된 실제 검토 결과를 바탕으로 질문을 이어갈 수 있습니다.</p>
                    </article>
                  </div>
                </div>
              </section>
            ) : null}

            {shouldShowUploadPanel ? (
              <section className={styles.uploadSection} aria-label="before 업로드 섹션">
                <div className={styles.sectionInner}>
                  {errorMessage ? (
                    <Notification
                      variant="error"
                      title="before 서비스 준비 중 오류"
                      onClose={() => setErrorMessage(null)}
                    >
                      <p>{errorMessage}</p>
                    </Notification>
                  ) : null}

                  <UploadPanel
                    files={selectedFiles}
                    isSubmitting={isSubmitting}
                    errorMessage={errorMessage}
                    authNoticeMessage={beforeAnalyzeAuthMessage}
                    showAuthSignInAction={shouldShowBeforeAuthSignInAction}
                    isAuthActionDisabled={isSubmitting || authBusy}
                    onFilesChange={handleFilesChange}
                    onAnalyze={() => void handleAnalyze()}
                    onSignIn={() => void handleBeforeSignIn()}
                    onLoadMock={(scenario) => void handleLoadMock(scenario)}
                  />
                </div>
              </section>
            ) : null}

            {screenState === 'loading' ? (
              <section
                ref={loadingRef}
                className={styles.loadingSection}
                aria-label="before 분석 진행"
              >
                <div className={styles.sectionInner}>
                  <LoadingPanel fileCount={selectedFiles.length || 1} job={loadingJob} />
                </div>
              </section>
            ) : null}

            {screenState === 'result' && review ? (
              <section ref={resultRef} className={styles.resultSection} aria-label="before 분석 결과">
                <div className={styles.sectionInner}>
                  <div className={styles.workspaceResultFrame}>
                    <div className={styles.resultPanelFrame}>
                      <ResultPanel
                        review={review}
                        onIssueSelect={setSelectedResultContextIssueTag}
                        accessibilityDisclosure={
                          shouldShowAccessibilityExtension ? (
                            <section
                              id={ACCESSIBILITY_EXTENSION_SECTION_ID}
                              ref={accessibilitySectionRef}
                              className={styles.mainAccessibilityDisclosure}
                              aria-labelledby="before-accessibility-disclosure-title"
                              tabIndex={-1}
                            >
                              <button
                                ref={accessibilityDisclosureButtonRef}
                                type="button"
                                className={styles.mainAccessibilityButton}
                                aria-expanded={isAccessibilityPanelOpen}
                                aria-controls={ACCESSIBILITY_EXTENSION_PANEL_ID}
                                onClick={handleAccessibilityDisclosureToggle}
                              >
                                <span className={styles.mainAccessibilityCopy}>
                                  <span className={styles.contextEyebrow}>
                                    Accessibility extension
                                  </span>
                                  <span
                                    id="before-accessibility-disclosure-title"
                                    className={styles.mainAccessibilityTitle}
                                  >
                                    장애 관련 권리·지원 안내
                                  </span>
                                  <span className={styles.mainAccessibilitySummary}>
                                    필요한 편의 제공과 근무조건 확인 항목을 접어서 확인합니다.
                                  </span>
                                </span>
                                <ChevronDown
                                  size={17}
                                  aria-hidden="true"
                                  className={`${styles.mainAccessibilityIcon} ${
                                    isAccessibilityPanelOpen ? styles.mainAccessibilityIconOpen : ''
                                  }`}
                                />
                              </button>

                              <div
                                id={ACCESSIBILITY_EXTENSION_PANEL_ID}
                                ref={accessibilityRef}
                                tabIndex={-1}
                                className={styles.mainAccessibilityPanel}
                                hidden={!isAccessibilityPanelOpen}
                              >
                                <AccessibilityPanel
                                  selectedDisability={selectedDisability}
                                  recommendation={accessibility}
                                  isLoading={isAccessibilityLoading}
                                  errorMessage={accessibilityError}
                                  onSelectDisability={(option) => void handleSelectDisability(option)}
                                />
                              </div>
                            </section>
                          ) : null
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside
            className={`${styles.contextPanel} ${
              screenState === 'result' && review ? styles.contextPanelResult : ''
            }`}
            aria-label={screenState === 'result' && review ? '검토 결과 요약' : '검토 기준'}
          >
            {screenState === 'result' && review && resultContextSummary ? (
              <>
                <div className={`${styles.contextHeader} ${styles.resultContextHeader}`}>
                  <p className={styles.contextEyebrow}>RESULT CONTEXT</p>
                  <h2>검토 결과 요약</h2>
                </div>

                {resultContextSituationSummary ? (
                  <section className={styles.resultContextSituationCard} aria-label="상황 요약">
                    <p className={styles.resultContextSituationLabel}>상황 요약</p>
                    <p className={styles.resultContextSituationLine}>
                      {resultContextSituationSummary}
                    </p>
                  </section>
                ) : null}

                <section className={styles.resultContextStats} aria-label="결과 카운트 요약">
                  <div
                    className={`${styles.resultContextStatCard} ${
                      resultContextSummary.riskCount > 0
                        ? styles.resultContextStatDanger
                        : styles.resultContextStatNeutral
                    }`}
                  >
                    <span>위험</span>
                    <strong>{resultContextSummary.riskCount}</strong>
                  </div>
                  <div
                    className={`${styles.resultContextStatCard} ${
                      resultContextSummary.needsReviewCount > 0
                        ? styles.resultContextStatWarning
                        : styles.resultContextStatNeutral
                    }`}
                  >
                    <span>누락</span>
                    <strong>{resultContextSummary.needsReviewCount}</strong>
                  </div>
                  <div
                    className={`${styles.resultContextStatCard} ${
                      resultContextSummary.passCount > 0
                        ? styles.resultContextStatSuccess
                        : styles.resultContextStatNeutral
                    }`}
                  >
                    <span>확인</span>
                    <strong>{resultContextSummary.passCount}</strong>
                  </div>
                </section>

                {selectedResultContextIssue ? (
                  <section
                    className={`${styles.resultContextSelectedCard} ${getResultContextSelectedCardClassName(
                      selectedResultContextIssue.tone,
                    )}`}
                    aria-labelledby="before-result-selected-issue-title"
                    aria-live="polite"
                  >
                    <div className={styles.resultContextSectionHeader}>
                      <p className={styles.contextEyebrow}>선택한 검토 항목</p>
                      <h3 id="before-result-selected-issue-title">
                        {selectedResultContextIssue.tag} 해석
                      </h3>
                    </div>

                    <div className={styles.resultContextSelectedHeader}>
                      <span
                        className={`${styles.resultContextSignal} ${getResultContextSignalClassName(
                          selectedResultContextIssue.tone,
                        )}`}
                        aria-hidden="true"
                      >
                        <ResultContextSignalIcon tone={selectedResultContextIssue.tone} />
                      </span>
                      <span
                        className={`${styles.resultContextTag} ${getResultContextTagClassName(
                          selectedResultContextIssue.tone,
                        )}`}
                      >
                        {selectedResultContextIssue.tag}
                      </span>
                      <strong>{selectedResultContextIssue.title}</strong>
                    </div>

                    <p className={styles.resultContextSelectedDescription}>
                      {selectedResultContextIssue.description}
                    </p>

                    {selectedResultContextIssue.lawRef ? (
                      <div className={styles.resultContextSelectedMeta}>
                        <span>관련 기준</span>
                        <strong>{selectedResultContextIssue.lawRef}</strong>
                      </div>
                    ) : null}

                    <div className={styles.resultContextSelectedAction}>
                      <span>다음 행동</span>
                      <p>{selectedResultContextIssue.nextAction}</p>
                    </div>
                  </section>
                ) : null}

                {shouldShowAccessibilityExtension ? (
                  <section className={styles.resultContextAccessibilityCard}>
                    <button
                      type="button"
                      className={styles.resultContextAccessibilityButton}
                      aria-expanded={isAccessibilityPanelOpen}
                      aria-controls={ACCESSIBILITY_EXTENSION_PANEL_ID}
                      onClick={handleAccessibilityJumpClick}
                    >
                      <span>
                        <span className={styles.resultContextAccessibilityEyebrow}>
                          Accessibility extension
                        </span>
                        <strong>장애 관련 권리·지원 안내 보기</strong>
                      </span>
                      <ChevronDown
                        size={17}
                        aria-hidden="true"
                        className={`${styles.resultContextAccessibilityIcon} ${
                          isAccessibilityPanelOpen
                            ? styles.resultContextAccessibilityIconOpen
                            : ''
                        }`}
                      />
                    </button>
                  </section>
                ) : null}

                <section className={styles.resultContextBridgeCard} aria-label="주요 행동">
                  <BridgeHandoffCta
                    hasJobId={hasBridgeJobId}
                    hasFirebaseSession={Boolean(firebaseUser)}
                    isAuthenticated={isBridgeAuthenticated}
                    isAuthBusy={authBusy}
                    isFirebaseConfigured={firebaseConfigured}
                    isSubmitting={isBridgeSubmitting}
                    status={bridgeActionStatus}
                    message={bridgeActionMessage ?? authErrorMessage}
                    onCreate={() => void handleCreateBridgeRun()}
                    onSignIn={() => void handleBridgeSignIn()}
                  />
                </section>

              </>
            ) : (
              <>
                <div className={styles.contextHeader}>
                  <p className={styles.contextEyebrow}>REVIEW BASIS</p>
                  <h2>검토 기준</h2>
                </div>

                <div className={styles.contextStack}>
                  <article className={`${styles.contextCard} ${styles.contextCardRisk}`}>
                    <div>
                      <span className={styles.statusPillRisk}>위험 의심</span>
                      <strong>권리 제한 가능성</strong>
                    </div>
                    <p>불리한 조항이 의심되면 결과 화면에서 기존 분석 흐름으로 표시합니다.</p>
                  </article>
                  <article className={`${styles.contextCard} ${styles.contextCardWarning}`}>
                    <div>
                      <span className={styles.statusPillWarning}>누락 정보</span>
                      <strong>필수 조건 확인</strong>
                    </div>
                    <p>임금, 시간, 휴게, 계약 기간처럼 확인이 필요한 항목을 우선 살핍니다.</p>
                  </article>
                  <article className={`${styles.contextCard} ${styles.contextCardSuccess}`}>
                    <div>
                      <span className={styles.statusPillSuccess}>확인 완료</span>
                      <strong>문서 내 근거</strong>
                    </div>
                    <p>계약서에서 확인된 내용은 결과 카드와 참고 항목에 이어서 정리됩니다.</p>
                  </article>
                </div>
              </>
            )}

            <div className={styles.contextNotice}>
              <ClipboardCheck size={16} aria-hidden="true" />
              <p>
                {screenState === 'result' && review
                  ? '제출 전 사실관계를 확인해 주세요. 결과는 참고용이며 최종 법률 판단이 아닙니다.'
                  : '결과는 참고용이며 최종 법률 판단이 아닙니다.'}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

interface BridgeHandoffCtaProps {
  hasJobId: boolean;
  hasFirebaseSession: boolean;
  isAuthenticated: boolean;
  isAuthBusy: boolean;
  isFirebaseConfigured: boolean;
  isSubmitting: boolean;
  status: BridgeActionStatus;
  message: string | null;
  onCreate: () => void;
  onSignIn: () => void;
}

function buildResultContextIssues(review: BeforeReviewResult): ResultContextIssue[] {
  return buildBeforeReviewDisplayIssues(review).map((issue) => ({
    title: issue.title,
    description: getResultContextIssueDescription(issue),
    lawRef: issue.law_ref.trim(),
    nextAction: getResultContextNextAction(issue, review.recommended_actions),
    status: issue.status,
    tag: issue.tag,
    tone: issue.tone,
  }));
}

function formatDocumentRowFindingSummary(summary: ResultContextSummary): string {
  const issueSummary =
    summary.riskCount > 0 || summary.needsReviewCount > 0
      ? `위험 ${summary.riskCount} · 누락 ${summary.needsReviewCount}`
      : '위험·누락 0';

  return `${issueSummary} · 확인 ${summary.passCount}`;
}

function buildResultContextSituationSummary({
  hasAccessibilityGuide,
  review,
  summary,
}: {
  hasAccessibilityGuide: boolean;
  review: BeforeReviewResult;
  summary: ResultContextSummary;
}): string {
  const displayIssues = buildBeforeReviewDisplayIssues(review);
  const riskIssues = displayIssues.filter((issue) => issue.status === 'VIOLATION');
  const warningIssues = displayIssues.filter((issue) => issue.status === 'WARNING');
  const findingParts = [
    riskIssues.length
      ? `${formatResultContextIssueTopics(riskIssues)} 관련 위험 ${summary.riskCount}건`
      : null,
    warningIssues.length
      ? `${formatResultContextIssueTopics(warningIssues)} 관련 누락 ${summary.needsReviewCount}건`
      : null,
  ].filter((part): part is string => Boolean(part));

  if (findingParts.length) {
    return `${findingParts.join(', ')}이 표시됐습니다.`;
  }

  if (hasAccessibilityGuide) {
    return '위험·누락 항목은 표시되지 않고, 확인 완료 항목 중심의 결과입니다. 장애 관련 권리·지원 안내가 함께 제공됩니다.';
  }

  if (summary.passCount > 0) {
    return `위험·누락 항목은 표시되지 않고, 확인 완료 항목 ${summary.passCount}건 중심의 결과입니다.`;
  }

  return '검토 항목을 기준으로 추가 확인이 필요한 부분을 정리했습니다.';
}

function formatResultContextIssueTopics(issues: BeforeReviewDisplayIssue[]): string {
  const topics = issues.reduce<string[]>((accumulator, issue) => {
    const topic = getResultContextIssueTopic(issue);
    if (!accumulator.includes(topic)) {
      accumulator.push(topic);
    }
    return accumulator;
  }, []);

  return topics.slice(0, 4).join('·');
}

function getResultContextIssueTopic(issue: BeforeReviewDisplayIssue): string {
  const text = `${issue.title} ${issue.description} ${issue.law_ref}`;

  if (/최저임금/.test(text)) {
    return '최저임금';
  }

  if (/(휴게|근로시간|근로일|소정근로|초과근무)/.test(text)) {
    return /휴게/.test(text) ? '휴게시간' : '근로시간';
  }

  if (/(기숙사|숙소|숙박시설)/.test(text)) {
    return '기숙사 정보';
  }

  if (/(여권|이직|사업장|손해배상|권리\s*제한|보관|이동\s*제한)/.test(text)) {
    return '권리 제한';
  }

  if (/(수당|임금|시급|월급|일급|공제|지급일)/.test(text)) {
    return '임금 조건';
  }

  if (/(계약기간|근로계약기간|근로개시|시작일|종료일|기간의\s*정함)/.test(text)) {
    return '근로계약기간';
  }

  if (/(표준근로계약서|표준\s*계약서)/.test(text)) {
    return '표준계약서';
  }

  return issue.title.replace(/\s*조항$/u, '').trim() || '검토 항목';
}

function getResultContextIssueDescription(issue: BeforeReviewDisplayIssue): string {
  const description = issue.description.trim();

  if (description) {
    return description;
  }

  if (issue.status === 'WARNING') {
    return '누락된 정보를 확인해 주세요.';
  }

  if (issue.status === 'VIOLATION') {
    return '문서와 실제 근무조건을 함께 확인해 주세요.';
  }

  return '문서에서 추가 확인이 필요합니다.';
}

function getResultContextNextAction(
  issue: BeforeReviewDisplayIssue,
  recommendedActions: string[],
): string {
  const matchingAction = findBestRecommendedAction(issue, recommendedActions);

  if (matchingAction) {
    return matchingAction;
  }

  if (issue.status === 'WARNING') {
    return '누락된 정보를 확인해 주세요.';
  }

  return '문서와 실제 근무조건을 대조해 추가 확인해 주세요.';
}

function findBestRecommendedAction(
  issue: BeforeReviewDisplayIssue,
  recommendedActions: string[],
): string | null {
  if (!recommendedActions.length) {
    return null;
  }

  const issueText = `${issue.title} ${issue.description} ${issue.law_ref}`;
  const issueCategory = getResultContextTextCategory(issueText);
  const scoredActions = recommendedActions.map((action) => {
    const actionCategory = getResultContextTextCategory(action);
    const score =
      getResultContextTokenOverlapScore(action, issueText) +
      (issueCategory && issueCategory === actionCategory ? 7 : 0);

    return { action, score };
  });
  const bestAction = scoredActions.reduce((best, current) =>
    current.score > best.score ? current : best,
  );

  return bestAction.score > 0 ? bestAction.action : recommendedActions[0] ?? null;
}

function getResultContextTokenOverlapScore(source: string, target: string): number {
  const sourceTokens = new Set(tokenizeResultContextText(source));
  return tokenizeResultContextText(target).reduce((score, token) => {
    if (sourceTokens.has(token)) {
      return score + (token.length >= 4 ? 2 : 1);
    }

    return score;
  }, 0);
}

function tokenizeResultContextText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getResultContextTextCategory(text: string): string | null {
  if (/(최저|임금|시급|월급|일급|상여|수당|공제|지급일)/.test(text)) {
    return 'wage';
  }

  if (/(근로시간|근로일|휴게|휴일|소정|초과|야간|연장)/.test(text)) {
    return 'hours';
  }

  if (/(계약기간|근로개시|시작일|종료일|기간의\s*정함)/.test(text)) {
    return 'period';
  }

  if (/(숙소|기숙사|숙박시설)/.test(text)) {
    return 'dormitory';
  }

  if (/(여권|이직|사업장|권리\s*제한|보관|이동\s*제한)/.test(text)) {
    return 'rights';
  }

  if (/(장애|편의|의사소통|근무환경)/.test(text)) {
    return 'accessibility';
  }

  return null;
}

function getResultContextTagClassName(tone: BeforeReviewIssueTone): string {
  if (tone === 'danger') {
    return styles.resultContextTagDanger;
  }

  if (tone === 'warning') {
    return styles.resultContextTagWarning;
  }

  return styles.resultContextTagSuccess;
}

function getResultContextSignalClassName(tone: BeforeReviewIssueTone): string {
  if (tone === 'danger') {
    return styles.resultContextSignalDanger;
  }

  if (tone === 'warning') {
    return styles.resultContextSignalWarning;
  }

  return styles.resultContextSignalSuccess;
}

function ResultContextSignalIcon({ tone }: { tone: BeforeReviewIssueTone }) {
  if (tone === 'danger') {
    return <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />;
  }

  if (tone === 'warning') {
    return <CircleDot size={14} strokeWidth={2.5} aria-hidden="true" />;
  }

  return <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden="true" />;
}

function getResultContextSelectedCardClassName(tone: BeforeReviewIssueTone): string {
  if (tone === 'danger') {
    return styles.resultContextSelectedCardDanger;
  }

  if (tone === 'warning') {
    return styles.resultContextSelectedCardWarning;
  }

  return styles.resultContextSelectedCardSuccess;
}

function isAccessibilityRelevantReview(review: BeforeReviewResult): boolean {
  if (review.review_id === '54a00490-5cfc-4371-87d1-00985108ceb7') {
    return true;
  }

  const searchableText = [
    review.review_id,
    review.contract_info.type,
    review.summary,
    review.headline,
    review.plain_language_summary,
    ...review.overall_assessment,
    ...review.recommended_actions,
    ...review.important_points.flatMap((point) => [
      point.title,
      point.description,
      point.law_ref,
    ]),
    ...review.evidence.flatMap((evidence) => [evidence.title, evidence.excerpt]),
  ].join(' ');

  return /(장애|편의\s*제공|의사소통\s*지원|근무환경|장애인|장애인차별금지|장애인고용촉진)/.test(
    searchableText,
  );
}

function scrollElementIntoView(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}

function BridgeHandoffCta({
  hasJobId,
  hasFirebaseSession,
  isAuthenticated,
  isAuthBusy,
  isFirebaseConfigured,
  isSubmitting,
  status,
  message,
  onCreate,
  onSignIn,
}: BridgeHandoffCtaProps) {
  const canCreate =
    hasJobId && isAuthenticated && isFirebaseConfigured && !isAuthBusy && !isSubmitting;
  const shouldShowLogin = hasJobId && isFirebaseConfigured && !isAuthenticated;
  const statusText = getBridgeCtaStatusText({
    hasJobId,
    hasFirebaseSession,
    isAuthenticated,
    isAuthBusy,
    isFirebaseConfigured,
    status,
    message,
  });

  return (
    <div className={styles.bridgeCta}>
      <div className={styles.bridgeCtaHeader}>
        <p className={styles.bridgeCtaEyebrow}>상담 연결</p>
        <h3 className={styles.bridgeCtaTitle}>AI 법률 상담 이어가기</h3>
        <p className={styles.bridgeCtaDescription}>
          이 검토 결과를 바탕으로 질문을 이어갈 수 있습니다.
        </p>
      </div>

      {statusText ? (
        <p className={getBridgeCtaMessageClassName(status)} role={status === 'error' ? 'alert' : 'status'}>
          {statusText}
        </p>
      ) : null}

      <div className={styles.bridgeCtaActions}>
        {shouldShowLogin ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onSignIn}
            disabled={isAuthBusy || isSubmitting}
            className={styles.bridgeCtaSecondaryButton}
          >
            Google 로그인
          </Button>
        ) : null}

        <Button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          isLoading={isSubmitting || status === 'loading'}
          className={styles.bridgeCtaPrimaryButton}
        >
          <span className={styles.bridgeCtaButtonLabel}>
            AI 법률 상담 이어가기
            <ArrowRight size={18} aria-hidden="true" />
          </span>
        </Button>
      </div>
    </div>
  );
}

function getBridgeCtaStatusText(input: {
  hasJobId: boolean;
  hasFirebaseSession: boolean;
  isAuthenticated: boolean;
  isAuthBusy: boolean;
  isFirebaseConfigured: boolean;
  status: BridgeActionStatus;
  message: string | null;
}): string | null {
  if (!input.hasJobId) {
    return '실제 검토 완료 결과에서만 연결됩니다.';
  }

  if (!input.isFirebaseConfigured) {
    return 'Google 로그인 설정이 필요합니다.';
  }

  if (!input.isAuthenticated) {
    if (input.hasFirebaseSession) {
      return BRIDGE_BACKEND_AUTH_MESSAGE;
    }

    return 'AI 법률 상담 연결에는 Google 로그인이 필요합니다.';
  }

  if (input.isAuthBusy) {
    return '로그인 상태를 확인하는 중입니다.';
  }

  if (input.status === 'loading') {
    return '상담 연결을 준비하는 중입니다.';
  }

  return input.message;
}

function getBridgeCtaMessageClassName(status: BridgeActionStatus): string {
  if (status === 'error') {
    return styles.bridgeCtaError;
  }

  if (status === 'success') {
    return styles.bridgeCtaSuccess;
  }

  return styles.bridgeCtaNotice;
}

function getReviewDocumentName(review: BeforeReviewResult, files: File[]): string {
  const selectedFileName = files.find((file) => file.name.trim())?.name.trim();
  if (selectedFileName) {
    return selectedFileName;
  }

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

function getBridgeActionErrorMessage(error: unknown): string {
  if (error instanceof BridgeApiError) {
    if (error.status === 401) {
      return '로그인 또는 인증 확인이 필요합니다. 다시 로그인한 뒤 시도해주세요.';
    }

    if (error.status === 404) {
      return '로그인 후 생성한 Before 검토 작업만 AI 법률 상담으로 연결할 수 있습니다. 비로그인 검토 결과는 로그인 후 다시 검토해주세요.';
    }

    if (error.status === 409) {
      return 'Before 검토가 아직 완료되지 않았습니다. 완료 후 다시 시도해주세요.';
    }

    if (error.status === 422 || error.status >= 500) {
      return '상담 연결 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
    }

    return error.message;
  }

  return '상담 연결 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function getBeforeJobFailureMessage(job: BeforeReviewJob): string {
  const failedOcrStep = job.steps.find(isFailedOcrStep) ?? null;

  if (
    failedOcrStep &&
    hasOcrQuotaErrorMessage([job.error ?? null, failedOcrStep.message ?? null])
  ) {
    return BEFORE_JOB_OCR_QUOTA_FAILURE_MESSAGE;
  }

  if (
    failedOcrStep &&
    hasOcrTimeoutErrorMessage([job.error ?? null, failedOcrStep.message ?? null])
  ) {
    return BEFORE_JOB_OCR_TIMEOUT_FAILURE_MESSAGE;
  }

  return BEFORE_JOB_GENERAL_FAILURE_MESSAGE;
}

function isFailedOcrStep(step: BeforeReviewJob['steps'][number]): boolean {
  if (step.status !== 'failed') {
    return false;
  }

  const key = step.key.toLowerCase();
  const label = step.label.toLowerCase();

  return key.includes('ocr') || label.includes('ocr');
}

function hasOcrQuotaErrorMessage(messages: Array<string | null>): boolean {
  return messages.some((message) => {
    if (!message) {
      return false;
    }

    return OCR_QUOTA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  });
}

function hasOcrTimeoutErrorMessage(messages: Array<string | null>): boolean {
  return messages.some((message) => {
    if (!message) {
      return false;
    }

    return OCR_TIMEOUT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  });
}
