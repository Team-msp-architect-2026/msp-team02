'use client';

import { AlertCircle, CheckCircle2, LogIn, LogOut, RefreshCw } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

import styles from './LoginButton.module.css';

export function LoginButton() {
  const {
    firebaseConfigured,
    missingFirebaseConfig,
    firebaseUser,
    backendUser,
    isInitializing,
    isSigningIn,
    isCheckingBackend,
    errorMessage,
    signInWithGoogle,
    signOut,
    refreshBackendAuth,
    clearError,
  } = useAuth();
  const isBusy = isInitializing || isSigningIn || isCheckingBackend;
  const isBackendVerified = backendUser.logged_in;
  const hasFirebaseSession = Boolean(firebaseUser);
  const accountStatusMessage = getAccountStatusMessage({
    hasFirebaseSession,
    isBackendVerified,
  });
  const panelClassName = [
    styles.panel,
    isBackendVerified ? styles.panelVerified : styles.panelNeedsLogin,
  ].join(' ');

  return (
    <div className={panelClassName}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{isBackendVerified ? 'Account ready' : 'Account'}</p>
          <h2 className={styles.title}>
            {isBackendVerified ? '로그인됨 / 기록 사용 가능' : 'Google 로그인 확인'}
          </h2>
          <p className={styles.description}>
            {isBackendVerified
              ? 'History, Before, After를 같은 사건 흐름으로 이어볼 수 있습니다.'
              : '로그인하면 Before 분석 기록과 Bridge 연결을 저장하고 다시 이어볼 수 있습니다.'}
          </p>
        </div>
        <StatusPill loggedIn={isBackendVerified} isBusy={isBusy} />
      </div>

      <div className={styles.actions}>
        {!firebaseConfigured ? (
          <button
            className={styles.primaryAction}
            type="button"
            disabled
            title="NEXT_PUBLIC_FIREBASE_* 환경변수를 설정해야 합니다."
          >
            <LogIn size={18} aria-hidden="true" />
            Firebase 설정 필요
          </button>
        ) : firebaseUser ? (
          <>
            <button
              className={styles.secondaryAction}
              type="button"
              disabled={isBusy}
              onClick={() => void refreshBackendAuth({ forceRefresh: true })}
            >
              <RefreshCw size={18} aria-hidden="true" />
              인증 확인
            </button>
            <button
              className={styles.secondaryAction}
              type="button"
              disabled={isBusy}
              onClick={() => void signOut()}
            >
              <LogOut size={18} aria-hidden="true" />
              로그아웃
            </button>
          </>
        ) : (
          <button
            className={styles.primaryAction}
            type="button"
            disabled={isBusy}
            onClick={() => void signInWithGoogle()}
          >
            <LogIn size={18} aria-hidden="true" />
            {isSigningIn ? '로그인 중...' : 'Google로 로그인'}
          </button>
        )}
      </div>

      {!isBackendVerified ? (
        <div className={styles.statusGrid} aria-label="인증 상태">
          <StatusItem
            label="Google"
            value={firebaseConfigured ? (hasFirebaseSession ? '로그인됨' : '로그아웃') : '설정 필요'}
          />
          <StatusItem
            label="서버 확인"
            value={hasFirebaseSession ? '확인 필요' : '로그인 후 확인'}
          />
          <StatusItem label="기록" value="로그인 후 사용" />
        </div>
      ) : null}

      {accountStatusMessage ? (
        <p className={styles.accountLine}>{accountStatusMessage}</p>
      ) : null}

      {!firebaseConfigured ? (
        <div className={styles.configNotice} role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>Firebase public env 설정 필요: {missingFirebaseConfig.join(', ')}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{errorMessage}</span>
          <button type="button" onClick={clearError} aria-label="오류 메시지 닫기">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface StatusPillProps {
  loggedIn: boolean;
  isBusy: boolean;
}

function StatusPill({ loggedIn, isBusy }: StatusPillProps) {
  if (isBusy) {
    return <span className={styles.pendingPill}>확인 중</span>;
  }

  if (loggedIn) {
    return (
      <span className={styles.successPill}>
        <CheckCircle2 size={16} aria-hidden="true" />
        확인 완료
      </span>
    );
  }

  return <span className={styles.neutralPill}>로그아웃</span>;
}

interface StatusItemProps {
  label: string;
  value: string;
}

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div className={styles.statusItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getAccountStatusMessage({
  hasFirebaseSession,
  isBackendVerified,
}: {
  hasFirebaseSession: boolean;
  isBackendVerified: boolean;
}): string | null {
  if (isBackendVerified) {
    return 'Google 로그인과 서버 확인이 완료되어 기록을 사용할 수 있습니다.';
  }

  if (hasFirebaseSession) {
    return 'Google 로그인됨. 기록 사용 전 서버 확인이 필요합니다.';
  }

  return null;
}
