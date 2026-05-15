from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, status
from google.api_core.exceptions import GoogleAPICallError, RetryError
from google.auth.exceptions import DefaultCredentialsError, TransportError
from google.genai.errors import APIError as GenAIAPIError
from requests.exceptions import RequestException
from sqlalchemy.exc import SQLAlchemyError

from backend.app.schemas.retrieval import (
    ChunkResult,
    RetrievalRequest,
    RetrievalResponse,
)
from backend.app.services.embedding import VertexEmbeddingError
from backend.app.services.embedding import (
    VertexProviderRuntimeError,
    VertexProviderTimeoutError,
)
from backend.app.services.retrieval import retrieve_law_chunks

router = APIRouter(prefix="/api/v1", tags=["retrieval"])
logger = logging.getLogger(__name__)


def query_hash(query: str) -> str:
    return hashlib.sha256(query.encode("utf-8")).hexdigest()[:12]


@router.post("/retrieve", response_model=RetrievalResponse)
def retrieve(payload: RetrievalRequest) -> RetrievalResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="query must not be blank",
        )

    started_at = time.perf_counter()
    query_digest = query_hash(query)
    try:
        result = retrieve_law_chunks(
            query=query,
            top_k=payload.top_k,
            ef_search=payload.ef_search,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except (
        DefaultCredentialsError,
        FileNotFoundError,
        GoogleAPICallError,
        GenAIAPIError,
        RequestException,
        RetryError,
        TransportError,
        VertexEmbeddingError,
    ) as exc:
        logger.exception(
            "retrieval.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=query_embedding",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="query embedding is currently unavailable",
        ) from exc
    except VertexProviderTimeoutError as exc:
        logger.exception(
            "retrieval.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=provider_timeout",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="query embedding provider timed out",
        ) from exc
    except VertexProviderRuntimeError as exc:
        logger.exception(
            "retrieval.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=provider_runtime",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="query embedding is currently unavailable",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception(
            "retrieval.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=database",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="retrieval database is currently unavailable",
        ) from exc
    except Exception as exc:
        logger.exception(
            "retrieval.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=internal",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="internal retrieval error",
        ) from exc

    logger.info(
        "retrieval.completed query_hash=%s latency_ms=%d top_k=%d ef_search=%d total=%d cited_count=%d query_sanitized=%s",
        query_digest,
        int((time.perf_counter() - started_at) * 1000),
        payload.top_k,
        payload.ef_search,
        result.total,
        len(result.cited_articles),
        str(result.grounding_query != result.query).lower(),
    )

    return RetrievalResponse(
        query=result.query,
        total=result.total,
        cited_articles=result.cited_articles,
        chunks=[ChunkResult(**asdict(chunk)) for chunk in result.chunks],
    )
