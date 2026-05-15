from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


def stable_fixture_dumps(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def write_fixture_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.write_text(stable_fixture_dumps(payload), encoding="utf-8")


def legal_basis_from_answer_response(
    answer_response: Mapping[str, Any],
) -> dict[str, Any]:
    """Map /api/v1/answer output to DocumentDraft LegalBasisInput fixture JSON."""
    grounded_context_ids = list(answer_response["grounded_context_ids"])
    grounded_context_id_set = set(grounded_context_ids)
    retrieved_chunks = [
        dict(chunk)
        for chunk in answer_response["retrieved_chunks"]
        if chunk["context_id"] in grounded_context_id_set
    ]
    return {
        "answer_query": answer_response["query"],
        "answer": answer_response["answer"],
        "key_points": answer_response["key_points"],
        "cautions": answer_response["cautions"],
        "cited_articles": answer_response["cited_articles"],
        "source_context_ids": grounded_context_ids,
        "retrieved_chunks": retrieved_chunks,
    }


def assert_answer_derived_legal_basis_mapping(legal_basis: Mapping[str, Any]) -> None:
    answer_response_shape = {
        "query": legal_basis["answer_query"],
        "answer": legal_basis["answer"],
        "key_points": legal_basis["key_points"],
        "cautions": legal_basis["cautions"],
        "cited_articles": legal_basis["cited_articles"],
        "grounded_context_ids": legal_basis["source_context_ids"],
        "retrieved_chunks": legal_basis["retrieved_chunks"],
    }
    assert legal_basis_from_answer_response(answer_response_shape) == legal_basis
