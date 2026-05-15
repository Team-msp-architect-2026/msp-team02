from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .retrieval import ChunkResult


class AnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    top_k: int = Field(default=5, ge=1, le=10)
    ef_search: int = Field(default=100, ge=10, le=500)


class GroundedChunkResult(ChunkResult):
    context_id: int


class AnswerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    answer: str
    key_points: list[str]
    cautions: list[str]
    cited_articles: list[str]
    grounded_context_ids: list[int]
    retrieved_chunks: list[GroundedChunkResult]
    retrieval_total: int
    model_name: str
