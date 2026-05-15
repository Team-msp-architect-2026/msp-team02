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

from backend.app.schemas.answer import (
    AnswerRequest,
    AnswerResponse,
    GroundedChunkResult,
)
from backend.app.services.embedding import VertexEmbeddingError
from backend.app.services.embedding import (
    VertexProviderRuntimeError,
    VertexProviderTimeoutError,
)
from backend.app.services.answer_generation import (
    GroundedAnswerGenerationError,
    answer_question,
)
from backend.app.services.after_artifact_store import (
    AfterArtifactLinkage,
    persist_answer_artifacts,
)

router = APIRouter(prefix="/api/v1", tags=["answer"])
logger = logging.getLogger(__name__)


def query_hash(query: str) -> str:
    return hashlib.sha256(query.encode("utf-8")).hexdigest()[:12]


def grounded_generation_http_response(
    error: GroundedAnswerGenerationError,
) -> tuple[int, str]:
    message = str(error)
    if (
        "outside grounded contexts" in message
        or "invalid structured payload" in message
        or "valid JSON" in message
        or "empty response" in message
        or "unknown retrieved context_id" in message
        or "cited_context_ids" in message
    ):
        return (
            status.HTTP_502_BAD_GATEWAY,
            "answer model returned an invalid grounded response",
        )
    return (
        status.HTTP_502_BAD_GATEWAY,
        "grounded answer generation failed validation",
    )


def generate_answer_response(
    payload: AnswerRequest,
    *,
    linkage: AfterArtifactLinkage | None = None,
    fail_on_artifact_error: bool = False,
) -> AnswerResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="query must not be blank",
        )

    started_at = time.perf_counter()
    query_digest = query_hash(query)
    try:
        result = answer_question(
            query=query,
            top_k=payload.top_k,
            ef_search=payload.ef_search,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except GroundedAnswerGenerationError as exc:
        response_status, response_detail = grounded_generation_http_response(exc)
        logger.exception(
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=grounded_generation status_code=%d",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
            response_status,
        )
        raise HTTPException(
            status_code=response_status,
            detail=response_detail,
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
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=vertex_runtime",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="answer generation is currently unavailable",
        ) from exc
    except VertexProviderTimeoutError as exc:
        logger.exception(
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=provider_timeout",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="answer generation provider timed out",
        ) from exc
    except VertexProviderRuntimeError as exc:
        logger.exception(
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=provider_runtime",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="answer generation is currently unavailable",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception(
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=database",
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
            "answer.failed query_hash=%s latency_ms=%d top_k=%d ef_search=%d reason=internal",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
            payload.top_k,
            payload.ef_search,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="internal answer generation error",
        ) from exc

    logger.info(
        "answer.completed query_hash=%s latency_ms=%d top_k=%d ef_search=%d retrieval_total=%d cited_count=%d grounded_count=%d query_sanitized=%s",
        query_digest,
        int((time.perf_counter() - started_at) * 1000),
        payload.top_k,
        payload.ef_search,
        result.retrieval_total,
        len(result.cited_articles),
        len(result.grounded_context_ids),
        str(result.grounding_query != result.query).lower(),
    )

    response_payload = AnswerResponse(
        query=result.query,
        answer=result.answer,
        key_points=result.key_points,
        cautions=result.cautions,
        cited_articles=result.cited_articles,
        grounded_context_ids=result.grounded_context_ids,
        retrieved_chunks=[
            GroundedChunkResult(**asdict(chunk)) for chunk in result.retrieved_chunks
        ],
        retrieval_total=result.retrieval_total,
        model_name=result.model_name,
    )

    try:
        persist_answer_artifacts(payload, response_payload, linkage=linkage)
    except Exception as exc:
        logger.exception(
            "answer.artifact_persist_failed query_hash=%s latency_ms=%d",
            query_digest,
            int((time.perf_counter() - started_at) * 1000),
        )
        if fail_on_artifact_error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="answer artifact store is currently unavailable",
            ) from exc

    return response_payload


@router.post("/answer", response_model=AnswerResponse)
def answer(payload: AnswerRequest) -> AnswerResponse:
    return generate_answer_response(payload)
