"""add user bridge linkage tables

Revision ID: 20260422_000006
Revises: 20260421_000005
Create Date: 2026-04-22 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260422_000006"
down_revision = "20260421_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("auth_provider", sa.String(length=32), nullable=False),
        sa.Column("provider_subject", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "auth_provider",
            "provider_subject",
            name="uq_users_auth_provider_provider_subject",
        ),
    )

    op.add_column(
        "before_review_jobs",
        sa.Column("user_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "idx_before_review_jobs_user_id",
        "before_review_jobs",
        ["user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_before_review_jobs_user_id_users",
        "before_review_jobs",
        "users",
        ["user_id"],
        ["id"],
    )

    op.create_table(
        "bridge_runs",
        sa.Column("bridge_run_id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("before_review_job_id", sa.String(length=32), nullable=True),
        sa.Column("scenario_id", sa.String(length=20), nullable=False),
        sa.Column("source_scenario", sa.String(length=20), nullable=False),
        sa.Column("preset_id", sa.String(length=50), nullable=True),
        sa.Column("user_visible_summary", sa.Text(), nullable=False),
        sa.Column(
            "issue_categories",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "risk_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "detected_issues",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "law_refs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "recommended_next_actions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("after_query_seed_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "artifact_refs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
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
        sa.ForeignKeyConstraint(
            ["before_review_job_id"],
            ["before_review_jobs.job_id"],
            name="fk_bridge_runs_before_review_job_id_before_review_jobs",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_bridge_runs_user_id_users",
        ),
        sa.PrimaryKeyConstraint("bridge_run_id"),
    )
    op.create_index(
        "idx_bridge_runs_user_id",
        "bridge_runs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "idx_bridge_runs_before_review_job_id",
        "bridge_runs",
        ["before_review_job_id"],
        unique=False,
    )
    op.create_index(
        "idx_bridge_runs_scenario_id",
        "bridge_runs",
        ["scenario_id"],
        unique=False,
    )
    op.create_index(
        "idx_bridge_runs_created_at",
        "bridge_runs",
        ["created_at"],
        unique=False,
    )

    op.add_column(
        "after_artifact_runs",
        sa.Column("user_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "after_artifact_runs",
        sa.Column("source_bridge_run_id", sa.String(length=32), nullable=True),
    )
    op.create_index(
        "idx_after_artifact_runs_user_id",
        "after_artifact_runs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "idx_after_artifact_runs_source_bridge_run_id",
        "after_artifact_runs",
        ["source_bridge_run_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_after_artifact_runs_user_id_users",
        "after_artifact_runs",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_after_artifact_runs_source_bridge_run_id_bridge_runs",
        "after_artifact_runs",
        "bridge_runs",
        ["source_bridge_run_id"],
        ["bridge_run_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_after_artifact_runs_source_bridge_run_id_bridge_runs",
        "after_artifact_runs",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_after_artifact_runs_user_id_users",
        "after_artifact_runs",
        type_="foreignkey",
    )
    op.drop_index(
        "idx_after_artifact_runs_source_bridge_run_id",
        table_name="after_artifact_runs",
    )
    op.drop_index(
        "idx_after_artifact_runs_user_id",
        table_name="after_artifact_runs",
    )
    op.drop_column("after_artifact_runs", "source_bridge_run_id")
    op.drop_column("after_artifact_runs", "user_id")

    op.drop_index("idx_bridge_runs_created_at", table_name="bridge_runs")
    op.drop_index("idx_bridge_runs_scenario_id", table_name="bridge_runs")
    op.drop_index("idx_bridge_runs_before_review_job_id", table_name="bridge_runs")
    op.drop_index("idx_bridge_runs_user_id", table_name="bridge_runs")
    op.drop_table("bridge_runs")

    op.drop_constraint(
        "fk_before_review_jobs_user_id_users",
        "before_review_jobs",
        type_="foreignkey",
    )
    op.drop_index("idx_before_review_jobs_user_id", table_name="before_review_jobs")
    op.drop_column("before_review_jobs", "user_id")

    op.drop_table("users")
