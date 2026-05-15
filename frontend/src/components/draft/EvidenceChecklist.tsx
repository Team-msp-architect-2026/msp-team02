'use client';

import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';

import styles from './EvidenceChecklist.module.css';

interface EvidenceChecklistProps {
  items: string[];
}

type DraftEvidenceStatus = 'needed' | 'available' | 'collectible' | 'uncertain';

const STATUS_LABELS: Record<DraftEvidenceStatus, string> = {
  needed: '준비 필요',
  available: '보유',
  collectible: '수집 가능',
  uncertain: '확인 필요',
};

const STATUS_OPTIONS: DraftEvidenceStatus[] = [
  'needed',
  'available',
  'collectible',
  'uncertain',
];

function createInitialStatuses(itemCount: number): DraftEvidenceStatus[] {
  return Array.from({ length: itemCount }, () => 'needed');
}

export function EvidenceChecklist({ items }: EvidenceChecklistProps) {
  const idPrefix = useId();
  const itemSignature = useMemo(() => items.join('\u001f'), [items]);
  const [statuses, setStatuses] = useState<DraftEvidenceStatus[]>(() =>
    createInitialStatuses(items.length),
  );

  useEffect(() => {
    setStatuses(createInitialStatuses(items.length));
  }, [itemSignature]);

  const itemStatuses = items.map((_, itemIndex) => statuses[itemIndex] ?? 'needed');
  const available = itemStatuses.filter((status) => status === 'available').length;
  const collectible = itemStatuses.filter((status) => status === 'collectible').length;
  const remaining = items.length - available - collectible;

  function updateStatus(itemIndex: number, nextStatus: DraftEvidenceStatus) {
    setStatuses((currentStatuses) =>
      items.map((_, currentIndex) =>
        currentIndex === itemIndex ? nextStatus : currentStatuses[currentIndex] ?? 'needed',
      ),
    );
  }

  function handleCheckboxChange(itemIndex: number, checked: boolean) {
    updateStatus(itemIndex, checked ? 'available' : 'needed');
  }

  function handleStatusChange(
    itemIndex: number,
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    updateStatus(itemIndex, event.target.value as DraftEvidenceStatus);
  }

  return (
    <section className={styles.panel} aria-labelledby="evidence-checklist-title">
      <h2 id="evidence-checklist-title" className={styles.title}>
        증거 체크리스트
      </h2>
      {items.length > 0 ? (
        <fieldset className={styles.fieldset} aria-describedby="evidence-checklist-progress">
          <legend className={styles.legend}>증거 체크리스트 상태</legend>
          <p
            id="evidence-checklist-progress"
            className={styles.progressSummary}
            aria-live="polite"
          >
            준비 완료 {available} / {items.length} · 수집 필요 {collectible} · 확인 필요{' '}
            {remaining}
          </p>
          <ul className={styles.list}>
            {items.map((item, itemIndex) => {
              const status = itemStatuses[itemIndex];
              const checkboxId = `${idPrefix}-checkbox-${itemIndex}`;
              const labelId = `${idPrefix}-label-${itemIndex}`;
              const selectId = `${idPrefix}-status-${itemIndex}`;
              const rowStateClass =
                status === 'available'
                  ? styles.rowAvailable
                  : status === 'collectible'
                    ? styles.rowCollectible
                    : '';

              return (
                <li
                  key={`${itemIndex}-${item}`}
                  className={[styles.row, rowStateClass].filter(Boolean).join(' ')}
                >
                  <div className={styles.itemMain}>
                    <label className={styles.checkboxLabel} htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        className={styles.checkbox}
                        checked={status === 'available'}
                        onChange={(event) =>
                          handleCheckboxChange(itemIndex, event.target.checked)
                        }
                        aria-label={`증거 보유: ${item}`}
                      />
                      <span className={styles.checkboxText}>보유</span>
                    </label>
                    <span id={labelId} className={styles.evidenceLabel}>
                      {item}
                    </span>
                  </div>
                  <div className={styles.statusControl}>
                    <label className={styles.statusLabel} htmlFor={selectId}>
                      상태
                    </label>
                    <select
                      id={selectId}
                      className={styles.statusSelect}
                      value={status}
                      onChange={(event) => handleStatusChange(itemIndex, event)}
                      aria-label={`증거 상태 선택: ${item}`}
                      aria-describedby={labelId}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {STATUS_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <p className={styles.emptyText}>표시할 증거 체크리스트가 없습니다.</p>
      )}
    </section>
  );
}
