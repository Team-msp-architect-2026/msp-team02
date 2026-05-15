from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.main import app
from backend.verify.document_draft_fixture_utils import (
    assert_answer_derived_legal_basis_mapping,
)


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"

STATIC_FIXTURE_CASES = [
    {
        "label": "manual_wage_complaint",
        "case_fixture": "document_draft_scn004_wage_complaint.json",
        "missing_fields": ["체불 기간", "임금 지급일"],
        "cautions": ["1년 미만"],
        "required_cited_articles": [
            "근로기준법 제36조 (금품 청산)",
            "근로자퇴직급여 보장법 제9조 (퇴직금의 지급 등)",
        ],
    },
    {
        "label": "manual_unfair_dismissal_brief",
        "case_fixture": "document_draft_scn004_unfair_dismissal_brief.json",
        "missing_fields": ["구제신청 취지"],
        "cautions": ["3개월", "5인 미만"],
        "required_cited_articles": [
            "근로기준법 제23조 (해고 등의 제한)",
            "근로기준법 제26조 (해고의 예고)",
            "근로기준법 제27조 (해고사유 등의 서면통지)",
            "근로기준법 제28조 (부당해고등의 구제신청)",
        ],
    },
]

ANSWER_DERIVED_FIXTURE_CASES = [
    {
        "label": "answer_derived_wage_complaint",
        "case_fixture": "document_draft_scn004_wage_complaint.json",
        "legal_basis_fixture": (
            "document_draft_scn004_answer_legal_basis_wage_complaint.json"
        ),
        "missing_fields": ["체불 기간", "임금 지급일"],
        "cautions": ["1년 미만"],
        "required_cited_articles": [
            "근로기준법 제36조 (금품 청산)",
            "근로자퇴직급여 보장법 제9조 (퇴직금의 지급 등)",
        ],
    },
    {
        "label": "answer_derived_unfair_dismissal_brief",
        "case_fixture": "document_draft_scn004_unfair_dismissal_brief.json",
        "legal_basis_fixture": (
            "document_draft_scn004_answer_legal_basis_unfair_dismissal_brief.json"
        ),
        "missing_fields": ["구제신청 취지"],
        "cautions": ["3개월", "5인 미만"],
        "required_cited_articles": [
            "근로기준법 제23조 (해고 등의 제한)",
            "근로기준법 제26조 (해고의 예고)",
            "근로기준법 제27조 (해고사유 등의 서면통지)",
            "근로기준법 제28조 (부당해고등의 구제신청)",
        ],
    },
]


def load_fixture(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def assert_contains(items: list[str], expected: str, label: str) -> None:
    assert any(expected in item for item in items), (
        f"{label} must contain {expected!r}; actual={items!r}"
    )


def request_payload_for_case(case_config: dict[str, Any]) -> dict[str, Any]:
    payload = load_fixture(FIXTURE_DIR / case_config["case_fixture"])
    if "legal_basis_fixture" in case_config:
        payload = copy.deepcopy(payload)
        payload["legal_basis"] = load_fixture(
            FIXTURE_DIR / case_config["legal_basis_fixture"]
        )
        assert_answer_derived_legal_basis_mapping(payload["legal_basis"])
    return payload


def check_fixture(client: TestClient, case_config: dict[str, Any]) -> None:
    payload = request_payload_for_case(case_config)
    response = client.post("/api/v1/documents/draft", json=payload)
    assert response.status_code == 200, response.text
    response_payload = response.json()

    case_intake = payload["case_intake"]
    legal_basis = payload["legal_basis"]

    assert response_payload["document_type"] == case_intake["document_type"]
    assert response_payload["rendered_text"].strip()
    assert set(response_payload["cited_articles"]).issubset(
        set(legal_basis["cited_articles"])
    )
    assert set(response_payload["source_context_ids"]).issubset(
        set(legal_basis["source_context_ids"])
    )
    for missing_legal_basis in response_payload["missing_legal_basis"]:
        assert missing_legal_basis not in response_payload["cited_articles"]
        assert missing_legal_basis not in legal_basis["cited_articles"]

    for cited_article in case_config["required_cited_articles"]:
        assert cited_article in response_payload["cited_articles"], (
            f"{case_config['label']} must keep cited article {cited_article!r}; "
            f"actual={response_payload['cited_articles']!r}"
        )
    for missing_field in case_config["missing_fields"]:
        assert_contains(response_payload["missing_fields"], missing_field, "missing_fields")
    for caution in case_config["cautions"]:
        assert_contains(response_payload["cautions"], caution, "cautions")

    print(
        f"ok {case_config['label']}: "
        f"document_type={response_payload['document_type']} "
        f"cited_articles={len(response_payload['cited_articles'])} "
        f"source_context_ids={response_payload['source_context_ids']} "
        f"missing_fields={len(response_payload['missing_fields'])} "
        f"cautions={len(response_payload['cautions'])}"
    )


def main() -> None:
    client = TestClient(app)
    for case_config in STATIC_FIXTURE_CASES:
        check_fixture(client, case_config)
    for case_config in ANSWER_DERIVED_FIXTURE_CASES:
        check_fixture(client, case_config)


if __name__ == "__main__":
    main()
