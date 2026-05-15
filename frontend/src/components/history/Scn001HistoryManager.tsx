'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, EyeOff, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { useFlow } from '@/context/FlowContext';
import type { BridgeIssueDisplay } from '@/lib/bridge-handoff';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  buildScn001CaseHistoryRecords,
  filterVisibleScn001History,
  getBridgeRunHistoryDisplayFields,
  type Scn001CaseHistoryRecord,
} from '@/lib/scn001-history-display';
import {
  deleteBeforeReviewJobHistory,
  deleteBridgeRunHistory,
  fetchBeforeReviewHistory,
  fetchBridgeRunHistory,
  Scn001HistoryApiError,
} from '@/lib/scn001-history-api';
import type {
  BeforeReviewJobHistoryItem,
  BridgeRunHistoryItem,
  Scn001HistoryOverallResult,
  Scn001HistorySeverity,
} from '@/types/scn001-history';

import styles from './Scn001HistoryManager.module.css';

type Scn001HistoryStatus = 'idle' | 'loading' | 'success' | 'error';
type HistoryDeleteKind = 'before' | 'bridge';
type HistoryDeleteTarget = { kind: HistoryDeleteKind; id: string };
type HistoryMutationMessage = { kind: 'notice' | 'error'; message: string };

const SCN001_HISTORY_LIMIT = 30;
const SCN001_HISTORY_BACKEND_AUTH_MESSAGE =
  '서버 인증 확인이 완료되지 않아 기록을 불러올 수 없습니다. 인증 확인 또는 다시 로그인 후 시도해주세요.';

export function Scn001HistoryManager() {
  const { dispatch } = useFlow();
  const {
    firebaseConfigured,
    firebaseUser,
    backendUser,
    isInitializing,
    isSigningIn,
    isCheckingBackend,
    signInWithGoogle,
    refreshBackendAuth,
  } = useAuth();
  const [historyStatus, setHistoryStatus] = useState<Scn001HistoryStatus>('idle');
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(null);
  const [beforeHistory, setBeforeHistory] = useState<BeforeReviewJobHistoryItem[]>([]);
  const [bridgeHistory, setBridgeHistory] = useState<BridgeRunHistoryItem[]>([]);
  const [historyRefreshNonce, setHistoryRefreshNonce] = useState(0);
  const [historyDeleteTarget, setHistoryDeleteTarget] =
    useState<HistoryDeleteTarget | null>(null);
  const [historyMutationMessage, setHistoryMutationMessage] =
    useState<HistoryMutationMessage | null>(null);

  const authBusy = isInitializing || isSigningIn || isCheckingBackend;
  const isBackendAuthenticated = backendUser.logged_in;

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
          fetchBeforeReviewHistory({ idToken, limit: SCN001_HISTORY_LIMIT }),
          fetchBridgeRunHistory({ idToken, limit: SCN001_HISTORY_LIMIT }),
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

  const notice = getScn001HistoryNotice({
    firebaseConfigured,
    isAuthBusy: authBusy,
    hasFirebaseSession: Boolean(firebaseUser),
    isAuthenticated: isBackendAuthenticated,
    status: historyStatus,
    errorMessage: historyErrorMessage,
    mutationMessage: historyMutationMessage,
    beforeJobs: beforeHistory,
    bridgeRuns: bridgeHistory,
  });

  const canShowSignInAction =
    firebaseConfigured && !authBusy && !firebaseUser && !isBackendAuthenticated;
  const canShowBackendRetryAction =
    firebaseConfigured && !authBusy && Boolean(firebaseUser) && !isBackendAuthenticated;
  const caseRecords = useMemo(
    () => buildScn001CaseHistoryRecords({ beforeJobs: beforeHistory, bridgeRuns: bridgeHistory }),
    [beforeHistory, bridgeHistory],
  );
  const totalHistoryCount = caseRecords.length;
  const shouldShowLoggedOutEmptyState = !isBackendAuthenticated;
  const shouldShowNoRecordsEmptyState =
    isBackendAuthenticated && historyStatus === 'success' && totalHistoryCount === 0;
  const shouldSuppressNoticeForEmptyState =
    Boolean(notice) &&
    ((shouldShowLoggedOutEmptyState && notice?.kind === 'notice') ||
      shouldShowNoRecordsEmptyState);

  async function handleDeleteHistoryRecord(target: HistoryDeleteTarget) {
    if (historyDeleteTarget) {
      return;
    }

    if (!window.confirm(getHistoryDeleteConfirmMessage(target.kind))) {
      return;
    }

    if (!backendUser.logged_in) {
      setHistoryMutationMessage({
        kind: 'error',
        message: SCN001_HISTORY_BACKEND_AUTH_MESSAGE,
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
        message: '기록과 연결 후보를 목록에서 숨겼습니다.',
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

  return (
    <section className={styles.panel} aria-labelledby="history-page-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>사건 기록</p>
          <h2 id="history-page-title" className={styles.title}>
            저장된 사건 기록
          </h2>
          <p className={styles.description}>
            완료된 계약서 검토와 AI 법률 상담 연결 후보만 표시합니다.
          </p>
        </div>
        <div className={styles.headerMeta} aria-label="기록 표시 범위">
          <span className={styles.visibilityPill}>안전 표시</span>
          {isBackendAuthenticated && historyStatus === 'success' ? (
            <span className={styles.totalPill}>총 {totalHistoryCount}건</span>
          ) : null}
        </div>
      </div>

      {shouldShowLoggedOutEmptyState ? (
        <HistoryEmptyStateCard
          markerLabel={getLoggedOutHistoryMarkerLabel({
            firebaseConfigured,
            isAuthBusy: authBusy,
            hasFirebaseSession: Boolean(firebaseUser),
          })}
          title={getLoggedOutHistoryEmptyTitle({
            firebaseConfigured,
            isAuthBusy: authBusy,
            hasFirebaseSession: Boolean(firebaseUser),
          })}
          description={getLoggedOutHistoryEmptyDescription({
            firebaseConfigured,
            isAuthBusy: authBusy,
            hasFirebaseSession: Boolean(firebaseUser),
          })}
          primaryAction={
            canShowSignInAction
              ? {
                  label: 'Google 로그인',
                  onClick: () => void signInWithGoogle(),
                }
              : canShowBackendRetryAction
                ? {
                    label: '인증 확인',
                    onClick: retryHistoryLoad,
                  }
                : null
          }
          secondaryHref="/after"
          secondaryLabel="AI 법률 상담 시작하기"
        />
      ) : null}

      {shouldShowNoRecordsEmptyState ? (
        <HistoryEmptyStateCard
          markerLabel="기록 없음"
          title="아직 저장된 사건 기록이 없습니다."
          description="계약서 검토를 완료하거나 AI 법률 상담으로 이어가면 이곳에서 사건별 기록을 확인할 수 있습니다."
          primaryHref="/before"
          primaryLabel="계약서 검토 시작하기"
          secondaryHref="/after"
          secondaryLabel="AI 법률 상담 시작하기"
        />
      ) : null}

      {notice && !shouldSuppressNoticeForEmptyState ? (
        <div
          className={notice.kind === 'error' ? styles.error : styles.notice}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.message}</span>
          <div className={styles.noticeActions}>
            {canShowSignInAction ? (
              <button
                className={styles.noticeButton}
                type="button"
                onClick={() => void signInWithGoogle()}
              >
                Google 로그인
              </button>
            ) : null}
            {notice.canRetry ? (
              <button className={styles.noticeButton} type="button" onClick={retryHistoryLoad}>
                <RefreshCw size={16} aria-hidden="true" />
                다시 시도
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isBackendAuthenticated && historyStatus === 'success' && totalHistoryCount > 0 ? (
        <>
          <div className={styles.summaryGrid} aria-label="기록 요약">
            <HistoryStat
              label="사건 묶음"
              value={`${caseRecords.length}건`}
              description="완료된 검토와 연결 후보"
            />
            <HistoryStat
              label="After 연결 후보"
              value={`${bridgeHistory.length}건`}
              description="질문에 이어볼 참고 맥락"
            />
          </div>
          <CaseHistoryList
            records={caseRecords}
            deletingTarget={historyDeleteTarget}
            onDelete={(target) => void handleDeleteHistoryRecord(target)}
          />
        </>
      ) : null}
    </section>
  );
}

function HistoryEmptyStateCard({
  markerLabel,
  title,
  description,
  primaryAction = null,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  markerLabel: string;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void } | null;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <section className={styles.emptyStateCard} aria-label={title}>
      <div className={styles.emptyStateMarker} aria-hidden="true">
        <span>{markerLabel}</span>
      </div>
      <div className={styles.emptyStateCopy}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className={styles.emptyStateActions}>
        {primaryAction ? (
          <button
            className={styles.emptyPrimaryAction}
            type="button"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        ) : primaryHref && primaryLabel ? (
          <Link className={styles.emptyPrimaryAction} href={primaryHref}>
            {primaryLabel}
          </Link>
        ) : null}
        <Link className={styles.emptySecondaryAction} href={secondaryHref}>
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

function getLoggedOutHistoryMarkerLabel({
  firebaseConfigured,
  isAuthBusy,
  hasFirebaseSession,
}: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
}): string {
  if (!firebaseConfigured) {
    return '설정';
  }

  if (isAuthBusy) {
    return '확인 중';
  }

  if (hasFirebaseSession) {
    return '인증';
  }

  return '로그인';
}

function getLoggedOutHistoryEmptyTitle({
  firebaseConfigured,
  isAuthBusy,
  hasFirebaseSession,
}: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
}): string {
  if (!firebaseConfigured) {
    return '로그인 설정 확인이 필요합니다.';
  }

  if (isAuthBusy) {
    return '로그인 상태를 확인하고 있습니다.';
  }

  if (hasFirebaseSession) {
    return '서버 인증 확인 후 기록을 볼 수 있습니다.';
  }

  return '로그인하면 사건 기록을 이어볼 수 있습니다.';
}

function getLoggedOutHistoryEmptyDescription({
  firebaseConfigured,
  isAuthBusy,
  hasFirebaseSession,
}: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
}): string {
  if (!firebaseConfigured) {
    return '저장된 기록을 보려면 Firebase public env 설정이 필요합니다. AI 법률 상담은 로그인 없이 시작할 수 있습니다.';
  }

  if (isAuthBusy) {
    return 'Google 로그인과 서버 확인 상태를 확인한 뒤 저장된 사건 기록을 표시합니다.';
  }

  if (hasFirebaseSession) {
    return 'Google 로그인은 확인됐습니다. 기록 사용 전 서버 인증을 다시 확인해 주세요.';
  }

  return '계약서 검토와 상담 연결 기록은 로그인 후 안전한 표시 범위로만 보관함에 나타납니다.';
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

function CaseHistoryList({
  records,
  deletingTarget,
  onDelete,
}: {
  records: Scn001CaseHistoryRecord[];
  deletingTarget: HistoryDeleteTarget | null;
  onDelete: (target: HistoryDeleteTarget) => void;
}) {
  return (
    <section className={styles.caseSection} aria-label="사건 중심 기록">
      <div className={styles.caseSectionHeader}>
        <div>
          <h3 className={styles.columnTitle}>사건 중심 기록</h3>
          <p className={styles.columnDescription}>
            상황 설명, 확인된 쟁점, 참고할 법 조항 후보, 권장 다음 단계를 한 카드에서 확인합니다.
          </p>
        </div>
        <span className={styles.count}>{records.length}건</span>
      </div>

      {records.length === 0 ? (
        <p className={styles.empty}>
          표시할 사건 기록이 없습니다. 완료된 검토나 연결 후보를 만든 뒤 다시 확인해주세요.
        </p>
      ) : (
        <ol className={styles.list}>
          {records.map((record, index) => (
            <CaseHistoryCard
              key={record.caseId}
              record={record}
              index={index}
              deletingTarget={deletingTarget}
              onDelete={onDelete}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function CaseHistoryCard({
  record,
  index,
  deletingTarget,
  onDelete,
}: {
  record: Scn001CaseHistoryRecord;
  index: number;
  deletingTarget: HistoryDeleteTarget | null;
  onDelete: (target: HistoryDeleteTarget) => void;
}) {
  const beforeJob = record.beforeJob;
  const caseLabel = `사건 ${index + 1}`;

  return (
    <li className={styles.item}>
      <details className={styles.caseFold}>
        <summary className={styles.caseSummary}>
          <span className={styles.caseSummaryText}>
            <span className={styles.cardEyebrow}>사건 요약</span>
            <span className={styles.caseSummaryTitle}>{caseLabel}</span>
            <span className={styles.compactSummary}>{record.compactSummary}</span>
          </span>
          <span className={styles.caseSummaryMeta}>
            <span>
              {record.bridgeRuns.length > 0
                ? `연결 후보 ${record.bridgeRuns.length}건`
                : '연결 후보 없음'}
            </span>
            <span>최근 {formatHistoryDateTime(record.updatedAt)}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </span>
        </summary>

        <div className={styles.caseBody}>
          <div className={styles.cardTop}>
            <div className={styles.cardTitleGroup}>
              <p className={styles.cardEyebrow}>기록 상세</p>
              <h4 className={styles.cardTitle}>상황 설명과 기록 정보</h4>
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
                disabled={Boolean(deletingTarget)}
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
            <p className={styles.caseHint}>
              원 Before 요약은 현재 목록에서 불러오지 못했습니다. 표시된 연결 요약만 참고합니다.
            </p>
          ) : null}

          <dl className={styles.metaGrid}>
            {beforeJob ? (
              <>
                <HistoryMeta label="검토 판정" value={formatOverallResult(beforeJob.overall_result)} />
                <HistoryMeta label="심각도" value={formatSeverity(beforeJob.overall_severity)} />
              </>
            ) : null}
            <HistoryMeta
              label="연결 후보"
              value={record.bridgeRuns.length > 0 ? `${record.bridgeRuns.length}건` : '없음'}
            />
            <HistoryMeta label="최근 갱신" value={formatHistoryDateTime(record.updatedAt)} />
          </dl>

          <section className={styles.caseFlow} aria-label={`${caseLabel} 연결 흐름`}>
            {record.bridgeRuns.length === 0 ? (
              <div className={styles.emptyConnection}>
                <p className={styles.emptyConnectionTitle}>아직 연결 후보 없음</p>
                <p className={styles.caseHint}>
                  {record.hasKnownBridge
                    ? '연결 후보가 있지만 현재 최근 목록에서는 불러오지 못했습니다.'
                    : 'Before 화면에서 참고 법 조항 후보를 만든 뒤 After에서 이어서 확인할 수 있습니다.'}
                </p>
              </div>
            ) : (
              record.bridgeRuns.map((bridgeRun, bridgeIndex) => (
                <CaseBridgeCandidate
                  key={bridgeRun.bridge_run_id}
                  bridgeRun={bridgeRun}
                  index={bridgeIndex}
                  deletingTarget={deletingTarget}
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

function CaseBridgeCandidate({
  bridgeRun,
  index,
  deletingTarget,
  onDelete,
}: {
  bridgeRun: BridgeRunHistoryItem;
  index: number;
  deletingTarget: HistoryDeleteTarget | null;
  onDelete: (target: HistoryDeleteTarget) => void;
}) {
  const displayFields = getBridgeRunHistoryDisplayFields(bridgeRun);

  return (
    <div className={styles.connectionBlock}>
      <div className={styles.connectionTop}>
        <div>
          <p className={styles.cardEyebrow}>After 연결점</p>
          <h5 className={styles.connectionTitle}>After 연결점 {index + 1}</h5>
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
          disabled={Boolean(deletingTarget)}
          onDelete={() => onDelete({ kind: 'bridge', id: bridgeRun.bridge_run_id })}
        />
      </div>

      <HistorySummaryBlock
        title="After 질문과 연결점"
        body={displayFields.connectionSummary}
        fallback="연결 요약이 없습니다."
      />

      <div className={styles.connectionGrid}>
        <HistoryIssueList label="확인된 쟁점" issues={displayFields.issueDetails} />
        <HistoryTagList label="참고할 법 조항 후보" values={displayFields.lawRefs} />
        {displayFields.recommendedNextActions.length > 0 ? (
          <div className={styles.actionBlock}>
            <p className={styles.metaLabel}>권장 다음 단계</p>
            <ul className={styles.actionList}>
              {displayFields.recommendedNextActions.map((action, actionIndex) => (
                <li key={`${bridgeRun.bridge_run_id}-action-${actionIndex}`}>
                  {formatInlineText(action, '확인 필요')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className={styles.connectionNote}>
        법적 근거 확정이 아니라 After에서 이어서 확인할 수 있는 참고 맥락입니다.
      </p>
    </div>
  );
}

function HistoryStat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <strong className={styles.statValue}>{value}</strong>
      <p className={styles.statDescription}>{description}</p>
    </div>
  );
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
    <div className={styles.summaryBlock}>
      <p className={styles.metaLabel}>{title}</p>
      <p className={styles.summaryText}>{formatInlineText(body, fallback)}</p>
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
      className={styles.deleteButton}
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

function HistoryTagList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className={styles.tagBlock}>
      <p className={styles.metaLabel}>{label}</p>
      <ul className={styles.tagList}>
        {values.map((value, index) => (
          <li className={styles.tag} key={`${label}-${value}-${index}`}>
            {formatInlineText(value, '확인 필요')}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryIssueList({
  label,
  issues,
}: {
  label: string;
  issues: BridgeIssueDisplay[];
}) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={styles.tagBlock}>
      <p className={styles.metaLabel}>{label}</p>
      <ul className={styles.issueList}>
        {issues.map((issue, index) => (
          <li className={styles.issueItem} key={`${issue.label}-${index}`}>
            <strong className={styles.issueLabel}>
              {formatInlineText(issue.label, '확인 필요')}
            </strong>
            <span className={styles.issueDescription}>
              {formatInlineText(issue.description, '추가 확인이 필요합니다.')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getScn001HistoryNotice(input: {
  firebaseConfigured: boolean;
  isAuthBusy: boolean;
  hasFirebaseSession: boolean;
  isAuthenticated: boolean;
  status: Scn001HistoryStatus;
  errorMessage: string | null;
  mutationMessage: HistoryMutationMessage | null;
  beforeJobs: BeforeReviewJobHistoryItem[];
  bridgeRuns: BridgeRunHistoryItem[];
}): {
  kind: 'notice' | 'error';
  message: string;
  canRetry: boolean;
} | null {
  if (!input.firebaseConfigured) {
    return {
      kind: 'notice',
      message: 'Firebase 설정 후 로그인하면 저장된 사건 기록을 볼 수 있습니다.',
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
        message: SCN001_HISTORY_BACKEND_AUTH_MESSAGE,
        canRetry: true,
      };
    }

    return {
      kind: 'notice',
      message: 'Google 로그인 후 저장된 사건 기록을 볼 수 있습니다.',
      canRetry: false,
    };
  }

  if (input.status === 'loading') {
    return {
      kind: 'notice',
      message: '저장된 사건 기록을 불러오는 중입니다.',
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
      message: '표시할 사건 기록이 없습니다. 완료된 검토나 연결 후보를 만든 뒤 다시 확인해주세요.',
      canRetry: true,
    };
  }

  return null;
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
    return '이 사건 기록을 목록에서 숨길까요? 숨긴 뒤 연결 후보도 기록 목록과 After 연결 후보에서 보이지 않습니다. 원문이나 식별 정보는 이 화면에 표시하지 않습니다.';
  }

  return '이 연결 후보를 목록에서 숨길까요? 숨긴 뒤 기록 목록과 After 연결 후보에서 보이지 않습니다. 원문이나 식별 정보는 이 화면에 표시하지 않습니다.';
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
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}
