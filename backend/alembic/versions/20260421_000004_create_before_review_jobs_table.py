"""create before_review_jobs table

Revision ID: 20260421_000004
Revises: 20260413_000003
Create Date: 2026-04-21 15:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260421_000004"
down_revision = "20260413_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "before_review_jobs",
        sa.Column("job_id", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("run_directory", sa.Text(), nullable=True),
        sa.Column("steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("job_id"),
    )
    op.create_index(
        "idx_before_review_jobs_status",
        "before_review_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "idx_before_review_jobs_updated_at",
        "before_review_jobs",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_before_review_jobs_updated_at", table_name="before_review_jobs")
    op.drop_index("idx_before_review_jobs_status", table_name="before_review_jobs")
    op.drop_table("before_review_jobs")
