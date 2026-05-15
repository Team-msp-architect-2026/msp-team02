"""make structure_path nullable

Revision ID: 20260413_000002
Revises: 20260413_000001
Create Date: 2026-04-13 00:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260413_000002"
down_revision = "20260413_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "law_chunks",
        "structure_path",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "law_chunks",
        "structure_path",
        existing_type=sa.Text(),
        nullable=False,
    )
