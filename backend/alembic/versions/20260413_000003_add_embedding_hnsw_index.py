"""add embedding hnsw index

Revision ID: 20260413_000003
Revises: 20260413_000002
Create Date: 2026-04-13 16:00:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260413_000003"
down_revision = "20260413_000002"
branch_labels = None
depends_on = None

INDEX_NAME = "idx_law_chunks_embedding"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            f"""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME}
            ON law_chunks
            USING hnsw (embedding vector_cosine_ops)
            """
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
