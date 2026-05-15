from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RetrievalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    top_k: int = Field(default=5, ge=1, le=10)
    ef_search: int = Field(default=100, ge=10, le=500)


class ChunkResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunk_id: str
    citation_label: str
    law_name: str
    article_no: str
    article_title: str
    paragraph_no: int | None
    content: str
    similarity: float
    tier: int
    structure_path: str | None


class RetrievalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    total: int
    chunks: list[ChunkResult]
    cited_articles: list[str]
