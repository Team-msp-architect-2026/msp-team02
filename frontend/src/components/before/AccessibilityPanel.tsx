'use client';

import type {
  BeforeAccessibilityRecommendation,
  BeforeDisabilityType,
} from '@/types/before';

import styles from './AccessibilityPanel.module.css';

const OPTIONS: Array<{ key: BeforeDisabilityType; label: string }> = [
  { key: 'visual', label: '시각' },
  { key: 'hearing', label: '청각' },
  { key: 'mobility', label: '지체/뇌병변' },
  { key: 'cognitive', label: '발달/인지' },
  { key: 'mental', label: '정신' },
  { key: 'complex', label: '기타/복합' },
];

const DEFAULT_DISABILITY: BeforeDisabilityType = 'visual';

interface AccessibilityPanelProps {
  selectedDisability: BeforeDisabilityType | null;
  recommendation: BeforeAccessibilityRecommendation | null;
  isLoading: boolean;
  errorMessage: string | null;
  onSelectDisability: (disabilityType: BeforeDisabilityType) => void;
}

export function AccessibilityPanel({
  selectedDisability,
  recommendation,
  isLoading,
  errorMessage,
  onSelectDisability,
}: AccessibilityPanelProps) {
  const activeDisability = selectedDisability ?? DEFAULT_DISABILITY;
  const emptyStateText = selectedDisability
    ? '선택한 지원 유형의 확인 항목을 아직 표시할 수 없습니다. 표시되는 내용은 계약서 검토 결과와 선택한 지원 유형에 따라 달라질 수 있습니다.'
    : '지원 유형을 선택하면 관련 확인 항목을 보여드립니다. 표시되는 내용은 계약서 검토 결과와 선택한 지원 유형에 따라 달라질 수 있습니다.';

  return (
    <section className={styles.panel} aria-labelledby="before-accessibility-title">
      <div className={styles.header}>
        <span className={styles.badge}>Accessibility extension</span>
        <h2 id="before-accessibility-title" className={styles.title}>
          장애 관련 권리·지원 안내
        </h2>
        <p className={styles.description}>
          장애 특성으로 근무 조건 확인이나 문서 이해에 추가 지원이 필요한 경우 함께
          확인할 수 있는 항목입니다.
        </p>
      </div>

      <div className={styles.selectorBlock}>
        <p className={styles.selectorLabel}>지원 유형 선택</p>
        <div className={styles.optionRow}>
          {OPTIONS.map((option) => {
            const active = activeDisability === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectDisability(option.key)}
                aria-pressed={active}
                className={[styles.optionChip, active ? styles.optionChipActive : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.infoBox}>선택한 유형에 맞는 확인 항목을 불러오는 중입니다.</div>
      ) : null}

      {errorMessage ? <div className={styles.warningBox}>{errorMessage}</div> : null}

      {recommendation ? (
        <div className={styles.cardStack}>
          <div className={styles.overviewCard}>
            <p className={styles.overviewEyebrow}>
              {recommendation.disability_label} 확인 항목
            </p>
            <p className={styles.overviewText}>{recommendation.overview}</p>
          </div>

          {recommendation.cards.map((card) => (
            <div
              key={card.id}
              className={[
                styles.recommendationCard,
                card.kind === 'right'
                  ? styles.recommendationRight
                  : card.kind === 'support'
                    ? styles.recommendationSupport
                    : card.kind === 'question'
                      ? styles.recommendationQuestion
                      : styles.recommendationLaw,
              ].join(' ')}
            >
              <div className={styles.recommendationHeader}>
                <div>
                  <p className={styles.cardKind}>{card.kind}</p>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                </div>
                <span className={styles.cardArrow}>›</span>
              </div>
              <p className={styles.cardDescription}>{card.description}</p>
              {card.action_hint ? <p className={styles.cardHint}>{card.action_hint}</p> : null}
              <div className={styles.lawRefRow}>
                {card.law_refs.map((lawRef) => (
                  <span key={`${card.id}-${lawRef}`} className={styles.lawRef}>
                    {lawRef}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.nextStepCard}>
            <p className={styles.overviewEyebrow}>다음 단계</p>
            <p className={styles.overviewText}>
              필요한 지원 방식이 정리되면 계약서 확인 요청, 근무환경 조정 요청, 상담기관 문의
              준비에 활용할 수 있습니다.
            </p>
          </div>
        </div>
      ) : !isLoading ? (
        <div className={styles.emptyState}>
          {emptyStateText}
        </div>
      ) : null}
    </section>
  );
}
