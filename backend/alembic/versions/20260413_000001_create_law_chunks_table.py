"""create law_chunks table

Revision ID: 20260413_000001
Revises:
Create Date: 2026-04-13 00:00:01
"""

from __future__ import annotations

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260413_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "law_chunks",
        sa.Column("chunk_id", sa.String(), nullable=False),
        sa.Column("law_name", sa.String(length=200), nullable=False),
        sa.Column("full_title", sa.String(length=300), nullable=False),
        sa.Column("doc_type", sa.String(length=50), nullable=False),
        sa.Column("legal_type", sa.String(length=50), nullable=False),
        sa.Column("law_mst", sa.String(length=20), nullable=False),
        sa.Column("law_id", sa.String(length=20), nullable=False),
        sa.Column("ministry", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "field",
            sa.String(length=100),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column("part", sa.String(length=100), nullable=True),
        sa.Column("chapter", sa.String(length=200), nullable=True),
        sa.Column("section", sa.String(length=200), nullable=True),
        sa.Column("subsection", sa.String(length=200), nullable=True),
        sa.Column("structure_path", sa.Text(), nullable=False),
        sa.Column("article_no", sa.String(length=30), nullable=False),
        sa.Column("article_ordinal", sa.Integer(), nullable=False),
        sa.Column("article_title", sa.String(length=200), nullable=False),
        sa.Column("article_label", sa.String(length=200), nullable=False),
        sa.Column("parent_article", sa.String(length=30), nullable=True),
        sa.Column("paragraph_no", sa.Integer(), nullable=True),
        sa.Column("citation_label", sa.String(length=300), nullable=False),
        sa.Column(
            "chunk_id_suffix",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_normalized", sa.Text(), nullable=False),
        sa.Column("embedding_text", sa.Text(), nullable=False),
        sa.Column("char_count_original", sa.Integer(), nullable=False),
        sa.Column("char_count_normalized", sa.Integer(), nullable=False),
        sa.Column("promulgation_date", sa.Date(), nullable=True),
        sa.Column("enforcement_date", sa.Date(), nullable=True),
        sa.Column("selected_as_of", sa.Date(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("relative_path", sa.Text(), nullable=False),
        sa.Column("selected_commit", sa.String(length=64), nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.PrimaryKeyConstraint("chunk_id"),
    )
    op.create_index(
        "idx_law_chunks_law_name",
        "law_chunks",
        ["law_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_law_chunks_law_name", table_name="law_chunks")
    op.drop_table("law_chunks")
