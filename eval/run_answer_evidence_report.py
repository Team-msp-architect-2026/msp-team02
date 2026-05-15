from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Literal

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.answer_generation import (
    build_answer_texts_for_citation_check,
    find_explicit_citation_grounding_violations,
)
from run_answer_eval import (
    DEFAULT_ITEM_TIMEOUT_SECONDS,
    classify_error,
    is_expected_point_covered,
    parse_eval_id_filter,
    run_eval_item_with_timeout,
)

DEFAULT_DATASET_PATH = REPO_ROOT / "eval" / "mvp_in_scope_eval_v1.json"
DEFAULT_MVP_TOP_K = 5
DEFAULT_EF_SEARCH = 100
DEFAULT_ANSWER_PREVIEW_CHARS = 220
Verdict = Literal["PASS", "PARTIAL", "FAIL"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate per-question answer evidence without pinning exact live LLM text."
        )
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to mvp_in_scope_eval_v1.json or scenario_demo_question_sets_v1.json.",
    )
    parser.add_argument(
        "--scenario-format",
        action="store_true",
        help=(
            "Read scenario_demo_question_sets_v1.json and flatten scenarios[*].questions. "
            "When --top-k is omitted, each question's recommended_top_k is used."
        ),
    )
    parser.add_argument(
        "--ids",
        nargs="+",
        help="Run only the specified item ids (space or comma separated).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of items to run after filtering. Defaults to all selected items.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        help=(
            "Number of retrieved chunks per question. Defaults to 5 for MVP eval, "
            "or recommended_top_k for scenario format."
        ),
    )
    parser.add_argument(
        "--ef-search",
        type=int,
        default=DEFAULT_EF_SEARCH,
        help="Runtime HNSW ef_search value.",
    )
    parser.add_argument(
        "--item-timeout-seconds",
        type=float,
        default=DEFAULT_ITEM_TIMEOUT_SECONDS,
        help="Hard wall-clock timeout for each eval item.",
    )
    parser.add_argument(
        "--model-name",
        help="Override answer generation model name.",
    )
    parser.add_argument(
        "--format",
        choices=("jsonl", "markdown"),
        default="jsonl",
        help="Report output format. JSONL is one record per eval question.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write the report to a file instead of stdout.",
    )
    parser.add_argument(
        "--answer-preview-chars",
        type=int,
        default=DEFAULT_ANSWER_PREVIEW_CHARS,
        help="Maximum answer preview characters to include. Use 0 to omit previews.",
    )
    parser.add_argument(
        "--fail-on-verdict",
        choices=("never", "fail", "partial"),
        default="never",
        help=(
            "Exit non-zero based on final verdicts. 'fail' fails on FAIL; "
            "'partial' fails on PARTIAL or FAIL. Default only reports evidence."
        ),
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be greater than 0.")
    if args.top_k is not None and args.top_k <= 0:
        raise ValueError("--top-k must be greater than 0.")
    if args.ef_search <= 0:
        raise ValueError("--ef-search must be greater than 0.")
    if args.item_timeout_seconds <= 0:
        raise ValueError("--item-timeout-seconds must be greater than 0.")
    if args.answer_preview_chars < 0:
        raise ValueError("--answer-preview-chars must be 0 or greater.")


def dedupe_preserve_order(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        deduped.append(value)
        seen.add(value)
    return deduped


def load_mvp_items(dataset_path: Path) -> list[dict[str, Any]]:
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Eval payload must be a top-level object.")

    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError('MVP eval payload must contain a top-level "items" list.')

    normalized_items: list[dict[str, Any]] = []
    for item in items:
        normalized_items.append(
            {
                **item,
                "dataset_format": "mvp",
                "expected_citation_source": "gold_citations",
                "expected_citations": item.get("gold_citations", []),
            }
        )
    return normalized_items


def load_scenario_items(dataset_path: Path) -> list[dict[str, Any]]:
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Scenario payload must be a top-level object.")

    scenarios = payload.get("scenarios")
    if not isinstance(scenarios, list):
        raise ValueError(
            'Scenario payload must contain a top-level "scenarios" list. '
            "Pass --scenario-format only for scenario_demo_question_sets_v1.json."
        )

    normalized_items: list[dict[str, Any]] = []
    for scenario in scenarios:
        questions = scenario.get("questions", [])
        if not isinstance(questions, list):
            raise ValueError(f"Scenario {scenario.get('scenario_id')} has no questions list.")
        scenario_metadata = {
            "scenario_id": scenario.get("scenario_id"),
            "scenario_type": scenario.get("scenario_type"),
            "scenario_name": scenario.get("scenario_name"),
            "coverage_status": scenario.get("coverage_status"),
            "demo_operation_note": scenario.get("demo_operation_note"),
        }
        for question in questions:
            normalized_items.append(
                {
                    **question,
                    **scenario_metadata,
                    "dataset_format": "scenario",
                    "expected_citation_source": "expected_citations",
                    "expected_citations": question.get("expected_citations", []),
                }
            )
    return normalized_items


def load_eval_items(dataset_path: Path, *, scenario_format: bool) -> list[dict[str, Any]]:
    if scenario_format:
        return load_scenario_items(dataset_path)
    return load_mvp_items(dataset_path)


def select_items(
    all_items: list[dict[str, Any]],
    *,
    raw_ids: list[str] | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    requested_ids = parse_eval_id_filter(raw_ids)
    if requested_ids:
        item_by_id = {item["id"]: item for item in all_items}
        missing_ids = [eval_id for eval_id in requested_ids if eval_id not in item_by_id]
        if missing_ids:
            raise ValueError(f"Unknown eval ids: {missing_ids}")
        selected = [item_by_id[eval_id] for eval_id in requested_ids]
    else:
        selected = list(all_items)

    if limit is not None:
        selected = selected[:limit]
    return selected


def effective_top_k(item: dict[str, Any], args: argparse.Namespace) -> int:
    if args.top_k is not None:
        return args.top_k
    if args.scenario_format:
        recommended_top_k = item.get("recommended_top_k")
        if isinstance(recommended_top_k, int) and recommended_top_k > 0:
            return recommended_top_k
    return DEFAULT_MVP_TOP_K


def compact_preview(text: str, max_chars: int) -> str | None:
    if max_chars <= 0:
        return None
    normalized = " ".join(text.split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 1]}..."


def context_id_validity(result: Any) -> dict[str, Any]:
    valid_context_ids = {chunk.context_id for chunk in result.retrieved_chunks}
    raw_context_ids = list(getattr(result, "raw_cited_context_ids", []))
    grounded_context_ids = list(getattr(result, "grounded_context_ids", []))
    invalid_raw_ids = [
        context_id for context_id in raw_context_ids if context_id not in valid_context_ids
    ]
    invalid_grounded_ids = [
        context_id for context_id in grounded_context_ids if context_id not in valid_context_ids
    ]
    return {
        "raw_cited_context_ids": raw_context_ids,
        "raw_cited_context_ids_valid": bool(raw_context_ids) and not invalid_raw_ids,
        "invalid_raw_cited_context_ids": invalid_raw_ids,
        "grounded_context_ids": grounded_context_ids,
        "grounded_context_ids_valid": bool(grounded_context_ids)
        and not invalid_grounded_ids,
        "invalid_grounded_context_ids": invalid_grounded_ids,
    }


def classify_expected_point_coverage(
    *,
    answer_text: str,
    expected_points: list[str],
) -> dict[str, Any]:
    covered_points: list[str] = []
    missing_points: list[str] = []
    for point in expected_points:
        if is_expected_point_covered(answer_text, point):
            covered_points.append(point)
        else:
            missing_points.append(point)
    return {
        "total": len(expected_points),
        "covered_count": len(covered_points),
        "missing_count": len(missing_points),
        "covered_points": covered_points,
        "missing_points": missing_points,
    }


def serialize_violations(violations: list[Any]) -> list[dict[str, str]]:
    return [
        {
            "category": violation.category,
            "raw_mention": violation.raw_mention,
            "detail": violation.detail,
        }
        for violation in violations
    ]


def decide_verdict(
    *,
    expected_citations: list[str],
    answer_expected_citation_hit: bool,
    cited_articles_present: bool,
    raw_context_ids_valid: bool,
    grounded_context_ids_valid: bool,
    citation_violations: list[dict[str, str]],
    missing_points: list[str],
) -> tuple[Verdict, str]:
    failure_reasons: list[str] = []
    if not cited_articles_present:
        failure_reasons.append("answer did not return cited_articles")
    if not raw_context_ids_valid:
        failure_reasons.append("raw cited context ids are empty or outside retrieved contexts")
    if not grounded_context_ids_valid:
        failure_reasons.append("grounded context ids are empty or outside retrieved contexts")
    if citation_violations:
        failure_reasons.append("explicit citation mentions are not grounded in cited contexts")
    if expected_citations and not answer_expected_citation_hit:
        failure_reasons.append("answer cited_articles did not include any expected citation")

    if failure_reasons:
        return "FAIL", "; ".join(failure_reasons)
    if missing_points:
        return (
            "PARTIAL",
            f"grounding and citation checks passed, but {len(missing_points)} expected point(s) were not covered",
        )
    return (
        "PASS",
        "expected citation hit, expected points covered, and grounding checks are clean",
    )


def build_error_record(
    *,
    item: dict[str, Any],
    effective_item_top_k: int,
    args: argparse.Namespace,
    error_type: str,
    error_message: str,
    latency_ms: int,
) -> dict[str, Any]:
    expected_points = list(item.get("expected_points", []))
    return {
        "id": item["id"],
        "question": item["question"],
        "dataset_format": item["dataset_format"],
        "scenario_id": item.get("scenario_id"),
        "phase": item.get("phase"),
        "label": item.get("label"),
        "expected_citation_source": item["expected_citation_source"],
        "expected_citations": list(item.get("expected_citations", [])),
        "retrieved_top_citation_labels": [],
        "answer_cited_articles": [],
        "retrieved_expected_citation_hit": False,
        "answer_expected_citation_hit": False,
        "expected_citation_hits": {"retrieved": [], "answer": []},
        "expected_point_coverage": {
            "total": len(expected_points),
            "covered_count": 0,
            "missing_count": len(expected_points),
            "covered_points": [],
            "missing_points": expected_points,
        },
        "grounded_citation_violation": False,
        "citation_violations": [],
        "raw_cited_context_ids_valid": False,
        "raw_cited_context_ids": [],
        "invalid_raw_cited_context_ids": [],
        "grounded_context_ids_valid": False,
        "grounded_context_ids": [],
        "invalid_grounded_context_ids": [],
        "answer_preview": None,
        "final_verdict": "FAIL",
        "verdict_reason": f"{error_type}: {error_message}",
        "error_type": error_type,
        "error_message": error_message,
        "model_name": None,
        "retrieval_total": None,
        "top_k": effective_item_top_k,
        "ef_search": args.ef_search,
        "latency_ms": latency_ms,
    }


def build_success_record(
    *,
    item: dict[str, Any],
    result: Any,
    effective_item_top_k: int,
    args: argparse.Namespace,
    latency_ms: int,
) -> dict[str, Any]:
    expected_citations = dedupe_preserve_order(list(item.get("expected_citations", [])))
    expected_points = list(item.get("expected_points", []))
    retrieved_top_citation_labels = [
        chunk.citation_label for chunk in result.retrieved_chunks[:effective_item_top_k]
    ]
    answer_cited_articles = list(result.cited_articles)
    retrieved_hits = [
        citation for citation in expected_citations if citation in retrieved_top_citation_labels
    ]
    answer_hits = [
        citation for citation in expected_citations if citation in answer_cited_articles
    ]
    answer_text_for_coverage = "\n".join([result.answer, *result.key_points])
    expected_point_coverage = classify_expected_point_coverage(
        answer_text=answer_text_for_coverage,
        expected_points=expected_points,
    )
    citation_violations = serialize_violations(
        find_explicit_citation_grounding_violations(
            build_answer_texts_for_citation_check(
                answer=result.answer,
                key_points=result.key_points,
                cautions=result.cautions,
            ),
            retrieved_chunks=result.retrieved_chunks,
            grounded_context_ids=result.grounded_context_ids,
        )
    )
    context_validity = context_id_validity(result)
    final_verdict, verdict_reason = decide_verdict(
        expected_citations=expected_citations,
        answer_expected_citation_hit=bool(answer_hits),
        cited_articles_present=bool(answer_cited_articles),
        raw_context_ids_valid=context_validity["raw_cited_context_ids_valid"],
        grounded_context_ids_valid=context_validity["grounded_context_ids_valid"],
        citation_violations=citation_violations,
        missing_points=expected_point_coverage["missing_points"],
    )

    return {
        "id": item["id"],
        "question": item["question"],
        "dataset_format": item["dataset_format"],
        "scenario_id": item.get("scenario_id"),
        "phase": item.get("phase"),
        "label": item.get("label"),
        "stability": item.get("stability"),
        "recommended_top_k": item.get("recommended_top_k"),
        "expected_citation_source": item["expected_citation_source"],
        "expected_citations": expected_citations,
        "retrieved_top_citation_labels": retrieved_top_citation_labels,
        "answer_cited_articles": answer_cited_articles,
        "retrieved_expected_citation_hit": bool(retrieved_hits),
        "answer_expected_citation_hit": bool(answer_hits),
        "expected_citation_hits": {
            "retrieved": retrieved_hits,
            "answer": answer_hits,
        },
        "expected_point_coverage": expected_point_coverage,
        "grounded_citation_violation": bool(citation_violations),
        "citation_violations": citation_violations,
        **context_validity,
        "answer_preview": compact_preview(result.answer, args.answer_preview_chars),
        "final_verdict": final_verdict,
        "verdict_reason": verdict_reason,
        "error_type": None,
        "error_message": None,
        "model_name": result.model_name,
        "retrieval_total": result.retrieval_total,
        "top_k": effective_item_top_k,
        "ef_search": args.ef_search,
        "latency_ms": latency_ms,
    }


def run_report(items: list[dict[str, Any]], args: argparse.Namespace) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        item_top_k = effective_top_k(item, args)
        print(
            f"[{index}/{len(items)}] {item['id']} start top_k={item_top_k}",
            file=sys.stderr,
            flush=True,
        )
        started_at = time.perf_counter()
        try:
            result = run_eval_item_with_timeout(
                query=item["question"],
                top_k=item_top_k,
                ef_search=args.ef_search,
                timeout_seconds=args.item_timeout_seconds,
                model_name=args.model_name,
            )
        except TimeoutError as exc:
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            record = build_error_record(
                item=item,
                effective_item_top_k=item_top_k,
                args=args,
                error_type="timeout",
                error_message=str(exc),
                latency_ms=latency_ms,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            error_message = f"{type(exc).__name__}: {exc}"
            record = build_error_record(
                item=item,
                effective_item_top_k=item_top_k,
                args=args,
                error_type=classify_error(error_message),
                error_message=error_message,
                latency_ms=latency_ms,
            )
        else:
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            record = build_success_record(
                item=item,
                result=result,
                effective_item_top_k=item_top_k,
                args=args,
                latency_ms=latency_ms,
            )

        records.append(record)
        coverage = record["expected_point_coverage"]
        print(
            f"[{index}/{len(items)}] {item['id']} {record['final_verdict']} "
            f"citation_hit={record['answer_expected_citation_hit']} "
            f"coverage={coverage['covered_count']}/{coverage['total']} "
            f"latency_ms={record['latency_ms']}",
            file=sys.stderr,
            flush=True,
        )
    return records


def render_jsonl(records: list[dict[str, Any]]) -> str:
    return "\n".join(json.dumps(record, ensure_ascii=False) for record in records) + "\n"


def md_escape(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def format_list(values: list[Any]) -> str:
    if not values:
        return "(none)"
    return "<br>".join(md_escape(value) for value in values)


def render_markdown(records: list[dict[str, Any]], args: argparse.Namespace) -> str:
    verdict_counts = Counter(record["final_verdict"] for record in records)
    lines = [
        "# Answer Evidence Report",
        "",
        f"- dataset: `{args.dataset}`",
        f"- scenario_format: `{args.scenario_format}`",
        f"- items: `{len(records)}`",
        f"- verdicts: PASS `{verdict_counts['PASS']}`, PARTIAL `{verdict_counts['PARTIAL']}`, FAIL `{verdict_counts['FAIL']}`",
        f"- ef_search: `{args.ef_search}`",
        f"- top_k: `{args.top_k if args.top_k is not None else 'dataset default/recommended'}`",
        "",
        "## Summary",
        "",
        "| id | verdict | answer citation hit | coverage | grounding clean | raw ids valid | reason |",
        "|---|---|---:|---:|---:|---:|---|",
    ]
    for record in records:
        coverage = record["expected_point_coverage"]
        lines.append(
            "| "
            + " | ".join(
                [
                    md_escape(record["id"]),
                    record["final_verdict"],
                    str(record["answer_expected_citation_hit"]),
                    f"{coverage['covered_count']}/{coverage['total']}",
                    str(not record["grounded_citation_violation"]),
                    str(record["raw_cited_context_ids_valid"]),
                    md_escape(record["verdict_reason"]),
                ]
            )
            + " |"
        )

    lines.extend(["", "## Item Evidence", ""])
    for record in records:
        coverage = record["expected_point_coverage"]
        lines.extend(
            [
                f"### {record['id']} - {record['final_verdict']}",
                "",
                f"- question: {md_escape(record['question'])}",
                f"- expected citations ({record['expected_citation_source']}): {format_list(record['expected_citations'])}",
                f"- retrieved top citation labels: {format_list(record['retrieved_top_citation_labels'])}",
                f"- answer cited_articles: {format_list(record['answer_cited_articles'])}",
                f"- expected citation hits in answer: {format_list(record['expected_citation_hits']['answer'])}",
                f"- covered points ({coverage['covered_count']}/{coverage['total']}): {format_list(coverage['covered_points'])}",
                f"- missing points: {format_list(coverage['missing_points'])}",
                f"- citation violations: {format_list(record['citation_violations'])}",
                f"- raw cited context ids valid: `{record['raw_cited_context_ids_valid']}`; ids: `{record['raw_cited_context_ids']}`",
                f"- grounded context ids valid: `{record['grounded_context_ids_valid']}`; ids: `{record['grounded_context_ids']}`",
                f"- verdict reason: {md_escape(record['verdict_reason'])}",
            ]
        )
        if record["answer_preview"]:
            lines.append(f"- answer preview: {md_escape(record['answer_preview'])}")
        lines.append("")
    return "\n".join(lines)


def write_report(content: str, output_path: Path | None) -> None:
    if output_path is None:
        print(content, end="")
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def should_exit_nonzero(records: list[dict[str, Any]], mode: str) -> bool:
    if mode == "never":
        return False
    verdicts = {record["final_verdict"] for record in records}
    if mode == "fail":
        return "FAIL" in verdicts
    if mode == "partial":
        return bool(verdicts.intersection({"FAIL", "PARTIAL"}))
    raise ValueError(f"Unknown fail-on-verdict mode: {mode}")


def main() -> None:
    args = parse_args()
    validate_args(args)
    all_items = load_eval_items(args.dataset, scenario_format=args.scenario_format)
    items = select_items(all_items, raw_ids=args.ids, limit=args.limit)
    records = run_report(items, args)
    if args.format == "jsonl":
        content = render_jsonl(records)
    else:
        content = render_markdown(records, args)
    write_report(content, args.output)

    verdict_counts = Counter(record["final_verdict"] for record in records)
    print(
        "summary: "
        f"items={len(records)} "
        f"PASS={verdict_counts['PASS']} "
        f"PARTIAL={verdict_counts['PARTIAL']} "
        f"FAIL={verdict_counts['FAIL']}",
        file=sys.stderr,
        flush=True,
    )
    if should_exit_nonzero(records, args.fail_on_verdict):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
