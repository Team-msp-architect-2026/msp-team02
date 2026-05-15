from __future__ import annotations

from datetime import date

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class LawChunk(Base):
    __tablename__ = "law_chunks"
    __table_args__ = (Index("idx_law_chunks_law_name", "law_name"),)

    chunk_id: Mapped[str] = mapped_column(String, primary_key=True)

    law_name: Mapped[str] = mapped_column(String(200), nullable=False)
    full_title: Mapped[str] = mapped_column(String(300), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    legal_type: Mapped[str] = mapped_column(String(50), nullable=False)
    law_mst: Mapped[str] = mapped_column(String(20), nullable=False)
    law_id: Mapped[str] = mapped_column(String(20), nullable=False)
    ministry: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    law_field: Mapped[str] = mapped_column(
        "field",
        String(100),
        nullable=False,
        default="",
        server_default=text("''"),
    )

    part: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chapter: Mapped[str | None] = mapped_column(String(200), nullable=True)
    section: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subsection: Mapped[str | None] = mapped_column(String(200), nullable=True)
    structure_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    article_no: Mapped[str] = mapped_column(String(30), nullable=False)
    article_ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    article_title: Mapped[str] = mapped_column(String(200), nullable=False)
    article_label: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_article: Mapped[str | None] = mapped_column(String(30), nullable=True)
    paragraph_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    citation_label: Mapped[str] = mapped_column(String(300), nullable=False)
    chunk_id_suffix: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
        server_default=text("''"),
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_normalized: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_text: Mapped[str] = mapped_column(Text, nullable=False)
    char_count_original: Mapped[int] = mapped_column(Integer, nullable=False)
    char_count_normalized: Mapped[int] = mapped_column(Integer, nullable=False)

    promulgation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    enforcement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    selected_as_of: Mapped[date] = mapped_column(Date, nullable=False)

    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_ref: Mapped[str] = mapped_column(Text, nullable=False)
    relative_path: Mapped[str] = mapped_column(Text, nullable=False)
    selected_commit: Mapped[str] = mapped_column(String(64), nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
