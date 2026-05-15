from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class BridgeRun(Base):
    __tablename__ = "bridge_runs"
    __table_args__ = (
        Index("idx_bridge_runs_user_id", "user_id"),
        Index("idx_bridge_runs_before_review_job_id", "before_review_job_id"),
        Index("idx_bridge_runs_scenario_id", "scenario_id"),
        Index("idx_bridge_runs_created_at", "created_at"),
        Index("idx_bridge_runs_user_hidden_at", "user_hidden_at"),
    )

    bridge_run_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_bridge_runs_user_id_users"),
        nullable=False,
    )
    user_hidden_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    user_hidden_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "users.id",
            name="fk_bridge_runs_user_hidden_by_user_id_users",
        ),
        nullable=True,
    )
    before_review_job_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey(
            "before_review_jobs.job_id",
            name="fk_bridge_runs_before_review_job_id_before_review_jobs",
        ),
        nullable=True,
    )
    scenario_id: Mapped[str] = mapped_column(String(20), nullable=False)
    source_scenario: Mapped[str] = mapped_column(String(20), nullable=False)
    preset_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_visible_summary: Mapped[str] = mapped_column(Text, nullable=False)
    issue_categories: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    risk_tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    detected_issues: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    law_refs: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    recommended_next_actions: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    after_query_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    artifact_refs: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
