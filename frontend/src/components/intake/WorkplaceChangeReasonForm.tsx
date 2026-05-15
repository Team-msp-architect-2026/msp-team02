'use client';

import type {
  CaseIntakeFormValues,
  WorkplaceChangeInfo,
  WorkplaceChangeSelectValue,
} from '@/types/api';

import styles from './WorkplaceChangeReasonForm.module.css';

interface WorkplaceChangeReasonFormProps {
  values: CaseIntakeFormValues;
  disabled?: boolean;
  onChange: (values: CaseIntakeFormValues) => void;
}

const selectOptions: Array<{ value: WorkplaceChangeSelectValue; label: string }> = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
  { value: 'unknown', label: '확인 필요' },
];

export function WorkplaceChangeReasonForm({
  values,
  disabled = false,
  onChange,
}: WorkplaceChangeReasonFormProps) {
  const workplaceChangeInfo = values.workplace_change_info ?? {};

  function updateWorkplaceChangeInfo(patch: WorkplaceChangeInfo) {
    onChange({
      ...values,
      workplace_change_info: {
        ...workplaceChangeInfo,
        ...patch,
      },
    });
  }

  return (
    <div className={styles.formSections}>
      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="workplace-worker-title"
      >
        <div id="workplace-worker-title" className={styles.legend}>
          근로자 정보
        </div>
        <p className={styles.helper}>비워두면 초안에 확인 필요 항목으로 표시됩니다.</p>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>이름 또는 별칭</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.worker_name_or_alias ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  worker_name_or_alias: event.target.value,
                })
              }
              placeholder="예: 근로자 A"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>국적/언어</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.nationality_or_language ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  nationality_or_language: event.target.value,
                })
              }
              placeholder="예: 베트남어, 한국어 일부 가능"
            />
          </label>
          <label className={styles.fieldWide}>
            <span className={styles.label}>담당 업무</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.job_duties ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  job_duties: event.target.value,
                })
              }
              placeholder="예: 생산 보조, 포장 업무"
            />
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="workplace-employer-title"
      >
        <div id="workplace-employer-title" className={styles.legend}>
          사업장 정보
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>회사명</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.company_name ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  company_name: event.target.value,
                })
              }
              placeholder="예: 회사 B"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>근무지</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.workplace_location ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  workplace_location: event.target.value,
                })
              }
              placeholder="예: ○○공장 또는 지역명"
            />
          </label>
          <label className={styles.fieldWide}>
            <span className={styles.label}>사용자/관리자 정보</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.manager_info ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  manager_info: event.target.value,
                })
              }
              placeholder="예: 현장 관리자, 대표자 확인 필요"
            />
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="workplace-contract-title"
      >
        <div id="workplace-contract-title" className={styles.legend}>
          근로조건 및 계약서 차이
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>표준근로계약서 사용 여부</span>
            <select
              className={styles.select}
              value={workplaceChangeInfo.standard_contract_used ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  standard_contract_used: parseSelectValue(event.target.value),
                })
              }
            >
              <option value="">선택 안 함</option>
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>계약서에 숙소비 정보가 있었는지</span>
            <select
              className={styles.select}
              value={workplaceChangeInfo.dormitory_cost_disclosed_in_contract ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  dormitory_cost_disclosed_in_contract: parseSelectValue(
                    event.target.value,
                  ),
                })
              }
            >
              <option value="">선택 안 함</option>
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>실제 공제된 숙소비 또는 방식</span>
            <input
              className={styles.input}
              value={workplaceChangeInfo.actual_dormitory_deduction ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  actual_dormitory_deduction: event.target.value,
                })
              }
              placeholder="예: 매월 약 30만 원 공제"
            />
          </label>
          <label className={styles.fieldWide}>
            <span className={styles.label}>계약 조건과 실제 조건 차이</span>
            <textarea
              className={styles.textarea}
              value={workplaceChangeInfo.contract_actual_difference_detail ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  contract_actual_difference_detail: event.target.value,
                })
              }
              placeholder="예: 계약서에는 숙소비 설명이 없었지만 급여에서 공제되었습니다."
            />
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="workplace-reason-title"
      >
        <div id="workplace-reason-title" className={styles.legend}>
          사업장 변경 사유
        </div>
        <div className={styles.checkGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={workplaceChangeInfo.dormitory_environment_issue ?? false}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  dormitory_environment_issue: event.target.checked,
                })
              }
            />
            기숙사 환경 문제가 있습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={workplaceChangeInfo.excessive_dormitory_deduction ?? false}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  excessive_dormitory_deduction: event.target.checked,
                })
              }
            />
            숙소비 공제가 과하다고 봅니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={workplaceChangeInfo.verbal_abuse_or_discrimination ?? false}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  verbal_abuse_or_discrimination: event.target.checked,
                })
              }
            />
            폭언 또는 차별을 겪었습니다
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={workplaceChangeInfo.contract_actual_difference ?? false}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  contract_actual_difference: event.target.checked,
                })
              }
            />
            계약 조건과 실제 조건이 달랐습니다
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>기타 사유</span>
          <textarea
            className={styles.textarea}
            value={workplaceChangeInfo.other_reason ?? ''}
            onChange={(event) =>
              updateWorkplaceChangeInfo({
                other_reason: event.target.value,
              })
            }
            placeholder="예: 근무지 변경 요구, 휴게공간 문제 등"
          />
        </label>
      </fieldset>

      <fieldset
        className={styles.fieldset}
        disabled={disabled}
        aria-labelledby="workplace-request-title"
      >
        <div id="workplace-request-title" className={styles.legend}>
          요청사항
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>사업장 변경 사유 정리</span>
            <textarea
              className={styles.textarea}
              value={workplaceChangeInfo.reason_summary_request ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  reason_summary_request: event.target.value,
                })
              }
              placeholder="예: 기숙사와 숙소비 공제 문제를 중심으로 정리해주세요."
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>상담/신고 전 확인 필요 사항</span>
            <textarea
              className={styles.textarea}
              value={workplaceChangeInfo.pre_consultation_check_request ?? ''}
              onChange={(event) =>
                updateWorkplaceChangeInfo({
                  pre_consultation_check_request: event.target.value,
                })
              }
              placeholder="예: 어떤 증거를 먼저 준비해야 하는지 확인하고 싶습니다."
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

function parseSelectValue(value: string): WorkplaceChangeSelectValue | null {
  return value === 'yes' || value === 'no' || value === 'unknown' ? value : null;
}
