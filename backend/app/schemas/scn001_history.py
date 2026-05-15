from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.bridge import OverallResult, Severity, SourceScenario


SafeIdentifier = Annotated[str, Field(min_length=1, max_length=120)]
SafeSummary = Annotated[str, Field(min_length=1, max_length=700)]
SafeLabel = Annotated[str, Field(min_length=1, max_length=120)]
SafeAction = Annotated[str, Field(min_length=1, max_length=400)]


class StrictHistorySchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        str_min_length=1,
    )


class BeforeReviewJobHistoryItem(StrictHistorySchema):
    before_review_job_id: SafeIdentifier
    status: SafeLabel
    created_at: datetime
    updated_at: datetime
    overall_result: OverallResult | None = None
    overall_severity: Severity | None = None
    summary: SafeSummary | None = None
    has_bridge_run: bool


class BeforeReviewJobHistoryDetail(BeforeReviewJobHistoryItem):
    pass


class BridgeRunHistoryItem(StrictHistorySchema):
    bridge_run_id: SafeIdentifier
    before_review_job_id: SafeIdentifier | None = None
    scenario_id: SafeLabel
    source_scenario: SourceScenario
    user_visible_summary: SafeSummary
    issue_categories: list[SafeLabel] = Field(default_factory=list)
    risk_tags: list[SafeLabel] = Field(default_factory=list)
    law_refs: list[SafeLabel] = Field(default_factory=list)
    recommended_next_actions: list[SafeAction] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
