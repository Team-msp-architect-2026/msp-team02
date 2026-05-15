'use client';

import type {
  EvidenceItemInput,
  EvidenceStatus,
  EvidenceType,
  TimelineInput,
} from '@/types/api';

import styles from './EvidenceSection.module.css';

interface EvidenceSectionProps {
  evidenceItems: EvidenceItemRow[];
  incidentTimeline: TimelineRow[];
  disabled?: boolean;
  onEvidenceItemsChange: (items: EvidenceItemRow[]) => void;
  onIncidentTimelineChange: (items: TimelineRow[]) => void;
}

const evidenceTypeOptions: Array<{ value: EvidenceType; label: string }> = [
  { value: 'message', label: '메신저 대화' },
  { value: 'sms', label: '문자' },
  { value: 'email', label: '이메일' },
  { value: 'paystub', label: '급여명세서' },
  { value: 'bank_statement', label: '급여 입금 내역' },
  { value: 'employment_contract', label: '근로계약서' },
  { value: 'attendance_record', label: '출퇴근 기록' },
  { value: 'work_schedule', label: '근무표' },
  { value: 'recording', label: '녹음' },
  { value: 'photo', label: '사진' },
  { value: 'memo', label: '메모' },
];

const evidenceStatusOptions: Array<{ value: EvidenceStatus; label: string }> = [
  { value: 'available', label: '확보함' },
  { value: 'needs_collection', label: '확보 필요' },
  { value: 'unknown', label: '모름' },
];

export type EvidenceItemRow = EvidenceItemInput & { ui_id: string };
export type TimelineRow = TimelineInput & { ui_id: string };

let nextRowId = 0;

export function createEmptyEvidenceItem(): EvidenceItemRow {
  return {
    ui_id: createRowId('evidence'),
    type: null,
    description: '',
    status: 'unknown',
  };
}

export function createEmptyTimelineEvent(): TimelineRow {
  return {
    ui_id: createRowId('timeline'),
    date: null,
    event: '',
    evidence_refs: [],
  };
}

export function ensureEvidenceRowIds(items: EvidenceItemInput[]): EvidenceItemRow[] {
  const sourceItems = items.length > 0 ? items : [createEmptyEvidenceItem()];

  return sourceItems.map((item) =>
    hasUiId(item) ? item : { ...item, ui_id: createRowId('evidence') },
  );
}

export function ensureTimelineRowIds(items: TimelineInput[]): TimelineRow[] {
  const sourceItems = items.length > 0 ? items : [createEmptyTimelineEvent()];

  return sourceItems.map((item) =>
    hasUiId(item) ? item : { ...item, ui_id: createRowId('timeline') },
  );
}

export function EvidenceSection({
  evidenceItems,
  incidentTimeline,
  disabled = false,
  onEvidenceItemsChange,
  onIncidentTimelineChange,
}: EvidenceSectionProps) {
  const normalizedEvidenceItems =
    evidenceItems.length > 0 ? evidenceItems : [createEmptyEvidenceItem()];
  const normalizedTimeline =
    incidentTimeline.length > 0 ? incidentTimeline : [createEmptyTimelineEvent()];

  function updateEvidenceItem(index: number, patch: EvidenceItemInput) {
    onEvidenceItemsChange(
      normalizedEvidenceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeEvidenceItem(index: number) {
    const nextItems = normalizedEvidenceItems.filter((_, itemIndex) => itemIndex !== index);
    onEvidenceItemsChange(nextItems.length > 0 ? nextItems : [createEmptyEvidenceItem()]);
  }

  function updateTimelineEvent(index: number, patch: TimelineInput) {
    onIncidentTimelineChange(
      normalizedTimeline.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeTimelineEvent(index: number) {
    const nextItems = normalizedTimeline.filter((_, itemIndex) => itemIndex !== index);
    onIncidentTimelineChange(nextItems.length > 0 ? nextItems : [createEmptyTimelineEvent()]);
  }

  return (
    <section className={styles.section} aria-labelledby="evidence-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>선택 입력</p>
          <h2 id="evidence-title" className={styles.title}>
            사건 경위와 증거 목록
          </h2>
        </div>
        <p className={styles.helper}>빈 행은 초안 생성 전에 자동으로 제외됩니다.</p>
      </div>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="timeline-section-title"
      >
        <div id="timeline-section-title" className={styles.legend}>
          사건 경위
        </div>
        <div className={styles.rows}>
          {normalizedTimeline.map((item, index) => (
            <div className={styles.timelineRow} key={item.ui_id}>
              <label className={styles.field}>
                <span className={styles.label}>일자</span>
                <input
                  className={styles.input}
                  type="date"
                  value={item.date ?? ''}
                  onChange={(event) =>
                    updateTimelineEvent(index, { date: event.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>사건 내용</span>
                <input
                  className={styles.input}
                  value={item.event ?? ''}
                  onChange={(event) =>
                    updateTimelineEvent(index, { event: event.target.value })
                  }
                  placeholder="예: 퇴사를 통보받았습니다."
                />
              </label>
              <button
                className={styles.removeButton}
                type="button"
                onClick={() => removeTimelineEvent(index)}
                disabled={disabled}
                aria-label={`사건 경위 ${index + 1}행 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          className={styles.addButton}
          type="button"
          onClick={() =>
            onIncidentTimelineChange([...normalizedTimeline, createEmptyTimelineEvent()])
          }
          disabled={disabled}
        >
          경위 행 추가
        </button>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="evidence-section-title"
      >
        <div id="evidence-section-title" className={styles.legend}>
          증거 목록
        </div>
        <div className={styles.rows}>
          {normalizedEvidenceItems.map((item, index) => (
            <div className={styles.evidenceRow} key={item.ui_id}>
              <label className={styles.field}>
                <span className={styles.label}>증거 종류</span>
                <select
                  className={styles.select}
                  value={item.type ?? ''}
                  onChange={(event) =>
                    updateEvidenceItem(index, {
                      type: parseEvidenceType(event.target.value),
                    })
                  }
                >
                  <option value="">선택 안 함</option>
                  {evidenceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>증거 설명</span>
                <input
                  className={styles.input}
                  value={item.description ?? ''}
                  onChange={(event) =>
                    updateEvidenceItem(index, {
                      description: event.target.value,
                    })
                  }
                  placeholder="예: 해고 통보 카카오톡 캡처"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>확보 상태</span>
                <select
                  className={styles.select}
                  value={normalizeStatusValue(item.status)}
                  onChange={(event) =>
                    updateEvidenceItem(index, {
                      status: parseEvidenceStatus(event.target.value),
                    })
                  }
                >
                  {evidenceStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.removeButton}
                type="button"
                onClick={() => removeEvidenceItem(index)}
                disabled={disabled}
                aria-label={`증거 ${index + 1}행 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          className={styles.addButton}
          type="button"
          onClick={() =>
            onEvidenceItemsChange([...normalizedEvidenceItems, createEmptyEvidenceItem()])
          }
          disabled={disabled}
        >
          증거 행 추가
        </button>
      </fieldset>
    </section>
  );
}

function createRowId(prefix: 'evidence' | 'timeline'): string {
  nextRowId += 1;
  return `${prefix}-${nextRowId}`;
}

function hasUiId<T extends EvidenceItemInput | TimelineInput>(
  item: T,
): item is T & { ui_id: string } {
  const uiId = (item as { ui_id?: unknown }).ui_id;
  return typeof uiId === 'string' && uiId.length > 0;
}

function parseEvidenceType(value: string): EvidenceType | null {
  return evidenceTypeOptions.some((option) => option.value === value)
    ? (value as EvidenceType)
    : null;
}

function parseEvidenceStatus(value: string): EvidenceStatus {
  return evidenceStatusOptions.some((option) => option.value === value)
    ? (value as EvidenceStatus)
    : 'unknown';
}

function normalizeStatusValue(value: EvidenceItemInput['status']): EvidenceStatus {
  return value === 'available' || value === 'needs_collection' || value === 'unknown'
    ? value
    : 'unknown';
}
