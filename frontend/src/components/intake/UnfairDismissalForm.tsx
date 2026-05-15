'use client';

import type {
  CaseIntakeFormValues,
  DraftLanguage,
  NoticeMethod,
} from '@/types/api';

import styles from './UnfairDismissalForm.module.css';

interface UnfairDismissalFormProps {
  values: CaseIntakeFormValues;
  disabled?: boolean;
  onChange: (values: CaseIntakeFormValues) => void;
}

const noticeMethodOptions: Array<{ value: NoticeMethod; label: string }> = [
  { value: 'written', label: '서면' },
  { value: 'kakaotalk', label: '카카오톡' },
  { value: 'sms', label: '문자' },
  { value: 'email', label: '이메일' },
  { value: 'verbal', label: '구두' },
  { value: 'phone', label: '전화' },
  { value: 'unknown', label: '모름' },
];

const writtenNoticeFieldsetId = 'written-notice-received-fieldset';

export function UnfairDismissalForm({
  values,
  disabled = false,
  onChange,
}: UnfairDismissalFormProps) {
  const workerInfo = values.worker_info ?? {};
  const employerInfo = values.employer_info ?? {};
  const employmentInfo = values.employment_info ?? {};
  const dismissalInfo = values.dismissal_info ?? {};
  const noticeMethod = dismissalInfo.notice_method ?? '';
  const employeeCountOver5 = employerInfo.employee_count_over_5;

  function updateValues(nextValues: CaseIntakeFormValues) {
    onChange(nextValues);
  }

  return (
    <div className={styles.formSections}>
      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="unfair-party-title"
      >
        <div id="unfair-party-title" className={styles.legend}>
          당사자 정보
        </div>
        <p className={styles.helper}>비워두면 초안에 확인 필요 항목으로 표시됩니다.</p>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>근로자 이름 또는 표시명</span>
            <input
              className={styles.input}
              value={workerInfo.name_or_placeholder ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  worker_info: {
                    ...workerInfo,
                    name_or_placeholder: event.target.value,
                  },
                })
              }
              placeholder="예: 근로자 A"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>회사명 또는 표시명</span>
            <input
              className={styles.input}
              value={employerInfo.company_name_or_placeholder ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employer_info: {
                    ...employerInfo,
                    company_name_or_placeholder: event.target.value,
                  },
                })
              }
              placeholder="예: 회사 B"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>국적 또는 표시</span>
            <input
              className={styles.input}
              value={workerInfo.nationality ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  worker_info: {
                    ...workerInfo,
                    nationality: event.target.value,
                  },
                })
              }
              placeholder="예: 미기재"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>선호 언어</span>
            <select
              className={styles.select}
              value={workerInfo.preferred_language ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  worker_info: {
                    ...workerInfo,
                    preferred_language: parseDraftLanguage(event.target.value),
                  },
                })
              }
            >
              <option value="">선택 안 함</option>
              <option value="ko">한국어</option>
              <option value="en">영어</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>대표자 이름 또는 표시명</span>
            <input
              className={styles.input}
              value={employerInfo.representative_name ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employer_info: {
                    ...employerInfo,
                    representative_name: event.target.value,
                  },
                })
              }
              placeholder="예: 대표자 미상"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>상시근로자 5명 이상 여부</span>
            <select
              className={styles.select}
              value={booleanToSelectValue(employeeCountOver5)}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employer_info: {
                    ...employerInfo,
                    employee_count_over_5: parseBoolean(event.target.value),
                  },
                })
              }
            >
              <option value="">선택 안 함</option>
              <option value="true">5명 이상</option>
              <option value="false">5명 미만 또는 불명확</option>
            </select>
          </label>
        </div>
        {employeeCountOver5 === false ? (
          <p className={styles.inlineCaution}>
            상시근로자 5명 미만이면 부당해고 구제신청 가능성이 제한될 수 있어 확인이
            필요합니다.
          </p>
        ) : null}
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="unfair-dismissal-title"
      >
        <div id="unfair-dismissal-title" className={styles.legend}>
          근무 기간 및 해고 정보
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>입사일</span>
            <input
              className={styles.input}
              type="date"
              value={employmentInfo.start_date ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    start_date: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>마지막 근무일</span>
            <input
              className={styles.input}
              type="date"
              value={employmentInfo.last_work_date ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    last_work_date: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>업무 또는 직무</span>
            <input
              className={styles.input}
              value={employmentInfo.job_title ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    job_title: event.target.value,
                  },
                })
              }
              placeholder="예: 생산직"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>해고 통지일</span>
            <input
              className={styles.input}
              type="date"
              value={dismissalInfo.dismissal_notice_date ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    dismissal_notice_date: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>해고 효력 발생일</span>
            <input
              className={styles.input}
              type="date"
              value={dismissalInfo.dismissal_effective_date ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    dismissal_effective_date: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>통지 방식</span>
            <select
              className={styles.select}
              value={noticeMethod}
              onChange={(event) => {
                const nextNoticeMethod = parseNoticeMethod(event.target.value);
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    notice_method: nextNoticeMethod,
                    written_notice_received:
                      nextNoticeMethod === 'written'
                        ? dismissalInfo.written_notice_received
                        : null,
                  },
                });
              }}
              aria-controls={writtenNoticeFieldsetId}
            >
              <option value="">선택 안 함</option>
              {noticeMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset
          id={writtenNoticeFieldsetId}
          className={styles.inlineFieldset}
          hidden={noticeMethod !== 'written'}
          disabled={disabled || noticeMethod !== 'written'}
          aria-labelledby="written-notice-subtitle"
        >
          <div id="written-notice-subtitle" className={styles.inlineLegend}>
            서면 통지서 수령 여부
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dismissalInfo.written_notice_received ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    written_notice_received: event.target.checked,
                  },
                })
              }
            />
            서면 통지서를 받았습니다
          </label>
        </fieldset>

        <div className={styles.checkGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dismissalInfo.reinstatement_requested ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    reinstatement_requested: event.target.checked,
                  },
                })
              }
            />
            원직복직을 원합니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dismissalInfo.monetary_compensation_requested ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    monetary_compensation_requested: event.target.checked,
                  },
                })
              }
            />
            금전보상을 원합니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dismissalInfo.advance_notice_30_days ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    advance_notice_30_days: event.target.checked,
                  },
                })
              }
            />
            30일 전 예고를 받았습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dismissalInfo.dismissal_reason_provided ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  dismissal_info: {
                    ...dismissalInfo,
                    dismissal_reason_provided: event.target.checked,
                  },
                })
              }
            />
            해고 사유 설명을 들었습니다
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>해고 사유 또는 경위 메모</span>
          <textarea
            className={styles.textarea}
            value={dismissalInfo.dismissal_reason ?? ''}
            onChange={(event) =>
              updateValues({
                ...values,
                dismissal_info: {
                  ...dismissalInfo,
                  dismissal_reason: event.target.value,
                },
              })
            }
            placeholder="예: 매출 감소를 이유로 오늘까지만 나오라고 했습니다."
          />
        </label>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="unfair-notes-title"
      >
        <div id="unfair-notes-title" className={styles.legend}>
          추가 메모
        </div>
        <label className={styles.field}>
          <span className={styles.label}>초안에 반영할 메모</span>
          <textarea
            className={styles.textarea}
            value={values.intake_notes ?? ''}
            onChange={(event) =>
              updateValues({
                ...values,
                intake_notes: event.target.value,
              })
            }
            placeholder="예: 해고 전에 소명 기회를 받지 못했습니다."
          />
        </label>
      </fieldset>
    </div>
  );
}

function parseDraftLanguage(value: string): DraftLanguage | null {
  return value === 'ko' || value === 'en' ? value : null;
}

function parseNoticeMethod(value: string): NoticeMethod | null {
  return noticeMethodOptions.some((option) => option.value === value)
    ? (value as NoticeMethod)
    : null;
}

function parseBoolean(value: string): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function booleanToSelectValue(value: boolean | null | undefined): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}
