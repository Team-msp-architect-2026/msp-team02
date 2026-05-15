from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import traceback
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.answer_generation import (
    answer_question,
    build_answer_texts_for_citation_check,
    find_explicit_citation_grounding_violations,
)
from backend.app.services.embedding import get_provider_process_context

DEFAULT_DATASET_PATH = REPO_ROOT / "eval" / "mvp_in_scope_eval_v1.json"
DEFAULT_ITEM_TIMEOUT_SECONDS = 40.0
DEFAULT_PROCESS_TERMINATE_GRACE_SECONDS = 1.0
DEFAULT_STOPWORDS = {
    "그리고",
    "관련",
    "경우",
    "관한",
    "관하여",
    "근로자",
    "사용자",
    "수",
    "있다",
    "있으면",
    "있으나",
    "있어도",
    "있습니다",
    "한다",
    "해야",
    "한다면",
    "않다",
    "않는다",
    "않으면",
    "원칙",
    "원칙적으로",
    "위한",
    "있는",
    "다만",
    "통해",
    "대한",
    "또는",
    "보다",
    "범위",
    "등",
}
TOKEN_SUFFIXES = (
    "으로써",
    "으로서",
    "에게서",
    "으로는",
    "으로의",
    "에게는",
    "에게",
    "에",
    "에서는",
    "에서",
    "까지는",
    "까지",
    "부터는",
    "부터",
    "에는",
    "이나",
    "와는",
    "과는",
    "으로",
    "과",
    "와",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "의",
    "도",
    "만",
)
LEGAL_NORMALIZATION_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(
            r"(해서는 안(?: 된다|됩니다)|하지 못(?:한다|합니다)|할 수 없(?:다|습니다)|"
            r"허용되지 않(?:는다|습니다)|금지(?:된다|됩니다))"
        ),
        "금지",
    ),
    (
        re.compile(
            r"(포함(?:된다|됩니다)|해당(?:한다|합니다)|한 종류에 해당(?:한다|합니다)|"
            r"일종(?:이다|입니다)|범주에 (?:든다|듭니다)|로 본다|로 봅니다)"
        ),
        "포함",
    ),
    (
        re.compile(
            r"(예외가 있(?:다|습니다)|다를 수 있(?:다|습니다)|적용되지 않을 수 있(?:다|습니다)|"
            r"가능할 수 있(?:다|습니다)|예외적으로 가능(?:하다|합니다))"
        ),
        "예외가능",
    ),
    (
        re.compile(r"(해야 한다|해야 합니다|하여야 한다|하여야 합니다|의무가 있(?:다|습니다))"),
        "의무",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to the answer eval dataset JSON file",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of retrieved chunks per question",
    )
    parser.add_argument(
        "--ef-search",
        type=int,
        default=100,
        help="Runtime HNSW ef_search value",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum number of eval items to run",
    )
    parser.add_argument(
        "--show-failures",
        type=int,
        default=5,
        help="Maximum number of failures to print",
    )
    parser.add_argument(
        "--item-timeout-seconds",
        type=float,
        default=DEFAULT_ITEM_TIMEOUT_SECONDS,
        help="Hard wall-clock timeout for each eval item.",
    )
    parser.add_argument(
        "--model-name",
        help="Override answer generation model name",
    )
    parser.add_argument(
        "--ids",
        nargs="+",
        help="Run only the specified eval item ids (space or comma separated).",
    )
    return parser.parse_args()


def load_eval_items(dataset_path: Path) -> list[dict[str, Any]]:
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Eval payload must be a top-level object.")

    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError('Eval payload must contain a top-level "items" list.')

    return items


def parse_eval_id_filter(raw_ids: list[str] | None) -> list[str]:
    if not raw_ids:
        return []

    normalized_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in raw_ids:
        for candidate in raw_id.split(","):
            eval_id = candidate.strip()
            if not eval_id or eval_id in seen:
                continue
            normalized_ids.append(eval_id)
            seen.add(eval_id)
    return normalized_ids


def normalize_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text).strip().lower()
    for pattern, replacement in LEGAL_NORMALIZATION_RULES:
        normalized = pattern.sub(replacement, normalized)
    return normalized


def compact_text(text: str) -> str:
    return re.sub(r"\s+", "", normalize_text(text))


def normalize_token(token: str) -> str:
    normalized = token.strip()
    for suffix in TOKEN_SUFFIXES:
        if normalized.endswith(suffix) and len(normalized) - len(suffix) >= 2:
            normalized = normalized[: -len(suffix)]
            break
    return normalized


def tokenize_expected_point(point: str) -> list[str]:
    normalized = normalize_text(point)
    tokens = [
        normalize_token(token)
        for token in re.split(r"[^0-9a-z가-힣%]+", normalized)
        if len(normalize_token(token)) >= 2
        and normalize_token(token) not in DEFAULT_STOPWORDS
    ]
    return list(dict.fromkeys(tokens))


def is_expected_point_covered(answer_text: str, expected_point: str) -> bool:
    normalized_answer = normalize_text(answer_text)
    compact_answer = compact_text(answer_text)
    normalized_point = normalize_text(expected_point)
    compact_point = compact_text(expected_point)

    if normalized_point in normalized_answer or compact_point in compact_answer:
        return True

    tokens = tokenize_expected_point(expected_point)
    if not tokens:
        return False

    matched_tokens = sum(1 for token in tokens if token in normalized_answer)
    threshold = max(2, math.ceil(len(tokens) * 0.67))
    return matched_tokens >= threshold


def measure_expected_point_coverage(
    answer_text: str,
    expected_points: list[str],
) -> tuple[int, int]:
    covered = 0
    for point in expected_points:
        if is_expected_point_covered(answer_text, point):
            covered += 1
    return covered, len(expected_points)


def raw_context_ids_are_valid(result: Any) -> bool:
    valid_context_ids = {chunk.context_id for chunk in result.retrieved_chunks}
    raw_context_ids = getattr(result, "raw_cited_context_ids", [])
    return bool(raw_context_ids) and all(
        context_id in valid_context_ids for context_id in raw_context_ids
    )


def _answer_eval_item_worker(
    query: str,
    top_k: int,
    ef_search: int,
    model_name: str | None,
    result_conn: Any,
) -> None:
    try:
        result = answer_question(
            query=query,
            top_k=top_k,
            ef_search=ef_search,
            model_name=model_name,
        )
    except BaseException as exc:  # pragma: no cover - subprocess boundary
        result_conn.send(
            {
                "status": "error",
                "error_type": type(exc).__name__,
                "message": str(exc),
                "traceback": traceback.format_exc(limit=10),
            }
        )
    else:
        result_conn.send({"status": "ok", "payload": result})
    finally:
        result_conn.close()


def run_eval_item_with_timeout(
    *,
    query: str,
    top_k: int,
    ef_search: int,
    timeout_seconds: float,
    model_name: str | None,
) -> Any:
    ctx = get_provider_process_context()
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    process = ctx.Process(
        target=_answer_eval_item_worker,
        args=(query, top_k, ef_search, model_name, child_conn),
    )
    process.start()
    child_conn.close()

    try:
        process.join(timeout_seconds)
        if process.is_alive():
            process.terminate()
            process.join(DEFAULT_PROCESS_TERMINATE_GRACE_SECONDS)
            if process.is_alive():
                process.kill()
                process.join(DEFAULT_PROCESS_TERMINATE_GRACE_SECONDS)
            raise TimeoutError(
                f"eval item exceeded hard wall-clock timeout after {timeout_seconds:.1f}s"
            )

        if not parent_conn.poll(DEFAULT_PROCESS_TERMINATE_GRACE_SECONDS):
            raise RuntimeError(
                f"eval item exited without returning a result. exitcode={process.exitcode}"
            )
        try:
            result = parent_conn.recv()
        except EOFError as exc:
            raise RuntimeError(
                f"eval item exited before returning a result. exitcode={process.exitcode}"
            ) from exc
    finally:
        parent_conn.close()

    if result["status"] == "ok":
        return result["payload"]

    raise RuntimeError(
        f"{result['error_type']}: {result['message']}"
    )


def classify_error(error_text: str) -> str:
    normalized = error_text.upper()
    if "TIMEOUTERROR" in normalized:
        return "timeout"
    if "429" in normalized or "RESOURCE_EXHAUSTED" in normalized:
        return "provider_429"
    if "DID NOT RETURN VALID JSON" in normalized or "INVALID STRUCTURED PAYLOAD" in normalized:
        return "json_schema_failure"
    if "VERTEXPROVIDERRUNTIMEERROR" in normalized or "VERTEXPROVIDERTIMEOUTERROR" in normalized:
        return "provider_error"
    if "GROUNDEDANSWERGENERATIONERROR" in normalized:
        return "grounded_generation_error"
    return "other_error"


def append_failure_bucket(
    bucket_ids: dict[str, list[str]],
    bucket_name: str,
    eval_id: str,
) -> None:
    bucket_ids[bucket_name].append(eval_id)


def main() -> None:
    args = parse_args()
    if args.limit <= 0:
        raise ValueError("--limit must be greater than 0.")
    if args.item_timeout_seconds <= 0:
        raise ValueError("--item-timeout-seconds must be greater than 0.")

    all_items = load_eval_items(args.dataset)
    requested_ids = parse_eval_id_filter(args.ids)
    if requested_ids:
        item_by_id = {item["id"]: item for item in all_items}
        missing_ids = [eval_id for eval_id in requested_ids if eval_id not in item_by_id]
        if missing_ids:
            raise ValueError(f"Unknown eval ids: {missing_ids}")
        items = [item_by_id[eval_id] for eval_id in requested_ids]
    else:
        items = all_items[: args.limit]
    failures: list[dict[str, Any]] = []
    answered = 0
    cited_articles_present = 0
    raw_context_ids_valid = 0
    citation_grounding_clean = 0
    gold_citation_hit = 0
    total_expected_points = 0
    covered_expected_points = 0
    timed_out_ids: list[str] = []
    error_counts: dict[str, int] = {
        "timeout": 0,
        "provider_429": 0,
        "provider_error": 0,
        "json_schema_failure": 0,
        "grounded_generation_error": 0,
        "other_error": 0,
    }
    failure_bucket_counts: dict[str, int] = {
        "timeout": 0,
        "provider_429": 0,
        "provider_error": 0,
        "json_schema_failure": 0,
        "grounded_generation_error": 0,
        "other_error": 0,
        "missing_cited_articles": 0,
        "invalid_raw_context_ids": 0,
        "citation_violation": 0,
        "gold_citation_miss": 0,
        "partial_coverage": 0,
    }
    failure_bucket_ids: dict[str, list[str]] = {
        bucket_name: [] for bucket_name in failure_bucket_counts
    }
    observed_model_names: set[str] = set()
    total_latency_ms = 0

    for index, item in enumerate(items, start=1):
        print(
            f"[{index}/{len(items)}] {item['id']} start",
            flush=True,
        )
        item_started_at = time.perf_counter()
        try:
            result = run_eval_item_with_timeout(
                query=item["question"],
                top_k=args.top_k,
                ef_search=args.ef_search,
                timeout_seconds=args.item_timeout_seconds,
                model_name=args.model_name,
            )
        except TimeoutError as exc:
            timed_out_ids.append(item["id"])
            error_counts["timeout"] += 1
            failure_bucket_counts["timeout"] += 1
            append_failure_bucket(failure_bucket_ids, "timeout", item["id"])
            failures.append(
                {
                    "id": item["id"],
                    "question": item["question"],
                    "error": f"TimeoutError: {exc}",
                }
            )
            print(
                f"[{index}/{len(items)}] {item['id']} timeout "
                f"latency_ms={int((time.perf_counter() - item_started_at) * 1000)}",
                flush=True,
            )
            continue
        except Exception as exc:
            error_bucket = classify_error(str(exc))
            error_counts[error_bucket] += 1
            failure_bucket_counts[error_bucket] += 1
            append_failure_bucket(failure_bucket_ids, error_bucket, item["id"])
            failures.append(
                {
                    "id": item["id"],
                    "question": item["question"],
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
            print(
                f"[{index}/{len(items)}] {item['id']} error "
                f"latency_ms={int((time.perf_counter() - item_started_at) * 1000)} "
                f"error={type(exc).__name__}",
                flush=True,
            )
            continue

        item_latency_ms = int((time.perf_counter() - item_started_at) * 1000)
        answered += 1
        total_latency_ms += item_latency_ms
        observed_model_names.add(result.model_name)
        answer_text = "\n".join([result.answer, *result.key_points])
        citation_violations = find_explicit_citation_grounding_violations(
            build_answer_texts_for_citation_check(
                answer=result.answer,
                key_points=result.key_points,
                cautions=result.cautions,
            ),
            retrieved_chunks=result.retrieved_chunks,
            grounded_context_ids=result.grounded_context_ids,
        )

        if result.cited_articles:
            cited_articles_present += 1
        if raw_context_ids_are_valid(result):
            raw_context_ids_valid += 1
        if not citation_violations:
            citation_grounding_clean += 1
        if set(item["gold_citations"]).intersection(result.cited_articles):
            gold_citation_hit += 1

        covered_points, point_total = measure_expected_point_coverage(
            answer_text,
            item["expected_points"],
        )
        covered_expected_points += covered_points
        total_expected_points += point_total

        failure_reasons: list[str] = []
        if (
            not result.cited_articles
            or not raw_context_ids_are_valid(result)
            or citation_violations
            or not set(item["gold_citations"]).intersection(result.cited_articles)
            or covered_points < point_total
        ):
            if not result.cited_articles:
                failure_reasons.append("missing_cited_articles")
            if not raw_context_ids_are_valid(result):
                failure_reasons.append("invalid_raw_context_ids")
            if citation_violations:
                failure_reasons.append("citation_violation")
            if not set(item["gold_citations"]).intersection(result.cited_articles):
                failure_reasons.append("gold_citation_miss")
            if covered_points < point_total:
                failure_reasons.append("partial_coverage")
            for failure_reason in failure_reasons:
                failure_bucket_counts[failure_reason] += 1
                append_failure_bucket(failure_bucket_ids, failure_reason, item["id"])
            failures.append(
                {
                    "id": item["id"],
                    "question": item["question"],
                    "cited_articles": result.cited_articles,
                    "raw_cited_context_ids": result.raw_cited_context_ids,
                    "grounded_context_ids": result.grounded_context_ids,
                    "gold_citations": item["gold_citations"],
                    "failure_reasons": failure_reasons,
                    "citation_violations": [
                        {
                            "category": violation.category,
                            "raw_mention": violation.raw_mention,
                            "detail": violation.detail,
                        }
                        for violation in citation_violations
                    ],
                    "expected_point_coverage": f"{covered_points}/{point_total}",
                }
            )

        print(
            f"[{index}/{len(items)}] {item['id']} done "
            f"latency_ms={item_latency_ms} "
            f"citations={len(result.cited_articles)} "
            f"violations={len(citation_violations)} "
            f"coverage={covered_points}/{point_total}",
            flush=True,
        )

    print("=" * 72)
    print("Answer eval")
    print("=" * 72)
    print(f"dataset: {args.dataset}")
    print(f"items_attempted: {len(items)}")
    print(f"items_answered: {answered}")
    print(f"model_name_override: {args.model_name or '(default)'}")
    print(f"observed_model_names: {sorted(observed_model_names)}")
    print(f"top_k: {args.top_k}")
    print(f"ef_search: {args.ef_search}")
    print(f"item_timeout_seconds: {args.item_timeout_seconds}")
    print(
        f"avg_answer_latency_ms: {total_latency_ms / answered:.1f}"
        if answered
        else "avg_answer_latency_ms: n/a"
    )
    print(
        f"cited_articles_present: {cited_articles_present}/{answered}"
        if answered
        else "cited_articles_present: 0/0"
    )
    print(
        f"raw_cited_context_ids_valid: {raw_context_ids_valid}/{answered}"
        if answered
        else "raw_cited_context_ids_valid: 0/0"
    )
    print(
        f"citation_grounding_clean: {citation_grounding_clean}/{answered}"
        if answered
        else "citation_grounding_clean: 0/0"
    )
    print(
        f"gold_citation_hit: {gold_citation_hit}/{answered}"
        if answered
        else "gold_citation_hit: 0/0"
    )
    print(
        f"expected_point_strict_coverage: {covered_expected_points}/{total_expected_points}"
        if total_expected_points
        else "expected_point_strict_coverage: 0/0"
    )
    print("-" * 72)
    print(f"timed_out_ids: {timed_out_ids}")
    print(f"error_counts: {error_counts}")
    print(f"failure_bucket_counts: {failure_bucket_counts}")
    print(
        "json_schema_failure_ids: "
        f"{failure_bucket_ids['json_schema_failure']}"
    )
    print(
        "partial_coverage_ids: "
        f"{failure_bucket_ids['partial_coverage']}"
    )
    print(f"failures_or_partial_coverage: {len(failures)}")
    for failure in failures[: args.show_failures]:
        print(f"[{failure['id']}] {failure['question']}")
        if "error" in failure:
            print(f"error: {failure['error']}")
            continue
        print(f"cited_articles: {failure['cited_articles']}")
        print(f"raw_cited_context_ids: {failure['raw_cited_context_ids']}")
        print(f"grounded_context_ids: {failure['grounded_context_ids']}")
        print(f"gold_citations: {failure['gold_citations']}")
        print(f"failure_reasons: {failure['failure_reasons']}")
        print(f"citation_violations: {failure['citation_violations']}")
        print(f"expected_point_coverage: {failure['expected_point_coverage']}")

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
