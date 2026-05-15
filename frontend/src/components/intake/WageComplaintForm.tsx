'use client';

import type {
  CaseIntakeFormValues,
  DraftLanguage,
  WageType,
} from '@/types/api';

import styles from './WageComplaintForm.module.css';

interface WageComplaintFormProps {
  values: CaseIntakeFormValues;
  disabled?: boolean;
  onChange: (values: CaseIntakeFormValues) => void;
}

const wageTypeOptions: Array<{ value: WageType; label: string }> = [
  { value: 'hourly', label: '시급' },
  { value: 'daily', label: '일급' },
  { value: 'weekly', label: '주급' },
  { value: 'monthly', label: '월급' },
  { value: 'annual', label: '연봉' },
  { value: 'piece_rate', label: '건별 지급' },
  { value: 'other', label: '기타' },
  { value: 'unknown', label: '모름' },
];

export function WageComplaintForm({
  values,
  disabled = false,
  onChange,
}: WageComplaintFormProps) {
  const workerInfo = values.worker_info ?? {};
  const employerInfo = values.employer_info ?? {};
  const employmentInfo = values.employment_info ?? {};
  const unpaidWageInfo = values.unpaid_wage_info ?? {};

  function updateValues(nextValues: CaseIntakeFormValues) {
    onChange(nextValues);
  }

  return (
    <div className={styles.formSections}>
      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="wage-worker-employer-title"
      >
        <div id="wage-worker-employer-title" className={styles.legend}>
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
            <span className={styles.label}>사업장 관할 지역</span>
            <input
              className={styles.input}
              value={employerInfo.workplace_jurisdiction ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employer_info: {
                    ...employerInfo,
                    workplace_jurisdiction: event.target.value,
                  },
                })
              }
              placeholder="예: 서울"
            />
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="wage-employment-title"
      >
        <div id="wage-employment-title" className={styles.legend}>
          근무 및 임금 정보
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
              placeholder="예: 홀서빙"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>임금 형태</span>
            <select
              className={styles.select}
              value={employmentInfo.wage_type ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    wage_type: parseWageType(event.target.value),
                  },
                })
              }
            >
              <option value="">선택 안 함</option>
              {wageTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>임금 조건 메모</span>
            <input
              className={styles.input}
              value={employmentInfo.wage_terms ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    wage_terms: event.target.value,
                  },
                })
              }
              placeholder="예: 월 250만원"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>정기 지급일</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={31}
              value={employmentInfo.wage_payment_day ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    wage_payment_day: parseNumber(event.target.value),
                  },
                })
              }
              placeholder="예: 10"
            />
          </label>
        </div>
        <div className={styles.checkGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={employmentInfo.employment_contract_exists ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    employment_contract_exists: event.target.checked,
                  },
                })
              }
            />
            근로계약서가 있습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={employmentInfo.continuous_service_over_1_year ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  employment_info: {
                    ...employmentInfo,
                    continuous_service_over_1_year: event.target.checked,
                  },
                })
              }
            />
            계속 근무 기간이 1년을 넘습니다
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="wage-unpaid-title"
      >
        <div id="wage-unpaid-title" className={styles.legend}>
          미지급 금품
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>미지급 임금 금액</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={unpaidWageInfo.unpaid_wage_amount ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    unpaid_wage_amount: parseNumber(event.target.value),
                  },
                })
              }
              placeholder="숫자만 입력"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>미지급 퇴직금 금액</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={unpaidWageInfo.unpaid_severance_amount ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    unpaid_severance_amount: parseNumber(event.target.value),
                  },
                })
              }
              placeholder="숫자만 입력"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>미지급 기간 시작일</span>
            <input
              className={styles.input}
              type="date"
              value={unpaidWageInfo.unpaid_period_start ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    unpaid_period_start: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>미지급 기간 종료일</span>
            <input
              className={styles.input}
              type="date"
              value={unpaidWageInfo.unpaid_period_end ?? ''}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    unpaid_period_end: event.target.value,
                  },
                })
              }
            />
          </label>
        </div>
        <div className={styles.checkGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={unpaidWageInfo.days_since_separation_over_14 ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    days_since_separation_over_14: event.target.checked,
                  },
                })
              }
            />
            퇴사 후 14일이 지났습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={unpaidWageInfo.final_wage_paid ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    final_wage_paid: event.target.checked,
                  },
                })
              }
            />
            마지막 임금 일부 또는 전부를 받았습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={unpaidWageInfo.severance_paid ?? false}
              onChange={(event) =>
                updateValues({
                  ...values,
                  unpaid_wage_info: {
                    ...unpaidWageInfo,
                    severance_paid: event.target.checked,
                  },
                })
              }
            />
            퇴직금 일부 또는 전부를 받았습니다
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="wage-notes-title"
      >
        <div id="wage-notes-title" className={styles.legend}>
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
            placeholder="예: 회사가 지급일을 여러 번 미뤘습니다."
          />
        </label>
      </fieldset>
    </div>
  );
}

function parseNumber(value: string): number | null {
  if (value.trim().length === 0) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDraftLanguage(value: string): DraftLanguage | null {
  return value === 'ko' || value === 'en' ? value : null;
}

function parseWageType(value: string): WageType | null {
  return wageTypeOptions.some((option) => option.value === value)
    ? (value as WageType)
    : null;
}
