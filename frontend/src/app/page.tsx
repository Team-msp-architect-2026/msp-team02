'use client';

import Link from 'next/link';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileEdit,
  FileSearch,
  FileText,
  FolderClock,
  LayoutDashboard,
  Link2,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  X,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

import styles from './page.module.css';

const BEFORE_GATE_LOGIN_MESSAGE =
  '계약서 분석은 Google 로그인 후 사용할 수 있습니다. 먼저 로그인해 주세요.';
const BEFORE_GATE_AUTH_CHECKING_MESSAGE = '로그인 상태를 확인하는 중입니다.';
const BEFORE_GATE_FIREBASE_CONFIG_MESSAGE =
  '계약서 분석을 사용하려면 Firebase public env 설정이 필요합니다.';
const BEFORE_GATE_BACKEND_AUTH_MESSAGE =
  '서버 인증 확인이 완료되지 않았습니다. 인증 확인 또는 다시 로그인 후 이용해 주세요.';
const PEOPLE_IMAGE_FOREIGN_WORKER =
  'data:image/webp;base64,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';
const PEOPLE_IMAGE_PART_TIMER =
  'data:image/webp;base64,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';
const PEOPLE_IMAGE_DISABLED_WORKER =
  'data:image/webp;base64,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';

type BeforeGateHandler = () => void;

interface BeforeGateButtonProps {
  children: ReactNode;
  className?: string;
  onBeforeGate: BeforeGateHandler;
}

function BeforeGateButton({ children, className, onBeforeGate }: BeforeGateButtonProps) {
  return (
    <button
      type="button"
      className={[styles.beforeGateAction, className].filter(Boolean).join(' ')}
      onClick={onBeforeGate}
    >
      {children}
    </button>
  );
}

interface TopNavProps {
  onBeforeGate: BeforeGateHandler;
  onLoginAction: () => void;
  onLogout: () => void;
  loginLabel: string;
  isAuthBusy: boolean;
  isBackendAuthenticated: boolean;
  authErrorMessage: string | null;
}

function TopNav({
  onBeforeGate,
  onLoginAction,
  onLogout,
  loginLabel,
  isAuthBusy,
  isBackendAuthenticated,
  authErrorMessage,
}: TopNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className={`${styles.navbar} ${isScrolled ? styles.navbarScrolled : ''}`}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand} onClick={closeMenu} aria-label="법대로 AI 홈">
          <span className={styles.brandMark} aria-hidden="true">
            법
          </span>
          <span className={styles.brandText}>법대로 AI</span>
        </Link>

        <div className={styles.navSectionLinks} aria-label="페이지 섹션">
          <a href="#capabilities">서비스</a>
          <a href="#workflow">흐름</a>
          <a href="#audience">대상</a>
        </div>

        <div className={styles.navActions} aria-label="계정과 시작">
          {isBackendAuthenticated ? (
            <div className={styles.navAuthCompact} aria-label="로그인 상태">
              <span className={styles.navAuthStatus}>로그인됨</span>
              <button type="button" className={styles.navSignOut} onClick={onLogout}>
                로그아웃
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.navLogin}
              onClick={onLoginAction}
              disabled={isAuthBusy}
              aria-busy={isAuthBusy}
            >
              {loginLabel}
            </button>
          )}
          <BeforeGateButton className={styles.navPrimary} onBeforeGate={onBeforeGate}>
            계약서 검토 시작하기
            <ArrowRight size={17} aria-hidden="true" />
          </BeforeGateButton>
        </div>

        <button
          className={styles.mobileMenuButton}
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={isMenuOpen}
          type="button"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className={styles.mobileMenu}>
          <a href="#capabilities" onClick={closeMenu}>
            서비스
          </a>
          <a href="#workflow" onClick={closeMenu}>
            흐름
          </a>
          <a href="#audience" onClick={closeMenu}>
            대상
          </a>
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onLoginAction();
            }}
            disabled={isAuthBusy || isBackendAuthenticated}
            aria-busy={isAuthBusy}
          >
            {isBackendAuthenticated ? '로그인됨' : loginLabel}
          </button>
          {isBackendAuthenticated ? (
            <button
              type="button"
              className={styles.mobileSignOut}
              onClick={() => {
                closeMenu();
                onLogout();
              }}
            >
              로그아웃
            </button>
          ) : null}
          <BeforeGateButton
            onBeforeGate={() => {
              closeMenu();
              onBeforeGate();
            }}
          >
            계약서 검토 시작하기
          </BeforeGateButton>
        </div>
      ) : null}

      {authErrorMessage ? (
        <div className={styles.navAuthMessage} role="status">
          <span>{authErrorMessage}</span>
        </div>
      ) : null}
    </nav>
  );
}

interface HeroProps {
  onBeforeGate: BeforeGateHandler;
  noticeMessage: string | null;
  onLoginAction: () => void;
  gateMessageRef: RefObject<HTMLDivElement | null>;
}

function Hero({ onBeforeGate, noticeMessage, onLoginAction, gateMessageRef }: HeroProps) {
  return (
    <section id="start" className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>한국어 노동법 특화 AI</p>
            <h1 id="hero-heading" className={styles.heroTitle}>
              계약서 한 장으로,
              <span>위험 조항부터 다음 대응까지.</span>
            </h1>
            <p className={styles.heroDescription}>
              근로계약서를 올리면 위험 의심 조항과 누락 정보를 표시하고, 관련 노동법
              후보 조항과 질문·초안 흐름으로 이어갑니다.
            </p>
            <div className={styles.heroActions}>
              <BeforeGateButton className={styles.primaryButton} onBeforeGate={onBeforeGate}>
                계약서 검토 시작하기
                <ArrowRight size={18} aria-hidden="true" />
              </BeforeGateButton>
              <Link href="/after" className={styles.secondaryButton}>
                After에서 질문하기
              </Link>
            </div>
            <p className={styles.heroDisclaimer}>
              참고용 후보 조항을 제공하며, 최종 법률 판단이 아닙니다.
            </p>
            <div ref={gateMessageRef} className={styles.heroGateTarget} tabIndex={-1}>
              {noticeMessage ? (
                <BeforeGateNotice noticeMessage={noticeMessage} onLoginAction={onLoginAction} />
              ) : null}
            </div>
          </div>

          <ProductMock />
        </div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className={styles.productMock} aria-label="법대로 AI 제품 화면 예시">
      <aside className={styles.mockRail} aria-label="제품 내 작업 메뉴 예시">
        <div className={styles.mockRailBrand}>
          <span className={styles.mockRailMark}>법</span>
          <strong>법대로 AI</strong>
        </div>
        <div className={styles.mockRailNew}>
          <Plus size={14} aria-hidden="true" />
          새 검토 시작
        </div>
        <div className={styles.mockRailItem}>
          <LayoutDashboard size={15} aria-hidden="true" />
          대시보드
        </div>
        <div className={`${styles.mockRailItem} ${styles.mockRailItemActive}`}>
          <FileSearch size={15} aria-hidden="true" />
          계약서 검토
        </div>
        <div className={styles.mockRailItem}>
          <BookOpen size={15} aria-hidden="true" />
          법령 후보
        </div>
        <div className={styles.mockRailItem}>
          <FileEdit size={15} aria-hidden="true" />
          문서 초안
        </div>
        <div className={styles.mockRailItem}>
          <FolderClock size={15} aria-hidden="true" />
          사건 기록
        </div>
        <div className={styles.mockRailItem}>
          <Settings size={15} aria-hidden="true" />
          설정
        </div>
      </aside>

      <main className={styles.mockMain} aria-label="계약서 검토 예시">
        <div className={styles.mockHeader}>
          <h2>근로계약서 검토</h2>
          <div className={styles.mockTabs} aria-hidden="true">
            <span className={styles.mockTabActive}>검토 결과</span>
            <span>법령 후보</span>
            <span>AI 상담</span>
          </div>
        </div>

        <div className={styles.mockSummary}>
          <span className={styles.summaryRisk}>위험 의심 2건</span>
          <span className={styles.summaryWarn}>누락 정보 1건</span>
          <span className={styles.summaryOk}>확인 완료 4건</span>
        </div>

        <article className={styles.mockDocument}>
          <div className={styles.mockDocMeta}>
            <span className={styles.mockDocFile}>
              <FileText size={13} aria-hidden="true" />
              근로계약서.pdf
            </span>
            <span className={styles.mockDocTools}>
              <span>1 / 2</span>
              <FileSearch size={13} aria-hidden="true" />
              <ClipboardCheck size={13} aria-hidden="true" />
            </span>
          </div>
          <div className={styles.mockDocBody}>
            <h2>제3조 (근로시간 및 휴게)</h2>
            <p>
              근로시간은 1일 8시간, 1주 40시간을 원칙으로 한다. 단, 회사의 사정에
              따라
              <mark className={styles.highlightRisk}>
                별도의 동의 없이 주 12시간을 초과하는 연장근로를 명할 수 있다
                <span>R1</span>
              </mark>
              .
            </p>
            <p>
              <mark className={styles.highlightOk}>
                휴게시간은 4시간 근로 시 30분, 8시간 근로 시 1시간 이상 부여한다
              </mark>
              .
            </p>
            <h2>제4조 (임금 및 수당)</h2>
            <p>
              월 기본급은 1,950,000원으로 한다.
              <mark className={styles.highlightWarn}>
                수당 항목과 산정 방식은 별도 고지한다
                <span>M2</span>
              </mark>
              .
            </p>
          </div>
          <div className={styles.mockDocFooter}>
            <span>AI 요약 보기</span>
            <span>
              하이라이트 필터 <strong>ON</strong>
            </span>
          </div>
        </article>

        <div className={styles.mockReviewRows} aria-label="검토 결과 추가 요약 예시">
          <article className={styles.mockReviewRowRisk}>
            <span>R2</span>
            <div>
              <strong>임금 지급 시기 변경 조항</strong>
              <p>정해진 지급일이 임의로 바뀔 수 있는지 확인합니다.</p>
            </div>
          </article>
          <article className={styles.mockReviewRowInfo}>
            <span>Next</span>
            <div>
              <strong>After 질문으로 이어가기</strong>
              <p>수당 산정 방식과 지급 조건을 질문으로 정리합니다.</p>
            </div>
          </article>
        </div>
      </main>

      <aside className={styles.mockContext} aria-label="검토 결과와 후보 조항 예시">
        <div className={styles.mockFindingActive}>
          <div className={styles.mockFindingHeader}>
            <span className={styles.findingPillRisk}>위험 의심 · R1</span>
            <strong>연장근로 한도 초과 가능성</strong>
          </div>
          <div className={styles.mockFindingBody}>
            <p>당사자 합의와 1주 12시간 한도를 다시 확인해야 합니다.</p>
            <div className={styles.mockReference}>
              <span>근로기준법 제53조</span>
              <em>후보</em>
            </div>
            <div className={styles.mockReference}>
              <span>근로기준법 제56조</span>
              <em>후보</em>
            </div>
          </div>
        </div>
        <div className={`${styles.mockFinding} ${styles.mockFindingMissing}`}>
          <span className={styles.findingPillWarn}>누락 정보 · M2</span>
          <strong>수당 항목 명시 부족</strong>
          <p>구성과 계산 방법을 확인해 주세요.</p>
          <span className={styles.mockActionButton}>
            관련 수당 가이드 보기
            <ChevronRight size={13} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.mockContextSummary}>
          <strong>다음 단계 요약</strong>
          <p>확인한 쟁점을 저장하고, 필요한 질문만 After에서 이어갑니다.</p>
          <span className={styles.mockActionButton}>
            다음 단계로 이동
            <ChevronRight size={13} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.mockNextAction}>
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>제출 전 사실관계를 확인해 주세요.</span>
        </div>
      </aside>
    </div>
  );
}

function Capabilities() {
  const items = [
    {
      icon: <FileSearch size={24} aria-hidden="true" />,
      title: '계약서 검토',
      description:
        '근로계약서에서 위험 의심 조항, 누락 정보, 추가 확인이 필요한 내용을 분리해 보여줍니다.',
      points: ['위험·누락 항목 표시', '문서 조항 단위 요약', '확인 필요 문구 안내'],
    },
    {
      icon: <Link2 size={24} aria-hidden="true" />,
      title: '법령 후보 연결',
      description:
        '검토 결과나 질문과 관련될 수 있는 노동법 조항을 후보로 연결하고 참고용임을 명확히 표시합니다.',
      points: ['후보 조항 근거 표시', '검색되지 않은 조문 배제', '최종 판단 아님 고지'],
    },
    {
      icon: <FileEdit size={24} aria-hidden="true" />,
      title: '질문·초안 흐름',
      description:
        'After에서 노동법 질문을 정리하고, 지원되는 흐름에서는 검토용 문서 초안으로 이어갑니다.',
      points: ['After는 로그인 없이 사용', '지원 문서만 초안 허용', '사실관계 재확인 안내'],
    },
  ];

  return (
    <section id="capabilities" className={styles.capabilities} aria-labelledby="capabilities-heading">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Capabilities</p>
          <h2 id="capabilities-heading">검토, 후보 조항, 다음 문서 준비를 한 흐름으로.</h2>
          <p>
            기능을 늘어놓기보다 사건 흐름에 필요한 정보만 보수적으로 보여주도록 구성했습니다.
          </p>
        </div>
        <div className={styles.capabilityGrid}>
          {items.map((item) => (
            <article className={styles.capabilityCard} key={item.title}>
              <span className={styles.cardIcon}>{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <ul>
                {item.points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      label: '01 · Before',
      title: '계약서 업로드',
      description: '로그인 확인 후 계약서를 올리고 위험·누락 항목을 검토합니다.',
      icon: <FileText size={24} aria-hidden="true" />,
    },
    {
      label: '02 · Bridge',
      title: '후보 조항 연결',
      description: '검토 결과를 관련될 수 있는 노동법 후보 조항과 연결합니다.',
      icon: <Link2 size={24} aria-hidden="true" />,
    },
    {
      label: '03 · After',
      title: '질문과 초안',
      description: '로그인 없이 질문할 수 있고, 허용된 경우 검토용 초안으로 이어집니다.',
      icon: <MessageSquare size={24} aria-hidden="true" />,
    },
    {
      label: '04 · History',
      title: '기록 다시 열기',
      description: '로그인 확인이 끝난 사용자는 저장된 사건 기록을 다시 확인합니다.',
      icon: <FolderClock size={24} aria-hidden="true" />,
    },
  ];

  return (
    <section id="workflow" className={styles.workflow} aria-labelledby="workflow-heading">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Workflow</p>
          <h2 id="workflow-heading">Before에서 After까지 이어지는 네 단계.</h2>
          <p>
            계약서 검토와 질문 답변은 분리된 화면이지만, 같은 사건 맥락을 잃지 않도록
            이어집니다.
          </p>
        </div>
        <div className={styles.workflowGrid}>
          {steps.map((step, index) => (
            <article className={styles.workflowStep} key={step.label}>
              <span className={styles.workflowIcon}>{step.icon}</span>
              <span className={styles.workflowLabel}>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < steps.length - 1 ? (
                <ChevronRight className={styles.workflowArrow} size={18} aria-hidden="true" />
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const audiences = [
    {
      title: '근로계약서를 처음 받아본 외국인 근로자',
      description: '숙소·공제 기준, 필수 근로조건, 표준계약서 여부를 먼저 확인하고 싶을 때.',
      imageSrc: PEOPLE_IMAGE_FOREIGN_WORKER,
      imageAlt: '근로계약서를 처음 받아본 외국인 근로자 대상 안내 이미지',
      label: '계약 확인',
      ctaLabel: '외국인 근로자 사례 보기',
      href: '/before?example=sen0',
    },
    {
      title: '임금·해고 문제를 정리해야 하는 아르바이트 근로자',
      description: '임금 지급, 해고 통보, 근무시간 쟁점을 차분히 정리하고 싶을 때.',
      imageSrc: PEOPLE_IMAGE_PART_TIMER,
      imageAlt: '임금과 해고 문제를 정리해야 하는 아르바이트 근로자 대상 안내 이미지',
      label: '임금·해고',
      ctaLabel: '아르바이트 사례 보기',
      href: '/before?example=sen1',
    },
    {
      title: '장애 특성을 반영한 안내가 필요한 근로자',
      description: '근무환경 조정, 지원 요청, 관련 권리 안내를 함께 확인하고 싶을 때.',
      imageSrc: PEOPLE_IMAGE_DISABLED_WORKER,
      imageAlt: '장애 특성을 반영한 안내가 필요한 근로자 대상 안내 이미지',
      label: '지원 안내',
      ctaLabel: '장애인 근로자 사례 보기',
      href: '/before?example=sen2',
    },
  ];

  return (
    <section
      id="audience"
      className={styles.audienceSection}
      aria-labelledby="audience-heading"
    >
      <div className={styles.container}>
        <div className={styles.audienceHeader}>
          <p className={styles.sectionEyebrow}>Use cases</p>
          <h2 id="audience-heading">이런 분들께 도움이 됩니다</h2>
        </div>

        <div className={styles.audienceGrid}>
          {audiences.map((audience) => (
            <article className={styles.audienceCard} key={audience.title}>
              <div className={styles.audienceMedia}>
                <img
                  className={styles.audienceImage}
                  src={audience.imageSrc}
                  alt={audience.imageAlt}
                />
              </div>
              <div className={styles.audienceText}>
                <span className={styles.audienceBadge}>{audience.label}</span>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
                <Link href={audience.href} className={styles.audienceAction}>
                  {audience.ctaLabel}
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}

interface BeforeGateNoticeProps {
  noticeMessage: string;
  onLoginAction: () => void;
}

function BeforeGateNotice({ noticeMessage, onLoginAction }: BeforeGateNoticeProps) {
  return (
    <div className={styles.beforeGateNotice} role="alert">
      <div className={styles.beforeGateNoticeContent}>
        <AlertCircle className={styles.beforeGateNoticeIcon} size={20} aria-hidden="true" />
        <p>{noticeMessage}</p>
      </div>
      <button className={styles.beforeGateNoticeAction} type="button" onClick={onLoginAction}>
        Google로 로그인
      </button>
    </div>
  );
}

interface FooterProps {
  onBeforeGate: BeforeGateHandler;
  showHistoryLink: boolean;
}

function Footer({ onBeforeGate, showHistoryLink }: FooterProps) {
  return (
    <footer id="resources" className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div>
            <Link href="/" className={styles.footerBrand} aria-label="법대로 AI 홈">
              <span className={styles.footerBrandMark} aria-hidden="true">
                법
              </span>
              <span>법대로 AI</span>
            </Link>
            <p>
              근로계약서 검토, 노동법 질문, 사건 기록을 이어 주는 참고용 작업
              공간입니다.
            </p>
          </div>
          <nav className={styles.footerLinks} aria-label="하단 주요 화면">
            <a href="#capabilities">기능</a>
            <a href="#workflow">흐름</a>
            {showHistoryLink ? <Link href="/history">History</Link> : null}
            <BeforeGateButton onBeforeGate={onBeforeGate}>Before</BeforeGateButton>
            <Link href="/after">After</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>KR / EN</span>
          <span>본 서비스는 법률 자문이 아닌 참고용 정보를 제공합니다.</span>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const router = useRouter();
  const {
    firebaseConfigured,
    firebaseUser,
    backendUser,
    isInitializing,
    isSigningIn,
    isCheckingBackend,
    errorMessage,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const gateMessageRef = useRef<HTMLDivElement | null>(null);
  const [beforeGateMessage, setBeforeGateMessage] = useState<string | null>(null);
  const authBusy = isInitializing || isSigningIn || isCheckingBackend;
  const isBackendAuthenticated = backendUser.logged_in;
  const isNavLoginBusy = isSigningIn || Boolean(firebaseUser && isCheckingBackend);
  const loginLabel = isSigningIn
    ? '로그인 중...'
    : firebaseUser && isCheckingBackend
      ? '확인 중...'
      : '로그인';

  const startGoogleLogin = useCallback(() => {
    void signInWithGoogle();
  }, [signInWithGoogle]);

  const handleLogout = useCallback(() => {
    void signOut();
  }, [signOut]);

  const focusGateMessage = useCallback(() => {
    window.requestAnimationFrame(() => {
      gateMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      gateMessageRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const handleBeforeGate = useCallback(() => {
    if (!firebaseConfigured) {
      setBeforeGateMessage(BEFORE_GATE_FIREBASE_CONFIG_MESSAGE);
      focusGateMessage();
      return;
    }

    if (authBusy) {
      setBeforeGateMessage(BEFORE_GATE_AUTH_CHECKING_MESSAGE);
      focusGateMessage();
      return;
    }

    if (!firebaseUser) {
      setBeforeGateMessage(BEFORE_GATE_LOGIN_MESSAGE);
      focusGateMessage();
      void signInWithGoogle();
      return;
    }

    if (!isBackendAuthenticated) {
      setBeforeGateMessage(BEFORE_GATE_BACKEND_AUTH_MESSAGE);
      focusGateMessage();
      return;
    }

    setBeforeGateMessage(null);
    router.push('/before');
  }, [
    authBusy,
    firebaseConfigured,
    firebaseUser,
    focusGateMessage,
    isBackendAuthenticated,
    router,
    signInWithGoogle,
  ]);

  useEffect(() => {
    if (firebaseUser && isBackendAuthenticated && !authBusy) {
      setBeforeGateMessage(null);
    }
  }, [authBusy, firebaseUser, isBackendAuthenticated]);

  return (
    <div className={styles.page}>
      <TopNav
        onBeforeGate={handleBeforeGate}
        onLoginAction={startGoogleLogin}
        onLogout={handleLogout}
        loginLabel={isBackendAuthenticated ? '로그인됨' : loginLabel}
        isAuthBusy={isNavLoginBusy}
        isBackendAuthenticated={isBackendAuthenticated}
        authErrorMessage={errorMessage}
      />
      <Hero
        onBeforeGate={handleBeforeGate}
        noticeMessage={beforeGateMessage}
        onLoginAction={startGoogleLogin}
        gateMessageRef={gateMessageRef}
      />
      <Capabilities />
      <Workflow />
      <AudienceSection />
      <Footer onBeforeGate={handleBeforeGate} showHistoryLink={isBackendAuthenticated} />
    </div>
  );
}
