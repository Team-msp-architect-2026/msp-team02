"""
공용 계약서 스키마와 유형 정의.

프로덕션 경로에서 레거시 OCR 구현을 import하지 않도록 별도 분리한다.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ContractType(str, Enum):
    NO_FIXED_TERM = "기간의_정함이_없는_경우"
    FIXED_TERM = "기간의_정함이_있는_경우"
    MINOR_WORKER = "연소근로자"
    CONSTRUCTION = "건설일용근로자"
    PART_TIME = "단시간근로자"
    FOREIGN_WORKER = "외국인근로자"
    UNKNOWN = "알수없음"


class EmployerInfo(BaseModel):
    company_name: Optional[str] = Field(None, description="사업체명")
    phone: Optional[str] = Field(None, description="전화번호")
    address: Optional[str] = Field(None, description="주소")
    representative: Optional[str] = Field(None, description="대표자 성명")


class EmployeeInfo(BaseModel):
    name: Optional[str] = Field(None, description="근로자 성명")
    address: Optional[str] = Field(None, description="주소")
    contact: Optional[str] = Field(None, description="연락처")


class WorkingHours(BaseModel):
    start: Optional[str] = Field(None, description="업무시작 HH:MM")
    end: Optional[str] = Field(None, description="업무종료 HH:MM")
    break_start: Optional[str] = Field(None, description="휴게시작 HH:MM")
    break_end: Optional[str] = Field(None, description="휴게종료 HH:MM")
    daily_hours: Optional[float] = Field(None, description="1일 소정근로시간")
    weekly_hours: Optional[float] = Field(None, description="1주 소정근로시간")


class WorkDays(BaseModel):
    days_per_week: Optional[int] = Field(None, description="주 근무일수")
    work_days_detail: Optional[list[str]] = Field(None, description="근무요일 목록")
    weekly_holiday_day: Optional[str] = Field(None, description="주휴일 요일")


class AllowanceItem(BaseModel):
    name: Optional[str] = Field(None, description="수당명")
    amount: Optional[int] = Field(None, description="수당 금액")


class WageInfo(BaseModel):
    wage_type: Optional[str] = Field(None, description="월급/일급/시간급")
    wage_amount: Optional[int] = Field(None, description="임금 금액")
    bonus_exists: Optional[bool] = Field(None, description="상여금 지급 여부")
    bonus_amount: Optional[int] = Field(None, description="상여금 금액")
    extra_allowance_exists: Optional[bool] = Field(None, description="약정수당 여부")
    allowance_1: AllowanceItem = Field(default_factory=AllowanceItem)
    allowance_2: AllowanceItem = Field(default_factory=AllowanceItem)
    payment_cycle: Optional[str] = Field(None, description="매월/매주/매일")
    payment_day: Optional[str] = Field(None, description="지급일")
    payment_method_direct: Optional[bool] = Field(None, description="현금지급 체크 여부")
    payment_method_transfer: Optional[bool] = Field(None, description="계좌입금 체크 여부")


class SocialInsurance(BaseModel):
    exception_note: Optional[str] = Field(None, description="사회보험 예외 사유")


class NoFixedTermContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    start_date: Optional[str] = Field(None, description="근로개시일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


class FixedTermContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    contract_start_date: Optional[str] = Field(None, description="근로계약 시작일")
    contract_end_date: Optional[str] = Field(None, description="근로계약 종료일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


class MinorContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    start_date: Optional[str] = Field(None, description="근로개시일")
    contract_end_date: Optional[str] = Field(None, description="근로계약 종료일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    family_cert_submitted: Optional[bool] = Field(None, description="가족관계증명서 제출 여부")
    guardian_consent_submitted: Optional[bool] = Field(None, description="친권자 동의서 제출 여부")
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


class PartTimeContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    start_date: Optional[str] = Field(None, description="근로개시일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


class ConstructionContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    start_date: Optional[str] = Field(None, description="근로개시일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


class ForeignWorkerContractData(BaseModel):
    employer_party_name: Optional[str] = Field(None, description="사업주명")
    employee_party_name: Optional[str] = Field(None, description="근로자명")
    contract_start_date: Optional[str] = Field(None, description="근로계약 시작일")
    contract_end_date: Optional[str] = Field(None, description="근로계약 종료일")
    workplace: Optional[str] = Field(None, description="근무장소")
    job_description: Optional[str] = Field(None, description="업무내용")
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    work_days: WorkDays = Field(default_factory=WorkDays)
    wage: WageInfo = Field(default_factory=WageInfo)
    social_insurance: SocialInsurance = Field(default_factory=SocialInsurance)
    signed_date: Optional[str] = Field(None, description="계약서 작성일")
    employer: EmployerInfo = Field(default_factory=EmployerInfo)
    employee: EmployeeInfo = Field(default_factory=EmployeeInfo)


SCHEMA_BY_CONTRACT_TYPE = {
    ContractType.NO_FIXED_TERM.value: NoFixedTermContractData,
    ContractType.FIXED_TERM.value: FixedTermContractData,
    ContractType.MINOR_WORKER.value: MinorContractData,
    ContractType.CONSTRUCTION.value: ConstructionContractData,
    ContractType.PART_TIME.value: PartTimeContractData,
    ContractType.FOREIGN_WORKER.value: ForeignWorkerContractData,
    ContractType.UNKNOWN.value: NoFixedTermContractData,
}


REQUIRED_FIELDS_BY_CONTRACT_TYPE = {
    ContractType.NO_FIXED_TERM.value: [
        "employer_party_name",
        "employee_party_name",
        "start_date",
        "workplace",
        "job_description",
    ],
    ContractType.FIXED_TERM.value: [
        "employer_party_name",
        "employee_party_name",
        "contract_start_date",
        "contract_end_date",
        "workplace",
        "job_description",
    ],
    ContractType.MINOR_WORKER.value: [
        "employer_party_name",
        "employee_party_name",
        "start_date",
        "workplace",
        "job_description",
    ],
    ContractType.CONSTRUCTION.value: [
        "employer_party_name",
        "employee_party_name",
        "start_date",
        "workplace",
        "job_description",
    ],
    ContractType.PART_TIME.value: [
        "employer_party_name",
        "employee_party_name",
        "start_date",
        "workplace",
        "job_description",
    ],
    ContractType.FOREIGN_WORKER.value: [
        "employer_party_name",
        "employee_party_name",
        "contract_start_date",
        "contract_end_date",
        "workplace",
        "job_description",
    ],
    ContractType.UNKNOWN.value: [
        "employer_party_name",
        "employee_party_name",
    ],
}
