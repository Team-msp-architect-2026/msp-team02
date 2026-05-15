"""
law_retriever.py — Phase B-4 전처리 (비표준 조항 법령 조회)
extra 항목의 full_text 에서 키워드를 추출해 관련 법 조문을 동적으로 조회한다.

사용:
    from backend.app.before_stack.services.law_retriever import build_extra_law_map
    extra_law_map = build_extra_law_map(extra_sections, all_chunks)
    # {"12": [chunk1, chunk2, ...], "13": [...]}
"""

from __future__ import annotations

# ── 키워드 → 관련 법 조문 매핑 ────────────────────────────────────────────────
# 키워드(소문자, 공백 제거)가 full_text 에 포함될 때 해당 citation_label 과 매칭
# citation_label 은 all_chunks.json 의 citation_label 필드와 정확히 일치해야 함

GENERAL_KEYWORD_LAW_MAP: dict[str, list[str]] = {
    # 경업금지
    "경업금지": [
        "근로기준법 제7조 (강제 근로의 금지)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    # 손해배상
    "손해배상": [
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    # 위약금
    "위약금": [
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    # 전속계약
    "전속계약": [
        "근로기준법 제7조 (강제 근로의 금지)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    # 임금 공제
    "임금공제": [
        "근로기준법 제43조 (임금 지급)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    "임금삭감": [
        "근로기준법 제43조 (임금 지급)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    # 해고
    "해고": [
        "근로기준법 제23조 (해고 등의 제한)",
        "근로기준법 제27조 (해고사유 등의 서면통지)",
    ],
    "즉시해고": [
        "근로기준법 제23조 (해고 등의 제한)",
        "근로기준법 제26조 (해고의 예고)",
    ],
    # 연장근로
    "연장근로": [
        "근로기준법 제53조 (연장 근로의 제한)",
    ],
    "초과근무": [
        "근로기준법 제53조 (연장 근로의 제한)",
    ],
    # 수습기간
    "수습": [
        "최저임금법 제7조 (최저임금의 적용 제외)",
    ],
    "수습기간": [
        "최저임금법 제7조 (최저임금의 적용 제외)",
    ],
    # 비밀유지
    "비밀유지": [
        "근로기준법 제7조 (강제 근로의 금지)",
    ],
    "영업비밀": [
        "근로기준법 제7조 (강제 근로의 금지)",
    ],
    # 퇴직금
    "퇴직금": [
        "근로자퇴직급여 보장법 제4조 (퇴직급여제도의 설정)",
        "근로자퇴직급여 보장법 제8조 (퇴직금제도의 설정 등)",
    ],
    # 시용기간
    "시용기간": [
        "근로기준법 제23조 (해고 등의 제한)",
    ],
}

FOREIGN_KEYWORD_LAW_MAP: dict[str, list[str]] = {
    "기숙사비": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "근로기준법 제43조 (임금 지급)",
    ],
    "숙소비": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "근로기준법 제43조 (임금 지급)",
    ],
    "숙식": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "근로기준법 제4조 (근로조건의 결정)",
    ],
    "기숙사": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "산업안전보건법 제5조 (사업주 등의 의무)",
    ],
    "숙소": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "산업안전보건법 제5조 (사업주 등의 의무)",
    ],
    "비닐하우스": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "산업안전보건법 제5조 (사업주 등의 의무)",
    ],
    "가건물": [
        "외국인근로자의 고용 등에 관한 법률 제22조 (기숙사의 제공 등) [중복순번 2]",
        "산업안전보건법 제5조 (사업주 등의 의무)",
    ],
    "사업장변경": [
        "외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    "사업장이탈": [
        "외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    "이직": [
        "외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)",
        "근로기준법 제20조 (위약 예정의 금지)",
    ],
    "여권": [
        "근로기준법 제7조 (강제 근로의 금지)",
        "외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)",
    ],
    "외국인등록증": [
        "근로기준법 제7조 (강제 근로의 금지)",
        "외국인근로자의 고용 등에 관한 법률 제25조 (사업 또는 사업장 변경의 허용)",
    ],
}

def _build_citation_index(chunks: list[dict]) -> dict[str, dict]:
    """citation_label → chunk 딕셔너리 인덱스 생성."""
    return {c["citation_label"]: c for c in chunks}


def _normalize_citation_label(label: str) -> str:
    """공백/구두점 차이를 흡수하기 위한 citation_label 정규화."""
    return (
        label.replace(" ", "")
             .replace("ㆍ", "")
             .replace("·", "")
             .replace(",", "")
             .lower()
    )


def _find_chunk_by_citation(citation_index: dict[str, dict], citation_label: str) -> dict | None:
    """정확 일치 후 정규화 일치 순서로 청크를 찾는다."""
    exact = citation_index.get(citation_label)
    if exact is not None:
        return exact

    normalized_target = _normalize_citation_label(citation_label)
    for label, chunk in citation_index.items():
        if _normalize_citation_label(label) == normalized_target:
            return chunk
    return None


# ── 키워드 추출 ────────────────────────────────────────────────────────────────

def _is_confirmed_foreign_worker(worker_context: dict | None) -> bool:
    if not worker_context:
        return False
    return (
        worker_context.get("worker_group") == "foreign_worker"
        and worker_context.get("worker_group_confidence") == "confirmed"
    )


def extract_keywords(full_text: str, worker_context: dict | None = None) -> list[str]:
    """
    항목 원문에서 KEYWORD_LAW_MAP 키와 매칭되는 키워드를 추출한다.
    공백 제거 후 비교.
    """
    normalized = full_text.replace(" ", "")
    matched = []
    keyword_map = dict(GENERAL_KEYWORD_LAW_MAP)
    if _is_confirmed_foreign_worker(worker_context):
        keyword_map.update(FOREIGN_KEYWORD_LAW_MAP)
    for keyword in keyword_map:
        if keyword in normalized:
            matched.append(keyword)
    return matched


# ── 법령 조회 ─────────────────────────────────────────────────────────────────

def retrieve_law_chunks(
    full_text: str,
    chunks: list[dict],
    max_fallback: int = 5,
    worker_context: dict | None = None,
) -> list[dict]:
    """
    full_text 에서 키워드를 추출해 관련 청크를 반환한다.

    전략:
        1. KEYWORD_LAW_MAP 매칭 → citation_label 로 청크 조회
        2. 매칭 없으면 → doc_type="법률" + tier=1 상위 max_fallback 개 반환

    반환:
        [{"chunk_id", "citation_label", "content_normalized", "law_name"}, ...]
    """
    keywords = extract_keywords(full_text, worker_context)
    citation_index = _build_citation_index(chunks)
    keyword_map = dict(GENERAL_KEYWORD_LAW_MAP)
    if _is_confirmed_foreign_worker(worker_context):
        keyword_map.update(FOREIGN_KEYWORD_LAW_MAP)

    found_chunks: list[dict] = []
    seen_ids: set[str] = set()

    if keywords:
        for keyword in keywords:
            for citation_label in keyword_map[keyword]:
                chunk = _find_chunk_by_citation(citation_index, citation_label)
                if chunk and chunk["chunk_id"] not in seen_ids:
                    found_chunks.append({
                        "chunk_id":           chunk["chunk_id"],
                        "citation_label":     chunk["citation_label"],
                        "content_normalized": chunk["content_normalized"],
                        "law_name":           chunk["law_name"],
                        "matched_keyword":    keyword,
                    })
                    seen_ids.add(chunk["chunk_id"])
    else:
        # fallback: 핵심 법률 tier=1 조문 상위 반환
        fallback = [
            c for c in chunks
            if c["doc_type"] == "법률" and c.get("tier", 99) == 1
        ][:max_fallback]
        for chunk in fallback:
            if chunk["chunk_id"] not in seen_ids:
                found_chunks.append({
                    "chunk_id":           chunk["chunk_id"],
                    "citation_label":     chunk["citation_label"],
                    "content_normalized": chunk["content_normalized"],
                    "law_name":           chunk["law_name"],
                    "matched_keyword":    None,  # fallback
                })
                seen_ids.add(chunk["chunk_id"])

    return found_chunks


# ── 공개 인터페이스 ──────────────────────────────────────────────────────────

def build_extra_law_map(
    extra_sections: list[dict],
    all_chunks: list[dict],
    worker_context: dict | None = None,
) -> dict[str, list[dict]]:
    """
    extra 항목 목록을 받아 각 항목에 관련된 법 조문 청크를 반환한다.

    매개변수:
        extra_sections: section_comparator.compare_sections() 의 extra 값
            [{"number": "12", "title": "경업금지", "full_text": "..."}, ...]
        all_chunks: startup 시점에 적재된 청크 목록

    반환:
        {
            "12": [{"chunk_id": "...", "citation_label": "...", ...}, ...],
            "13": [...],
        }
    """
    extra_law_map: dict[str, list[dict]] = {}

    for sec in extra_sections:
        sec_no    = sec["number"]
        full_text = sec.get("full_text", sec.get("title", ""))
        law_chunks_for_sec = retrieve_law_chunks(full_text, all_chunks, worker_context=worker_context)
        extra_law_map[sec_no] = law_chunks_for_sec

    return extra_law_map
