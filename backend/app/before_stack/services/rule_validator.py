"""
rule_validator.py — Phase B-3 (수치 규칙 검증, 순수 Python)
role_mapping 경유로 raw_sections 를 파싱해 수치 위반을 탐지한다.

⚠ 절대 규칙:
    - structured 값 사용 금지 (OCR 오류 확인됨)
    - 항목 번호 하드코딩 금지 → role_mapping 경유
    - LLM 에게 숫자 계산 위임 금지 → Python 로직으로만

사용:
    from backend.app.before_stack.services.rule_validator import validate_all
    result = validate_all(output, role_mapping, min_wage_config)
"""

# TODO(외국인근로자 표준서식 정합성 보강 — 미구현 메모)
# - 현재 규칙 검증은 일반형 role 이름("소정근로시간", "근무일/휴일", "임금")을 전제로 동작한다.
# - 외국인근로자 표준서식을 공식 형태로 유지할 경우 아래 보강이 필요하다.
#   1. "소정근로시간" 대체 role 로 "근로시간"을 허용
#   2. "근무일/휴일" 대체 role 로 "휴일" 및 필요 시 "휴게시간"을 별도 처리
#   3. check_payment_day() 는 외국인근로자에서 "임금"이 아니라 "임금지급일" 섹션을 직접 읽도록 분기
#   4. 외국인근로자에서 주 근무일수 파싱 기준이 일반형과 다를 수 있으므로, "휴일"/별도 표기 기반 보완 로직 검토
# - 위 내용은 아직 구현하지 않았고, 현재 파일은 기존 동작을 그대로 유지한다.

from __future__ import annotations

import re
from typing import Optional

import yaml

from backend.app.before_stack.core.settings import MIN_WAGE_YAML_PATH
from backend.app.before_stack.services.section_comparator import get_section_by_roles


# ── 최저임금 로드 ──────────────────────────────────────────────────────────────

def load_min_wage_config() -> dict:
    """assets/config/minimum_wage.yaml 에서 최저임금 설정을 로드한다."""
    with open(MIN_WAGE_YAML_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data["minimum_wage"]


# ── 시간 파싱 유틸 ────────────────────────────────────────────────────────────

_TIME_PATTERN = re.compile(
    r'(\d{1,2})시\s*(\d{2})분\s*[~\-~]\s*(\d{1,2})시\s*(\d{2})분'
)
_BREAK_PATTERN = re.compile(
    r'휴게[^\d]*(\d{1,2})시\s*(\d{2})분\s*[~\-~]\s*(\d{1,2})시\s*(\d{2})분'
)
_DAYS_PATTERN = re.compile(r'(?:매주|주)\s*(\d+)\s*일\s*근무')
_WAGE_PATTERN = re.compile(r'(\d[\d,]+)\s*원')
_WAGE_TYPE_AMOUNT_PATTERN = re.compile(
    r'([월일시간]{1,2})(?:\([^)]*\))?급\s*[:：]\s*(\d[\d,]+)\s*원'
)
_PAYMENT_DAY_PATTERN = re.compile(r'매월[^\d]*(\d{1,2})\s*일')

_WORKING_HOURS_ROLES = (
    "소정근로시간",
    "근로일 및 근로일별 근로시간",
    "근로시간",
)
_WORKDAY_ROLES = (
    "근무일/휴일",
    "근로일 및 근로일별 근로시간",
    "휴일",
)
_WAGE_ROLES = (
    "임금",
    "임금지급일",
)


def _hhmm_to_minutes(hh: int, mm: int) -> int:
    return hh * 60 + mm


def _extract_row_text(full_text: str, row_label: str) -> str | None:
    pattern = re.compile(rf'{row_label}[^\n]*')
    match = pattern.search(full_text)
    return match.group(0) if match else None


def _extract_first_time_components(row_text: str | None) -> tuple[int, int] | None:
    if not row_text:
        return None
    match = re.search(r'(\d{1,2})시\s*(\d{2})분', row_text)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def parse_working_hours(full_text: str) -> dict:
    """
    소정근로시간 항목 원문에서 근무시간 정보를 파싱한다.

    예시 입력:
        "4. 소정근로시간 09시 00분 ~ 18시 00분 (휴게 : 12시 00분 ~ 13시 00분)\n
        (1일 7시간, 1주 5일)"

    반환:
        {
            "start_h": 9, "start_m": 0,
            "end_h": 18,  "end_m": 0,
            "break_start_h": 12, "break_start_m": 0,
            "break_end_h": 13,   "break_end_m": 0,
            "gross_minutes": 540,   # 09:00 ~ 18:00
            "break_minutes": 60,
            "net_minutes": 480,     # 실제 근로시간 (gross - break)
            "daily_hours_float": 8.0,
        }
    """
    result: dict = {}

    # 근무 시간대 파싱
    start_time = _extract_first_time_components(_extract_row_text(full_text, "업무\\s*시작"))
    end_time = _extract_first_time_components(_extract_row_text(full_text, "업무\\s*종료"))
    if start_time and end_time:
        sh, sm = start_time
        eh, em = end_time
        result.update({"start_h": sh, "start_m": sm, "end_h": eh, "end_m": em})
        gross = _hhmm_to_minutes(eh, em) - _hhmm_to_minutes(sh, sm)
        if gross < 0:
            gross += 24 * 60
        result["gross_minutes"] = gross
    else:
        match = _TIME_PATTERN.search(full_text)
        if match:
            sh, sm, eh, em = int(match.group(1)), int(match.group(2)), \
                             int(match.group(3)), int(match.group(4))
            result.update({"start_h": sh, "start_m": sm, "end_h": eh, "end_m": em})
            gross = _hhmm_to_minutes(eh, em) - _hhmm_to_minutes(sh, sm)
            # 자정 넘김 처리 (야간 근무)
            if gross < 0:
                gross += 24 * 60
            result["gross_minutes"] = gross

    # 휴게 시간 파싱
    break_match = _BREAK_PATTERN.search(full_text)
    break_times: tuple[int, int, int, int] | None = None
    if break_match:
        break_times = (
            int(break_match.group(1)),
            int(break_match.group(2)),
            int(break_match.group(3)),
            int(break_match.group(4)),
        )
    else:
        # OCR 이 "~" 기호를 잃거나 줄바꿈을 삽입해도, "휴게" 주변의 두 시각을 우선 휴게 구간으로 해석한다.
        break_anchor = re.search(r'휴게[^0-9]{0,10}', full_text)
        if break_anchor:
            break_window = full_text[break_anchor.start(): break_anchor.start() + 80]
            time_matches = re.findall(r'(\d{1,2})\s*시\s*(\d{2})\s*분', break_window)
            if len(time_matches) >= 2:
                (bsh, bsm), (beh, bem) = time_matches[:2]
                break_times = (int(bsh), int(bsm), int(beh), int(bem))

    if break_times is not None:
        bsh, bsm, beh, bem = break_times
        result["break_start_h"] = bsh
        result["break_start_m"] = bsm
        result["break_end_h"]   = beh
        result["break_end_m"]   = bem
        break_min = _hhmm_to_minutes(beh, bem) - _hhmm_to_minutes(bsh, bsm)
        if break_min < 0:
            break_min += 24 * 60
        result["break_minutes"] = break_min
    else:
        result["break_minutes"] = 0

    # 실 근로시간 계산
    if "gross_minutes" in result:
        net = result["gross_minutes"] - result.get("break_minutes", 0)
        result["net_minutes"]      = max(net, 0)
        result["daily_hours_float"] = round(result["net_minutes"] / 60, 2)

    return result


def parse_days_per_week(full_text: str) -> Optional[int]:
    """
    근무일/휴일 항목 원문에서 주 근무일수를 파싱한다.
    예: "매주 5일 근무" → 5
    """
    match = _DAYS_PATTERN.search(full_text)
    if match:
        return int(match.group(1))

    start_row = _extract_row_text(full_text, "업무\\s*시작")
    if start_row:
        start_times = re.findall(r'(\d{1,2})시\s*\d{2}분', start_row)
        if start_times:
            return len(start_times)

    hours_row = _extract_row_text(full_text, "근로시간")
    if hours_row:
        hour_values = re.findall(r'\|\s*([0-9]+(?:\.[0-9]+)?)', hours_row)
        if hour_values:
            return len(hour_values)

    return None


def parse_monthly_wage(full_text: str) -> Optional[int]:
    """
    임금 항목 원문에서 기본급(월급)을 파싱한다.
    예: "월급 300,000원" → 300000
    가장 첫 번째로 등장하는 금액을 기본급으로 간주한다.
    """
    match = _WAGE_PATTERN.search(full_text)
    if match:
        return int(match.group(1).replace(",", ""))
    return None


def parse_wage_info(full_text: str) -> dict:
    """
    임금 항목 원문에서 지급 단위와 금액을 파싱한다.

    반환:
        {"wage_type": "월급"|"일급"|"시간급"|None, "amount": int|None}
    """
    match = _WAGE_TYPE_AMOUNT_PATTERN.search(full_text)
    if not match:
        return {
            "wage_type": "월급" if parse_monthly_wage(full_text) is not None else None,
            "amount": parse_monthly_wage(full_text),
        }

    unit_map = {
        "월": "월급",
        "일": "일급",
        "시간": "시간급",
    }
    unit = match.group(1)
    amount = int(match.group(2).replace(",", ""))
    return {
        "wage_type": unit_map.get(unit),
        "amount": amount,
    }


def calc_monthly_hours(daily_hours: float, days_per_week: int) -> float:
    """
    주휴수당 포함 월 소정근로시간 계산.
    공식: (1일_근로시간 × 주_근무일 + 주휴시간) × (365/7/12)

    주휴시간 = min(1일_근로시간, 8) (주 15시간 이상 근무 시 발생)
    """
    weekly_hours = daily_hours * days_per_week
    if weekly_hours >= 15:
        juyu_hours = min(daily_hours, 8.0)  # 주휴수당 시간
    else:
        juyu_hours = 0.0
    total_weekly = weekly_hours + juyu_hours
    return round(total_weekly * (365 / 7 / 12), 2)


def calc_weekly_hours_details(daily_hours: float, days_per_week: int) -> dict:
    """주 소정근로시간과 주휴시간 반영 여부를 함께 계산한다."""
    weekly_hours = round(daily_hours * days_per_week, 2)
    juyu_hours = min(daily_hours, 8.0) if weekly_hours >= 15 else 0.0
    total_weekly_hours = round(weekly_hours + juyu_hours, 2)
    return {
        "weekly_hours": weekly_hours,
        "juyu_hours": round(juyu_hours, 2),
        "juyu_applied": juyu_hours > 0,
        "total_weekly_hours": total_weekly_hours,
    }


def calc_hourly_wage(monthly_wage: int, daily_hours: float, days_per_week: int) -> float:
    """
    시급 역산.
    시급 = 월급 / 월_소정근로시간
    """
    monthly_hours = calc_monthly_hours(daily_hours, days_per_week)
    if monthly_hours <= 0:
        return 0.0
    return round(monthly_wage / monthly_hours, 2)


# ── 개별 검사 함수 ─────────────────────────────────────────────────────────────

def check_minimum_wage(
    output: dict,
    role_mapping: dict,
    min_wage_config: dict,
) -> dict:
    """
    최저임금 위반 여부를 검사한다.

    - raw_sections 에서 시간과 임금을 직접 파싱 (structured 사용 금지)
    - 시급 환산 후 최저임금과 비교
    """
    # 관련 섹션 취득
    wh_section   = get_section_by_roles(output, role_mapping, _WORKING_HOURS_ROLES)
    wage_section = get_section_by_roles(output, role_mapping, _WAGE_ROLES)
    days_section = get_section_by_roles(output, role_mapping, _WORKDAY_ROLES)

    if not wh_section or not wage_section:
        return {
            "status":   "WARNING",
            "severity": "MEDIUM",
            "message":  "소정근로시간 또는 임금 항목을 찾을 수 없어 최저임금 검사를 수행할 수 없습니다.",
        }

    # 시간 파싱
    wh_info       = parse_working_hours(wh_section["full_text"])
    daily_hours   = wh_info.get("daily_hours_float")
    days_per_week = parse_days_per_week(days_section["full_text"]) if days_section else None

    if daily_hours is None or days_per_week is None:
        return {
            "status":        "WARNING",
            "severity":      "MEDIUM",
            "message":       "근무시간 파싱 실패 — 원본 이미지 직접 확인 필요",
            "parsed_hours":  wh_info,
        }

    # 임금 파싱
    wage_info = parse_wage_info(wage_section["full_text"])
    wage_type = wage_info.get("wage_type")
    wage_amount = wage_info.get("amount")
    if wage_amount is None or wage_type is None:
        return {
            "status":   "WARNING",
            "severity": "MEDIUM",
            "message":  "임금 금액 파싱 실패",
        }

    weekly_details = calc_weekly_hours_details(daily_hours, days_per_week)

    # 시급 계산
    if wage_type == "시간급":
        hourly_wage = float(wage_amount)
        monthly_hours = calc_monthly_hours(daily_hours, days_per_week)
    elif wage_type == "일급":
        hourly_wage = round(wage_amount / daily_hours, 2) if daily_hours > 0 else 0.0
        monthly_hours = calc_monthly_hours(daily_hours, days_per_week)
    else:
        hourly_wage = calc_hourly_wage(wage_amount, daily_hours, days_per_week)
        monthly_hours = calc_monthly_hours(daily_hours, days_per_week)
    min_hourly     = min_wage_config.get("hourly", 10030)   # 2025년 기준
    min_monthly    = min_wage_config.get("monthly_209h", 2096270)
    min_wage_year  = min_wage_config.get("year")

    is_violation = hourly_wage < min_hourly

    return {
        "status":          "VIOLATION" if is_violation else "PASS",
        "severity":        "HIGH" if is_violation else "NONE",
        "wage_type":       wage_type,
        "stated_amount":   wage_amount,
        "calc_daily_hours": daily_hours,
        "days_per_week":   days_per_week,
        "weekly_hours":    weekly_details["weekly_hours"],
        "juyu_hours":      weekly_details["juyu_hours"],
        "juyu_applied":    weekly_details["juyu_applied"],
        "total_weekly_hours": weekly_details["total_weekly_hours"],
        "monthly_hours":   monthly_hours,
        "calc_hourly":     hourly_wage,
        "minimum_wage_year": min_wage_year,
        "min_hourly":      min_hourly,
        "min_monthly_209h": min_monthly,
        "shortfall":       round(min_hourly - hourly_wage, 2) if is_violation else 0,
        "message": (
            f"{wage_type} {wage_amount:,.0f}원 기준, 1일 {daily_hours}시간·주 {days_per_week}일 "
            f"(주 소정 {weekly_details['weekly_hours']}시간"
            f"{', 주휴 ' + str(weekly_details['juyu_hours']) + '시간 반영' if weekly_details['juyu_applied'] else ', 주휴 미발생'}) "
            f"→ 월 환산 {monthly_hours}시간, 시급 {hourly_wage:,.0f}원 < 최저임금 {min_hourly:,}원 "
            f"(부족: {min_hourly - hourly_wage:,.0f}원)"
            if is_violation else
            f"{wage_type} {wage_amount:,.0f}원 기준, 1일 {daily_hours}시간·주 {days_per_week}일 "
            f"(주 소정 {weekly_details['weekly_hours']}시간"
            f"{', 주휴 ' + str(weekly_details['juyu_hours']) + '시간 반영' if weekly_details['juyu_applied'] else ', 주휴 미발생'}) "
            f"→ 월 환산 {monthly_hours}시간, 시급 {hourly_wage:,.0f}원 ≥ 최저임금 {min_hourly:,}원"
        ),
    }


def check_working_hours(output: dict, role_mapping: dict) -> dict:
    """
    법정 근로시간 준수 여부 검사.
    근로기준법 제50조: 1주 40시간, 1일 8시간 초과 불가 (연장 포함 시 52시간).
    """
    wh_section = get_section_by_roles(output, role_mapping, _WORKING_HOURS_ROLES)
    if not wh_section:
        return {
            "status":   "WARNING",
            "severity": "MEDIUM",
            "message":  "소정근로시간 항목을 찾을 수 없습니다.",
        }

    wh_info     = parse_working_hours(wh_section["full_text"])
    daily_hours = wh_info.get("daily_hours_float")

    if daily_hours is None:
        return {
            "status":   "WARNING",
            "severity": "LOW",
            "message":  "근무시간 파싱 실패",
            "raw_text": wh_section["full_text"][:200],
        }

    is_daily_violation = daily_hours > 8.0

    return {
        "status":        "VIOLATION" if is_daily_violation else "PASS",
        "severity":      "HIGH" if is_daily_violation else "NONE",
        "stated_daily":  wh_info.get("gross_minutes", 0) / 60 if "gross_minutes" in wh_info else None,
        "actual_daily":  daily_hours,
        "break_hours":   round(wh_info.get("break_minutes", 0) / 60, 2),
        "legal_max_daily": 8.0,
        "law_ref":       "근로기준법 제50조",
        "message": (
            f"업무시간 {wh_info.get('gross_minutes', 0) / 60:.1f}시간 중 휴게 {round(wh_info.get('break_minutes', 0) / 60, 2)}시간 제외 "
            f"실근로 {daily_hours}시간 > 법정 8시간"
            if is_daily_violation else
            f"업무시간 {wh_info.get('gross_minutes', 0) / 60:.1f}시간 중 휴게 {round(wh_info.get('break_minutes', 0) / 60, 2)}시간 제외 "
            f"실근로 {daily_hours}시간 (법정 8시간 이내)"
        ),
    }


def check_break_time(output: dict, role_mapping: dict) -> dict:
    """
    휴게시간 적정성 검사.
    근로기준법 제54조:
        - 4시간 초과 근무 시 30분 이상 휴게
        - 8시간 초과 근무 시 1시간 이상 휴게
    """
    wh_section = get_section_by_roles(output, role_mapping, _WORKING_HOURS_ROLES)
    if not wh_section:
        return {
            "status":   "WARNING",
            "severity": "MEDIUM",
            "message":  "소정근로시간 항목을 찾을 수 없습니다.",
        }

    wh_info     = parse_working_hours(wh_section["full_text"])
    gross_hours = wh_info.get("gross_minutes", 0) / 60
    break_min   = wh_info.get("break_minutes", 0)

    # 법정 최소 휴게 시간 계산
    if gross_hours > 8:
        required_break_min = 60
    elif gross_hours > 4:
        required_break_min = 30
    else:
        required_break_min = 0

    is_violation = break_min < required_break_min

    return {
        "status":               "VIOLATION" if is_violation else "PASS",
        "severity":             "MEDIUM" if is_violation else "NONE",
        "gross_work_hours":     round(gross_hours, 2),
        "break_minutes":        break_min,
        "required_break_min":   required_break_min,
        "law_ref":              "근로기준법 제54조",
        "message": (
            f"총 근무 {gross_hours:.1f}시간에 휴게 {break_min}분 — "
            f"최소 {required_break_min}분 필요 (부족: {required_break_min - break_min}분)"
            if is_violation else
            f"총 근무 {gross_hours:.1f}시간에 휴게 {break_min}분 (적정)"
        ),
    }


def check_payment_day(output: dict, role_mapping: dict) -> dict:
    """
    임금지급일 명시 여부 검사.
    근로기준법 제43조: 임금은 매월 1회 이상 일정한 날짜를 정해 지급해야 함.
    """
    wage_section = get_section_by_roles(output, role_mapping, _WAGE_ROLES)
    if not wage_section:
        return {
            "status":   "WARNING",
            "severity": "MEDIUM",
            "message":  "임금 항목을 찾을 수 없습니다.",
        }

    full_text    = wage_section["full_text"]
    payment_match = _PAYMENT_DAY_PATTERN.search(full_text)

    if payment_match:
        day = payment_match.group(1)
        return {
            "status":       "PASS",
            "severity":     "NONE",
            "payment_day":  int(day),
            "law_ref":      "근로기준법 제43조",
            "message":      f"임금지급일 매월 {day}일로 명시됨",
        }
    else:
        # "지급일" 키워드라도 있으면 WARNING, 없으면 VIOLATION
        has_keyword = "지급일" in full_text or "지급" in full_text
        return {
            "status":   "WARNING" if has_keyword else "VIOLATION",
            "severity": "MEDIUM" if has_keyword else "HIGH",
            "law_ref":  "근로기준법 제43조",
            "message":  "임금지급일 일수 미명시 — 구체적인 날짜 기재 필요",
        }


# ── 통합 검사 ─────────────────────────────────────────────────────────────────

def validate_all(
    output: dict,
    role_mapping: dict,
    min_wage_config: Optional[dict] = None,
) -> dict:
    """
    모든 수치 검사를 실행하고 통합 결과를 반환한다.

    반환:
        {
            "minimum_wage":   {status, severity, ...},
            "working_hours":  {status, severity, ...},
            "break_time":     {status, severity, ...},
            "payment_day":    {status, severity, ...},
        }
    """
    if min_wage_config is None:
        min_wage_config = load_min_wage_config()

    return {
        "minimum_wage":  check_minimum_wage(output, role_mapping, min_wage_config),
        "working_hours": check_working_hours(output, role_mapping),
        "break_time":    check_break_time(output, role_mapping),
        "payment_day":   check_payment_day(output, role_mapping),
    }
