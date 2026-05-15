"""
section_comparator.py — Phase B-2 (섹션 매칭 + 구조 비교)
OCR 결과와 standard_map.json 을 비교해 누락/추가/불일치 항목을 탐지한다.

핵심 기능:
    match_sections()  — 번호+제목 기반으로 role_mapping 생성
    compare_sections() — missing / extra / mismatches 탐지
    get_section_by_role() — role_mapping 경유 항목 접근 헬퍼

사용:
    from backend.app.before_stack.services.section_comparator import compare_sections, get_section_by_role

    result = compare_sections(output, standard_map)
    # result: {role_mapping, missing, extra, mismatches, has_issues}

    wh_section = get_section_by_role(output, result["role_mapping"], "소정근로시간")
"""

# TODO(외국인근로자 표준서식 정합성 보강 — 미구현 메모)
# - 현재 제목 유사도 매칭은 일반형/축약형 alias 위주로 작성되어 있다.
# - 외국인근로자 표준서식을 공식 형태로 유지할 경우 아래 alias/정규화 보강이 필요할 수 있다.
#   1. "근로장소" <-> "근무장소"
#   2. "업무내용" <-> "업무의 내용"
#   3. OCR 이 "임금 지급일", "임금지급일", "지급일" 등으로 흔들리는 경우 alias 추가
#   4. OCR 이 "지급방법", "임금지급방법", "지급 방식" 등으로 흔들리는 경우 alias 추가
# - 위 내용은 아직 구현하지 않았고, 현재 파일은 기존 동작을 그대로 유지한다.

from __future__ import annotations

import re

from rapidfuzz import fuzz

# 유사도 임계값
MATCH_THRESHOLD_CONFIRM  = 80   # 번호 일치 후 제목 유사도 확인 임계값
MATCH_THRESHOLD_FALLBACK = 70   # fallback 전체 스캔 임계값

# ── 동의어 정규화 맵 ────────────────────────────────────────────────────────────
# STANDARD_SECTIONS 이 이제 공식 제목(예: "사회보험 적용여부")을 그대로 쓰므로
# 계약서 OCR 이 축약 표현을 냈을 때 공식 제목의 정규화 형태로 치환한다.
#
# 정규화 흐름: "사회보험" → "사회보험" (그대로) → Gemini 공식 제목 "사회보험적용여부" 와
#   partial_ratio=100 으로 매칭되므로 alias 불필요.
#   단, fuzz.ratio 가 낮을 수 있어 alias 로 보험을 든다.
#
# 키   = 정규화된 계약서 제목  (공백·쉼표 제거, 소문자)
# 값   = 정규화된 표준 제목    (같은 방식으로 정규화)
_TITLE_ALIASES: dict[str, str] = {
    # 계약서가 축약 표현 → 공식 표준 제목으로 매핑
    "기타":                             "그밖의사항",
    "사회보험":                         "사회보험적용여부",
    "근로규칙준수":                     "근로계약취업규칙등의성실한이행의무",
    "근로계약서교부":                   "근로계약서의교부",   # "의" 없는 축약형
    "업무내용":                         "업무의내용",         # "의" 없는 축약형
    "근로장소":                         "근무장소",
    "임금지급방법":                     "지급방법",
    "지급방식":                         "지급방법",
    "임금지급일":                       "임금지급일",
    "4대보험":                          "사회보험적용여부",
    # 이전 alias 역방향 (구버전 표준 제목이 계약서에 나타나는 경우)
    "취업규칙등의성실한이행의무":        "근로계약취업규칙등의성실한이행의무",
}


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _normalize_title(title: str) -> str:
    """
    비교를 위해 제목을 정규화한다.
    공백·슬래시·가운뎃점 제거, 소문자화, alias 치환.
    """
    title = re.sub(r'\([^)]*\)', '', title)
    normalized = (
        title.replace(" ", "")
             .replace("/", "")
             .replace("·", "")
             .replace(",", "")
             .replace(":", "")
             .lower()
    )
    return _TITLE_ALIASES.get(normalized, normalized)


def _title_similarity(t1: str, t2: str) -> float:
    """
    두 항목 제목의 유사도를 반환 (0~100).
    ratio + partial_ratio 중 높은 값을 사용해 포함 관계도 탐지.
    """
    n1 = _normalize_title(t1)
    n2 = _normalize_title(t2)
    return max(fuzz.ratio(n1, n2), fuzz.partial_ratio(n1, n2))


def _get_contract_sections(standard_map: dict, contract_type: str) -> dict:
    """
    standard_map 에서 계약서 유형에 해당하는 섹션 딕셔너리를 반환.
    유형이 없으면 "기간의_정함이_없는_경우" 를 기본값으로 사용.
    """
    if contract_type in standard_map:
        return standard_map[contract_type]["sections"]
    # fallback: 기간의_정함이_없는_경우
    return standard_map.get("기간의_정함이_없는_경우", {}).get("sections", {})


# ── Step 1: 섹션 매칭 ─────────────────────────────────────────────────────────

def match_sections(output: dict, standard_map: dict) -> dict[str, str]:
    """
    OCR 결과의 raw_sections 와 standard_map 을 비교해
    역할(role) → 실제 항목 번호 매핑을 반환한다.

    매칭 전략:
        1. 모든 (표준 항목, OCR 항목) 쌍의 유사도를 계산
        2. 번호가 일치하면 보너스 점수 +10 부여
        3. 점수 내림차순으로 탐욕적 할당 (각 OCR 항목은 1개 표준 항목에만 할당)
        4. 최종 점수 ≥ MATCH_THRESHOLD_FALLBACK 인 것만 매핑에 포함

    반환:
        role_mapping = {
            "소정근로시간": "4",
            "임금": "6",
            ...
        }
        (표준 항목 제목 → 계약서 내 실제 항목 번호)
    """
    contract_type     = output["_meta"]["contract_type"]
    standard_sections = _get_contract_sections(standard_map, contract_type)
    ocr_sections      = output["raw_sections"].get("sections", [])

    # ── Step 1: 모든 쌍의 유사도 계산 ────────────────────────────────────────
    candidates: list[tuple[float, str, str]] = []  # (score, std_title, ocr_no)

    for std_no, std_info in standard_sections.items():
        std_title = std_info["title"]
        for ocr_sec in ocr_sections:
            ocr_no    = ocr_sec["number"]
            ocr_title = ocr_sec["title"]
            sim = _title_similarity(std_title, ocr_title)

            # 번호 일치 보너스: 같은 번호면 신뢰도 10점 추가
            if std_no == ocr_no:
                sim = min(sim + 10.0, 100.0)

            if sim >= MATCH_THRESHOLD_FALLBACK:
                candidates.append((sim, std_title, ocr_no))

    # ── Step 2: 점수 내림차순 탐욕적 할당 ─────────────────────────────────────
    candidates.sort(key=lambda x: -x[0])

    claimed_ocr_nos:    set[str] = set()  # 이미 할당된 OCR 섹션 번호
    claimed_std_titles: set[str] = set()  # 이미 할당된 표준 항목 제목
    role_mapping: dict[str, str] = {}

    for score, std_title, ocr_no in candidates:
        if std_title in claimed_std_titles:
            continue  # 이미 매핑된 표준 항목
        if ocr_no in claimed_ocr_nos:
            continue  # 이미 다른 표준 항목이 선점한 OCR 항목

        role_mapping[std_title] = ocr_no
        claimed_std_titles.add(std_title)
        claimed_ocr_nos.add(ocr_no)

    return role_mapping


# ── Step 2: 구조 비교 ─────────────────────────────────────────────────────────

def compare_sections(output: dict, standard_map: dict) -> dict:
    """
    OCR 결과와 standard_map 을 비교해 구조적 차이를 탐지한다.

    반환:
        {
            "role_mapping": {"소정근로시간": "4", "임금": "6", ...},
            "missing":   [{"number": "7", "title": "연차유급휴가", "required": True}],
            "extra":     [{"number": "12", "title": "경업금지", "full_text": "..."}],
            "mismatches": [{"number": "4", "standard_title": "소정근로시간",
                            "actual_title": "근무시간", "similarity": 82.5}],
            "has_issues": True/False,
        }
    """
    contract_type     = output["_meta"]["contract_type"]
    standard_sections = _get_contract_sections(standard_map, contract_type)
    ocr_sections      = output["raw_sections"].get("sections", [])

    role_mapping = match_sections(output, standard_map)

    # OCR 섹션 번호 집합
    ocr_numbers = {s["number"] for s in ocr_sections}

    # ── missing: 표준에 있으나 계약서에 없는 항목 ──────────────────────────────
    missing: list[dict] = []
    for std_no, std_info in standard_sections.items():
        title = std_info["title"]
        # role_mapping 에서 매칭된 번호 찾기
        matched_no = role_mapping.get(title)
        if matched_no is None:
            missing.append({
                "number":   std_no,
                "title":    title,
                "required": std_info.get("required", True),
            })

    # ── extra: 계약서에 있으나 표준에 없는 항목 ──────────────────────────────
    # 표준에서 매칭된 번호들의 집합
    matched_numbers = set(role_mapping.values())
    extra: list[dict] = []
    for ocr_sec in ocr_sections:
        if ocr_sec["number"] not in matched_numbers:
            extra.append({
                "number":   ocr_sec["number"],
                "title":    ocr_sec["title"],
                "full_text": ocr_sec.get("full_text", ""),
            })

    # ── mismatches: 번호는 같은데 제목이 다른 항목 ──────────────────────────
    ocr_by_number = {s["number"]: s for s in ocr_sections}
    mismatches: list[dict] = []
    for std_no, std_info in standard_sections.items():
        if std_no in ocr_by_number:
            std_title = std_info["title"]
            ocr_title = ocr_by_number[std_no]["title"]
            sim = _title_similarity(std_title, ocr_title)
            # 번호가 같고 제목이 다르면서 role_mapping 에서는 다른 번호로 매칭된 경우
            if sim < MATCH_THRESHOLD_CONFIRM and role_mapping.get(std_title) != std_no:
                mismatches.append({
                    "number":          std_no,
                    "standard_title":  std_title,
                    "actual_title":    ocr_title,
                    "similarity":      round(sim, 1),
                })

    has_issues = bool(missing or extra or mismatches)

    return {
        "role_mapping": role_mapping,
        "missing":      missing,
        "extra":        extra,
        "mismatches":   mismatches,
        "has_issues":   has_issues,
    }


# ── 섹션 접근 헬퍼 ────────────────────────────────────────────────────────────

def get_section_by_role(
    output: dict,
    role_mapping: dict[str, str],
    role: str,
) -> dict | None:
    """
    role_mapping 을 경유해 OCR 결과에서 특정 역할의 항목을 반환한다.

    사용 예:
        section = get_section_by_role(output, role_mapping, "소정근로시간")
        if section:
            print(section["full_text"])

    반환:
        {"number": "4", "title": "소정근로시간", "full_text": "..."} 또는 None
    """
    sec_no = role_mapping.get(role)
    if sec_no is None:
        return None

    ocr_sections = output["raw_sections"].get("sections", [])
    for sec in ocr_sections:
        if sec["number"] == sec_no:
            return sec

    return None


def get_section_by_roles(
    output: dict,
    role_mapping: dict[str, str],
    roles: list[str] | tuple[str, ...],
) -> dict | None:
    """여러 후보 역할명을 순서대로 시도해 첫 번째 일치 섹션을 반환한다."""
    for role in roles:
        section = get_section_by_role(output, role_mapping, role)
        if section is not None:
            return section
    return None
