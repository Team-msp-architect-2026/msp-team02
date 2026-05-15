from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text

from backend.app.db import SessionLocal
from backend.app.models.law_chunk import LawChunk


def _serialize_date(value: date | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _law_chunk_to_before_dict(row: LawChunk) -> dict[str, Any]:
    return {
        "chunk_id": row.chunk_id,
        "law_name": row.law_name,
        "full_title": row.full_title,
        "doc_type": row.doc_type,
        "legal_type": row.legal_type,
        "law_mst": row.law_mst,
        "law_id": row.law_id,
        "ministry": row.ministry,
        "status": row.status,
        "field": row.law_field,
        "part": row.part,
        "chapter": row.chapter,
        "section": row.section,
        "subsection": row.subsection,
        "structure_path": row.structure_path,
        "article_no": row.article_no,
        "article_ordinal": row.article_ordinal,
        "article_title": row.article_title,
        "article_label": row.article_label,
        "parent_article": row.parent_article,
        "paragraph_no": row.paragraph_no,
        "citation_label": row.citation_label,
        "chunk_id_suffix": row.chunk_id_suffix,
        "content": row.content,
        "content_normalized": row.content_normalized,
        "embedding_text": row.embedding_text,
        "char_count_original": row.char_count_original,
        "char_count_normalized": row.char_count_normalized,
        "promulgation_date": _serialize_date(row.promulgation_date),
        "enforcement_date": _serialize_date(row.enforcement_date),
        "selected_as_of": _serialize_date(row.selected_as_of),
        "source_url": row.source_url,
        "source_ref": row.source_ref,
        "relative_path": row.relative_path,
        "selected_commit": row.selected_commit,
        "tier": row.tier,
    }


def _sort_before_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Keep a stable, law-file-first ordering that stays close to the frozen JSON corpus.
    def _article_no_key(article_no: str) -> tuple[int, ...]:
        numbers = tuple(int(value) for value in re.findall(r"\d+", article_no))
        return numbers or (0,)

    return sorted(
        chunks,
        key=lambda chunk: (
            chunk["relative_path"],
            _article_no_key(chunk["article_no"]),
            chunk["paragraph_no"] or 0,
            chunk["chunk_id_suffix"],
            chunk["chunk_id"],
        ),
    )


def load_all_chunks_from_file(law_chunks_path: Path) -> list[dict[str, Any]]:
    with law_chunks_path.open(encoding="utf-8") as file:
        loaded = json.load(file)
    return loaded


def load_all_chunks_from_db() -> list[dict[str, Any]]:
    with SessionLocal() as session:
        rows = session.query(LawChunk).all()
        chunks = [_law_chunk_to_before_dict(row) for row in rows]

        if inspect(session.bind).has_table("before_law_chunk_supplements"):
            supplement_rows = session.execute(
                text(
                    "SELECT payload "
                    "FROM before_law_chunk_supplements "
                    "ORDER BY chunk_id"
                )
            ).mappings()
            chunks.extend(row["payload"] for row in supplement_rows)

    return _sort_before_chunks(chunks)
