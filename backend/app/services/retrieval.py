from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Sequence

from sqlalchemy import literal, select, text

from backend.app.db import SessionLocal
from backend.app.models import LawChunk
from backend.app.services.embedding import OUTPUT_DIMENSIONALITY, embed_query

DEFAULT_TOP_K = 5
DEFAULT_EF_SEARCH = 100
MAX_TOP_K = 10
MIN_EF_SEARCH = 10
MAX_EF_SEARCH = 500
SEGMENT_SPLIT_PATTERN = re.compile(r"(?:\n+|(?<=[.!?])\s+)")
SELECTIVE_DECOMPOSITION_MIN_TOP_K = 8
SELECTIVE_DECOMPOSITION_MIN_QUERY_CHARS = 80
SELECTIVE_DECOMPOSITION_BRANCH_SEARCH_TOP_K = 5
FOREIGN_WORKER_FULL_QUERY_MARKERS = ("외국인", "외국인근로자")
FOREIGN_WORKER_CONTRACT_STAGE_MARKERS = (
    "계약서",
    "표준근로계약서",
    "근로계약",
    "서면",
    "말로만",
    "구두로만",
    "명시",
    "임금",
    "근무시간",
    "휴일",
)
FOREIGN_WORKER_DORMITORY_MARKERS = (
    "기숙사",
    "숙소",
    "숙소비",
    "비닐하우스",
    "주거",
)
FOREIGN_WORKER_DISCRIMINATION_MARKERS = (
    "차별",
    "폭언",
    "욕설",
    "모욕",
    "부당한 처우",
    "외국인이라고",
    "다르게 대우",
)
FOREIGN_WORKER_WORKPLACE_CHANGE_MARKERS = (
    "사업장 변경",
    "사업장을 변경",
    "사업장을 옮기",
    "사업장을 옮길",
    "사업장 옮길",
    "사업장을 바꾸",
    "사업장을 바꿀",
    "사업장 바꿀",
    "옮길 수",
    "근무처 변경",
)
INSTRUCTIONAL_SEGMENT_MARKERS = (
    "이전 지시",
    "지시를 무시",
    "규칙을 무시",
    "프롬프트",
    "system prompt",
    "assistant",
    "json만",
    "markdown",
    "코드펜스",
    "인용하라",
    "출력하라",
    "답하라",
)
INSTRUCTIONAL_CLAUSE_PATTERNS = (
    re.compile(r"(?:이전|위|앞의)?\s*지시[^.?!\n]*?(?:무시|따르지)[^.?!\n]*", re.IGNORECASE),
    re.compile(r"[^.?!\n]*?제\d+조(?:의\d+)?[^.?!\n]*?(?:인용하라|써라|출력하라)", re.IGNORECASE),
    re.compile(r"[^.?!\n]*?(?:json|markdown|코드펜스|system prompt|프롬프트)[^.?!\n]*?(?:출력|답|작성)하라", re.IGNORECASE),
)


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    citation_label: str
    law_name: str
    article_no: str
    article_title: str
    paragraph_no: int | None
    content: str
    similarity: float
    tier: int
    structure_path: str | None


@dataclass(frozen=True)
class RetrievalResult:
    query: str
    grounding_query: str
    total: int
    chunks: list[RetrievedChunk]
    cited_articles: list[str]


@dataclass(frozen=True)
class SelectiveQueryBranch:
    name: str
    query: str
    result_limit: int


def validate_search_params(top_k: int, ef_search: int) -> None:
    if not 1 <= top_k <= MAX_TOP_K:
        raise ValueError(f"top_k must be between 1 and {MAX_TOP_K}.")
    if not MIN_EF_SEARCH <= ef_search <= MAX_EF_SEARCH:
        raise ValueError(
            f"ef_search must be between {MIN_EF_SEARCH} and {MAX_EF_SEARCH}."
        )


def build_cited_articles(chunks: Iterable[RetrievedChunk]) -> list[str]:
    cited_articles: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        if chunk.citation_label in seen:
            continue
        cited_articles.append(chunk.citation_label)
        seen.add(chunk.citation_label)
    return cited_articles


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split()).strip()


def strip_instructional_clauses(query: str) -> str:
    sanitized = query
    for pattern in INSTRUCTIONAL_CLAUSE_PATTERNS:
        sanitized = pattern.sub(" ", sanitized)
    return normalize_whitespace(sanitized)


def is_instructional_segment(segment: str) -> bool:
    normalized = segment.lower()
    return any(marker in normalized for marker in INSTRUCTIONAL_SEGMENT_MARKERS)


def normalize_grounding_query(query: str) -> str:
    query_text = normalize_whitespace(query)
    if not query_text:
        return query_text

    clause_stripped = strip_instructional_clauses(query_text)
    segments = [
        segment.strip()
        for segment in SEGMENT_SPLIT_PATTERN.split(clause_stripped)
        if segment.strip()
    ]
    clean_segments = [segment for segment in segments if not is_instructional_segment(segment)]
    if clean_segments:
        return normalize_whitespace(
            re.sub(r"^[,.;:!?]+", "", " ".join(clean_segments)).strip()
        )
    if clause_stripped:
        return normalize_whitespace(re.sub(r"^[,.;:!?]+", "", clause_stripped).strip())
    return query_text


def has_any_marker(query: str, markers: Sequence[str]) -> bool:
    return any(marker in query for marker in markers)


def should_apply_selective_decomposition(query: str, *, top_k: int) -> bool:
    if top_k < SELECTIVE_DECOMPOSITION_MIN_TOP_K:
        return False

    query_text = normalize_whitespace(query)
    if len(query_text) < SELECTIVE_DECOMPOSITION_MIN_QUERY_CHARS:
        return False

    return (
        has_any_marker(query_text, FOREIGN_WORKER_FULL_QUERY_MARKERS)
        and has_any_marker(query_text, FOREIGN_WORKER_CONTRACT_STAGE_MARKERS)
        and has_any_marker(query_text, FOREIGN_WORKER_DORMITORY_MARKERS)
        and has_any_marker(query_text, FOREIGN_WORKER_DISCRIMINATION_MARKERS)
        and has_any_marker(query_text, FOREIGN_WORKER_WORKPLACE_CHANGE_MARKERS)
    )


def build_selective_query_branches(query: str) -> tuple[SelectiveQueryBranch, ...]:
    return (
        SelectiveQueryBranch(
            name="original",
            query=query,
            result_limit=4,
        ),
        SelectiveQueryBranch(
            name="contract_stage",
            query="근로계약 서면 명시 임금 근무시간 휴일 표준근로계약서 외국인",
            result_limit=3,
        ),
        SelectiveQueryBranch(
            name="discrimination",
            query="외국인 차별 금지 폭언 부당한 처우 기숙사 제공 숙소비 공제",
            result_limit=2,
        ),
        SelectiveQueryBranch(
            name="workplace_change",
            query="외국인 회사 잘못 사업장 변경 신청 기숙사 열악 차별 숙소비 공제",
            result_limit=2,
        ),
    )


def search_law_chunks_for_query(
    query: str,
    *,
    top_k: int,
    ef_search: int,
) -> list[RetrievedChunk]:
    query_vector = embed_query(query)
    return search_law_chunks(
        query_vector=query_vector,
        top_k=top_k,
        ef_search=ef_search,
    )


def retrieve_law_chunks_with_selective_decomposition(
    query: str,
    *,
    top_k: int,
    ef_search: int,
) -> list[RetrievedChunk]:
    selected_chunks: list[RetrievedChunk] = []
    seen_chunk_ids: set[str] = set()

    for branch in build_selective_query_branches(query):
        branch_chunks = search_law_chunks_for_query(
            branch.query,
            top_k=min(
                MAX_TOP_K,
                max(SELECTIVE_DECOMPOSITION_BRANCH_SEARCH_TOP_K, branch.result_limit + 2),
            ),
            ef_search=ef_search,
        )
        branch_selected = 0
        for chunk in branch_chunks:
            if chunk.chunk_id in seen_chunk_ids:
                continue
            selected_chunks.append(chunk)
            seen_chunk_ids.add(chunk.chunk_id)
            branch_selected += 1
            if branch_selected >= branch.result_limit or len(selected_chunks) >= top_k:
                break
        if len(selected_chunks) >= top_k:
            break

    return selected_chunks[:top_k]


def search_law_chunks(
    query_vector: Sequence[float],
    *,
    top_k: int = DEFAULT_TOP_K,
    ef_search: int = DEFAULT_EF_SEARCH,
) -> list[RetrievedChunk]:
    validate_search_params(top_k=top_k, ef_search=ef_search)
    if len(query_vector) != OUTPUT_DIMENSIONALITY:
        raise ValueError(
            "query_vector must be 768-dimensional. "
            f"Received {len(query_vector)} values."
        )

    distance_expr = LawChunk.embedding.cosine_distance(query_vector)
    similarity_expr = (literal(1.0) - distance_expr).label("similarity")

    statement = (
        select(
            LawChunk.chunk_id,
            LawChunk.citation_label,
            LawChunk.law_name,
            LawChunk.article_no,
            LawChunk.article_title,
            LawChunk.paragraph_no,
            LawChunk.content,
            LawChunk.tier,
            LawChunk.structure_path,
            similarity_expr,
        )
        .where(LawChunk.embedding.is_not(None))
        .order_by(distance_expr.asc())
        .limit(top_k)
    )

    with SessionLocal() as session:
        with session.begin():
            # PostgreSQL `SET LOCAL` does not bind cleanly through SQLAlchemy here,
            # so only the already range-validated integer is interpolated.
            session.execute(text(f"SET LOCAL hnsw.ef_search = {ef_search}"))
            rows = session.execute(statement).all()

    return [
        RetrievedChunk(
            chunk_id=row.chunk_id,
            citation_label=row.citation_label,
            law_name=row.law_name,
            article_no=row.article_no,
            article_title=row.article_title,
            paragraph_no=row.paragraph_no,
            content=row.content,
            similarity=float(row.similarity),
            tier=row.tier,
            structure_path=row.structure_path,
        )
        for row in rows
    ]


def retrieve_law_chunks(
    query: str,
    *,
    top_k: int = DEFAULT_TOP_K,
    ef_search: int = DEFAULT_EF_SEARCH,
) -> RetrievalResult:
    query_text = query.strip()
    if not query_text:
        raise ValueError("query must not be blank.")

    grounding_query = normalize_grounding_query(query_text)
    if should_apply_selective_decomposition(grounding_query, top_k=top_k):
        chunks = retrieve_law_chunks_with_selective_decomposition(
            grounding_query,
            top_k=top_k,
            ef_search=ef_search,
        )
    else:
        chunks = search_law_chunks_for_query(
            grounding_query,
            top_k=top_k,
            ef_search=ef_search,
        )
    return RetrievalResult(
        query=query_text,
        grounding_query=grounding_query,
        total=len(chunks),
        chunks=chunks,
        cited_articles=build_cited_articles(chunks),
    )
