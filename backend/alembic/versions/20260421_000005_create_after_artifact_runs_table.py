"""create after_artifact_runs table

Revision ID: 20260421_000005
Revises: 20260421_000004
Create Date: 2026-04-21 16:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260421_000005"
down_revision = "20260421_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "after_artifact_runs",
        sa.Column("run_id", sa.String(length=32), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("query_hash", sa.String(length=12), nullable=True),
        sa.Column("document_type", sa.String(length=80), nullable=True),
        sa.Column("artifact_root", sa.Text(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("run_id"),
    )
    op.create_index(
        "idx_after_artifact_runs_stage",
        "after_artifact_runs",
        ["stage"],
        unique=False,
    )
    op.create_index(
        "idx_after_artifact_runs_updated_at",
        "after_artifact_runs",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_after_artifact_runs_updated_at", table_name="after_artifact_runs")
    op.drop_index("idx_after_artifact_runs_stage", table_name="after_artifact_runs")
    op.drop_table("after_artifact_runs")
