from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class AfterArtifactRun(Base):
    __tablename__ = "after_artifact_runs"
    __table_args__ = (
        Index("idx_after_artifact_runs_user_id", "user_id"),
        Index("idx_after_artifact_runs_source_bridge_run_id", "source_bridge_run_id"),
        Index("idx_after_artifact_runs_stage", "stage"),
        Index("idx_after_artifact_runs_updated_at", "updated_at"),
    )

    run_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", name="fk_after_artifact_runs_user_id_users"),
        nullable=True,
    )
    source_bridge_run_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey(
            "bridge_runs.bridge_run_id",
            name="fk_after_artifact_runs_source_bridge_run_id_bridge_runs",
        ),
        nullable=True,
    )
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    query_hash: Mapped[str | None] = mapped_column(String(12), nullable=True)
    document_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    artifact_root: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
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
