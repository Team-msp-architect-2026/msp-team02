"""add scn001 history visibility fields

Revision ID: 20260427_000007
Revises: 20260422_000006
Create Date: 2026-04-27 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260427_000007"
down_revision = "20260422_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "before_review_jobs",
        sa.Column("user_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "before_review_jobs",
        sa.Column("user_hidden_by_user_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "idx_before_review_jobs_user_hidden_at",
        "before_review_jobs",
        ["user_hidden_at"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_before_review_jobs_user_hidden_by_user_id_users",
        "before_review_jobs",
        "users",
        ["user_hidden_by_user_id"],
        ["id"],
    )

    op.add_column(
        "bridge_runs",
        sa.Column("user_hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "bridge_runs",
        sa.Column("user_hidden_by_user_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "idx_bridge_runs_user_hidden_at",
        "bridge_runs",
        ["user_hidden_at"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_bridge_runs_user_hidden_by_user_id_users",
        "bridge_runs",
        "users",
        ["user_hidden_by_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_bridge_runs_user_hidden_by_user_id_users",
        "bridge_runs",
        type_="foreignkey",
    )
    op.drop_index("idx_bridge_runs_user_hidden_at", table_name="bridge_runs")
    op.drop_column("bridge_runs", "user_hidden_by_user_id")
    op.drop_column("bridge_runs", "user_hidden_at")

    op.drop_constraint(
        "fk_before_review_jobs_user_hidden_by_user_id_users",
        "before_review_jobs",
        type_="foreignkey",
    )
    op.drop_index(
        "idx_before_review_jobs_user_hidden_at",
        table_name="before_review_jobs",
    )
    op.drop_column("before_review_jobs", "user_hidden_by_user_id")
    op.drop_column("before_review_jobs", "user_hidden_at")
