'use client';

import { useEffect, useRef } from 'react';

import { Scn001HistoryManager } from '@/components/history/Scn001HistoryManager';
import { Masthead } from '@/components/layout/Masthead';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { SkipLink } from '@/components/ui/SkipLink';
import { useAuth } from '@/context/AuthContext';

import styles from './page.module.css';

export default function HistoryPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { backendUser, firebaseConfigured, isCheckingBackend, isInitializing } = useAuth();
  const isAuthChecking = isInitializing || isCheckingBackend;
  const historyStatusLabel = getHistoryStatusLabel({
    firebaseConfigured,
    isAuthChecking,
    isLoggedIn: backendUser.logged_in,
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      headingRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <>
      <SkipLink links={[{ href: '#history-main', label: '본문으로 건너뛰기' }]} />
      <Masthead />
      <main id="history-main" className={styles.main} tabIndex={-1}>
        <div className={styles.workspaceShell}>
          <WorkspaceSidebar
            activeItem="history"
            ariaLabel="사건 기록 메뉴"
            reserveActionSlot
            summary={
              <>
                <span>Case workspace</span>
                <strong>사건 기록</strong>
                <p>완료된 검토와 상담 연결 후보만 안전한 표시 범위로 확인합니다.</p>
              </>
            }
          />

          <section className={styles.historyWorkspace} aria-labelledby="history-title">
            <header className={styles.workspaceHeader}>
              <div className={styles.workspaceHeaderCopy}>
                <h1 id="history-title" ref={headingRef} tabIndex={-1} className={styles.title}>
                  사건 기록
                </h1>
                <p className={styles.lead}>
                  계약서 검토와 AI 법률 상담 기록을 확인합니다.
                </p>
              </div>
            </header>

            <div className={styles.historyContent}>
              <Scn001HistoryManager />
            </div>
          </section>

          <aside className={styles.contextPanel} aria-label="기록 요약">
            <div className={styles.contextHeader}>
              <p className={styles.contextEyebrow}>HISTORY CONTEXT</p>
              <h2>기록 요약</h2>
            </div>

            <section className={styles.contextStatusCard} aria-label="기록 상태">
              <span>{historyStatusLabel.eyebrow}</span>
              <strong>{historyStatusLabel.title}</strong>
              <p>{historyStatusLabel.description}</p>
            </section>

            <section className={styles.contextNotice} aria-label="표시 범위 안내">
              <strong>보관 정책</strong>
              <p>
                계약서 검토와 AI 법률 상담 기록을 한곳에서 확인합니다. 내부 식별자와
                인증 정보는 화면에 표시하지 않습니다.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

function getHistoryStatusLabel({
  firebaseConfigured,
  isAuthChecking,
  isLoggedIn,
}: {
  firebaseConfigured: boolean;
  isAuthChecking: boolean;
  isLoggedIn: boolean;
}) {
  if (!firebaseConfigured) {
    return {
      eyebrow: '설정 필요',
      title: '로그인 설정 확인 필요',
      description: '저장된 기록을 보려면 Firebase public env 설정이 필요합니다.',
    };
  }

  if (isAuthChecking) {
    return {
      eyebrow: '확인 중',
      title: '로그인 상태 확인 중',
      description: '저장된 사건 기록을 불러올 수 있는지 확인하고 있습니다.',
    };
  }

  if (!isLoggedIn) {
    return {
      eyebrow: '로그인 필요',
      title: 'Google 로그인 후 확인',
      description: '저장된 계약서 검토와 상담 연결 기록은 로그인 후 표시됩니다.',
    };
  }

  return {
    eyebrow: '기록 확인 가능',
    title: '저장된 사건 기록',
    description: '완료된 검토와 상담 연결 후보만 안전한 표시 범위로 확인합니다.',
  };
}
