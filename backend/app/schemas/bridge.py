from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


ShortText = Annotated[str, Field(min_length=1, max_length=1000)]
SafeLabel = Annotated[str, Field(min_length=1, max_length=120)]
LawRef = SafeLabel
OverallResult = Literal["PASS", "WARNING", "VIOLATION"]
Severity = Literal["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
SourceScenario = Literal["before_review", "preset", "mock"]


class StrictSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        str_min_length=1,
    )


class DetectedIssue(StrictSchema):
    title: SafeLabel
    severity: Severity
    law_ref: LawRef | None = None
    description: ShortText


class EvidenceItemSummary(StrictSchema):
    title: SafeLabel
    summary: ShortText


class ArtifactRef(StrictSchema):
    kind: Literal["before_review_job", "before_review_result", "bridge_run"]
    ref: SafeLabel


class BeforeHandoffDTO(StrictSchema):
    before_review_job_id: SafeLabel
    review_id: SafeLabel
    scenario_id: Literal["SCN-001"] = "SCN-001"
    scenario_tags: list[SafeLabel] = Field(default_factory=list)
    contract_summary: ShortText
    overall_result: OverallResult
    overall_severity: Severity
    risk_tags: list[SafeLabel] = Field(default_factory=list)
    detected_issues: list[DetectedIssue] = Field(default_factory=list)
    law_refs: list[LawRef] = Field(default_factory=list)
    recommended_next_actions: list[ShortText] = Field(default_factory=list)
    evidence_items_summary: list[EvidenceItemSummary] = Field(default_factory=list)
    artifact_refs: list[ArtifactRef] = Field(default_factory=list)
    created_at: datetime


class BridgeOutputDTO(StrictSchema):
    bridge_run_id: SafeLabel
    before_review_job_id: SafeLabel
    scenario_id: Literal["SCN-001"] = "SCN-001"
    source_scenario: SourceScenario
    preset_id: SafeLabel | None = None
    user_visible_summary: ShortText
    issue_categories: list[SafeLabel] = Field(default_factory=list)
    risk_tags: list[SafeLabel] = Field(default_factory=list)
    detected_issues: list[DetectedIssue] = Field(default_factory=list)
    law_refs: list[LawRef] = Field(default_factory=list)
    recommended_next_actions: list[ShortText] = Field(default_factory=list)
    after_query_seed: ShortText | None = None
    after_query_seed_hash: Annotated[str, Field(min_length=64, max_length=64)]
    artifact_refs: list[ArtifactRef] = Field(default_factory=list)
    created_at: datetime


class CreateBridgeRunRequest(StrictSchema):
    before_review_job_id: SafeLabel


class BridgeRunResponse(BridgeOutputDTO):
    pass
