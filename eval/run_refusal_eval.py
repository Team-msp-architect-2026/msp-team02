from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any, Literal

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from run_answer_eval import (
    DEFAULT_ITEM_TIMEOUT_SECONDS,
    classify_error,
    parse_eval_id_filter,
    run_eval_item_with_timeout,
)

DEFAULT_DATASET_PATH = REPO_ROOT / "eval" / "refusal_eval_v1.json"
DEFAULT_REPORT_DIR = REPO_ROOT / "eval" / "reports"
DEFAULT_TOP_K = 5
DEFAULT_EF_SEARCH = 100
DEFAULT_ANSWER_PREVIEW_CHARS = 280
ARTICLE_NO_PATTERN = re.compile(r"제\s*\d+\s*조(?:\s*의\s*\d+)?")
ARTICLE_NEIGHBOR_WINDOW = 60

Verdict = Literal["PASS", "PARTIAL", "FAIL"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run refusal_eval_v1 and classify each item as PASS / PARTIAL / FAIL "
            "without changing backend retrieval or answer behavior."
        )
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to refusal_eval JSON file.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help="Number of retrieved chunks per question.",
    )
    parser.add_argument(
        "--ef-search",
        type=int,
        default=DEFAULT_EF_SEARCH,
        help="Runtime HNSW ef_search value.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of refusal items to run after filtering.",
    )
    parser.add_argument(
        "--ids",
        nargs="+",
        help="Run only the specified eval item ids (space or comma separated).",
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
        "--output",
        type=Path,
        help=(
            "Write evidence JSONL to this path. "
            f"Defaults to {DEFAULT_REPORT_DIR}/refusal_eval_<today>.jsonl"
        ),
    )
    parser.add_argument(
        "--answer-preview-chars",
        type=int,
        default=DEFAULT_ANSWER_PREVIEW_CHARS,
        help="Maximum characters to preserve from the answer body in evidence records.",
    )
    parser.add_argument(
        "--show-failures",
        type=int,
        default=5,
        help="Maximum number of FAIL records to print at the end.",
    )
    parser.add_argument(
        "--exit-on-partial",
        action="store_true",
        help="Exit with code 1 when any PARTIAL is observed. Default fails only on FAIL.",
    )
    return parser.parse_args()


def load_refusal_items(dataset_path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Refusal eval payload must be a top-level object.")

    items = payload.get("items")
    if not isinstance(items, list):
        raise ValueError('Refusal eval payload must contain a top-level "items" list.')

    return payload, items


def resolve_output_path(arg_output: Path | None) -> Path:
    if arg_output is not None:
        return arg_output
    DEFAULT_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    return DEFAULT_REPORT_DIR / f"refusal_eval_{date.today().isoformat()}.jsonl"


def gather_answer_text(result: Any) -> str:
    parts: list[str] = [result.answer]
    parts.extend(result.key_points)
    parts.extend(result.cautions)
    return "\n".join(part for part in parts if part)


def detect_refusal_signal(answer_text: str, keywords: list[str]) -> list[str]:
    matched: list[str] = []
    for keyword in keywords:
        if not keyword:
            continue
        if keyword in answer_text:
            matched.append(keyword)
    return matched


def detect_out_of_corpus_law_mention(
    answer_text: str,
    out_of_corpus_law_name: str | None,
) -> bool:
    if not out_of_corpus_law_name:
        return False
    return out_of_corpus_law_name in answer_text


def detect_forbidden_article_pattern(
    answer_text: str,
    out_of_corpus_law_name: str | None,
) -> bool:
    """Heuristic: out-of-corpus law name appears within ARTICLE_NEIGHBOR_WINDOW chars
    of a 제N조 pattern. This flags authoritative-sounding citations of laws that are
    not in the current corpus."""
    if not out_of_corpus_law_name:
        return False
    article_matches = list(ARTICLE_NO_PATTERN.finditer(answer_text))
    if not article_matches:
        return False
    primary_name = out_of_corpus_law_name.split("/")[0].strip()
    if not primary_name:
        return False
    name_positions = [
        match.start() for match in re.finditer(re.escape(primary_name), answer_text)
    ]
    if not name_positions:
        return False
    for article_match in article_matches:
        article_start = article_match.start()
        for name_start in name_positions:
            distance = abs(article_start - name_start)
            if distance <= ARTICLE_NEIGHBOR_WINDOW:
                return True
    return False


def classify_verdict(
    item: dict[str, Any],
    result: Any,
    answer_text: str,
) -> tuple[Verdict, list[str], dict[str, Any]]:
    cited_articles = list(result.cited_articles or [])
    refusal_signal_keywords = item.get("refusal_signal_keywords", []) or []
    out_of_corpus_law_name = item.get("out_of_corpus_law_name")

    matched_refusal_keywords = detect_refusal_signal(answer_text, refusal_signal_keywords)
    has_refusal_signal = bool(matched_refusal_keywords)
    has_forbidden_article_pattern = detect_forbidden_article_pattern(
        answer_text, out_of_corpus_law_name
    )
    has_out_of_corpus_law_mention = detect_out_of_corpus_law_mention(
        answer_text, out_of_corpus_law_name
    )

    diagnostics = {
        "matched_refusal_keywords": matched_refusal_keywords,
        "has_refusal_signal": has_refusal_signal,
        "has_forbidden_article_pattern": has_forbidden_article_pattern,
        "has_out_of_corpus_law_mention": has_out_of_corpus_law_mention,
        "cited_articles_present": bool(cited_articles),
    }

    reasons: list[str] = []

    if cited_articles:
        reasons.append("cited_articles_present_should_be_empty")
        return "FAIL", reasons, diagnostics

    if has_forbidden_article_pattern:
        reasons.append("out_of_corpus_law_name_appears_with_article_no_authoritatively")
        if has_refusal_signal:
            return "PARTIAL", reasons, diagnostics
        return "FAIL", reasons, diagnostics

    if not has_refusal_signal:
        reasons.append("no_refusal_signal_keyword_matched")
        return "FAIL", reasons, diagnostics

    if has_out_of_corpus_law_mention:
        reasons.append("out_of_corpus_law_name_mentioned_without_article_no_review")
        return "PARTIAL", reasons, diagnostics

    return "PASS", reasons, diagnostics


def build_evidence_record(
    *,
    item: dict[str, Any],
    verdict: Verdict,
    reasons: list[str],
    diagnostics: dict[str, Any],
    result: Any,
    answer_preview_chars: int,
    latency_ms: int,
    top_k: int,
    ef_search: int,
) -> dict[str, Any]:
    answer_text = gather_answer_text(result)
    preview = answer_text[:answer_preview_chars]
    preview_truncated = len(answer_text) > answer_preview_chars
    retrieved_chunk_ids = [
        getattr(chunk, "context_id", None) for chunk in result.retrieved_chunks
    ]
    return {
        "id": item["id"],
        "category": item.get("category"),
        "difficulty": item.get("difficulty"),
        "question": item["question"],
        "expected_behavior": item.get("expected_behavior"),
        "verdict": verdict,
        "reasons": reasons,
        "diagnostics": diagnostics,
        "cited_articles": list(result.cited_articles or []),
        "retrieved_chunk_ids": retrieved_chunk_ids,
        "answer_preview": preview,
        "answer_preview_truncated": preview_truncated,
        "model_name": getattr(result, "model_name", None),
        "latency_ms": latency_ms,
        "top_k": top_k,
        "ef_search": ef_search,
    }


def select_items(
    all_items: list[dict[str, Any]],
    requested_ids: list[str],
    limit: int | None,
) -> list[dict[str, Any]]:
    if requested_ids:
        item_by_id = {item["id"]: item for item in all_items}
        missing_ids = [eval_id for eval_id in requested_ids if eval_id not in item_by_id]
        if missing_ids:
            raise ValueError(f"Unknown refusal eval ids: {missing_ids}")
        selected = [item_by_id[eval_id] for eval_id in requested_ids]
    else:
        selected = list(all_items)
    if limit is not None:
        if limit <= 0:
            raise ValueError("--limit must be greater than 0.")
        selected = selected[:limit]
    return selected


def main() -> None:
    args = parse_args()
    if args.item_timeout_seconds <= 0:
        raise ValueError("--item-timeout-seconds must be greater than 0.")

    payload, all_items = load_refusal_items(args.dataset)
    requested_ids = parse_eval_id_filter(args.ids)
    items = select_items(all_items, requested_ids, args.limit)

    output_path = resolve_output_path(args.output)
    if not output_path.parent.exists():
        output_path.parent.mkdir(parents=True, exist_ok=True)

    verdict_counts: Counter[str] = Counter({"PASS": 0, "PARTIAL": 0, "FAIL": 0})
    category_verdicts: dict[str, Counter[str]] = {}
    error_counts: Counter[str] = Counter()
    timed_out_ids: list[str] = []
    failed_records: list[dict[str, Any]] = []
    partial_records: list[dict[str, Any]] = []
    answered = 0
    total_latency_ms = 0
    observed_model_names: set[str] = set()

    with output_path.open("w", encoding="utf-8") as evidence_file:
        for index, item in enumerate(items, start=1):
            print(f"[{index}/{len(items)}] {item['id']} start", flush=True)
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
                evidence_file.write(
                    json.dumps(
                        {
                            "id": item["id"],
                            "category": item.get("category"),
                            "question": item["question"],
                            "verdict": "FAIL",
                            "reasons": ["runner_timeout"],
                            "error": f"TimeoutError: {exc}",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                verdict_counts["FAIL"] += 1
                category_verdicts.setdefault(item.get("category", "unknown"), Counter())[
                    "FAIL"
                ] += 1
                print(f"[{index}/{len(items)}] {item['id']} timeout", flush=True)
                continue
            except Exception as exc:
                error_bucket = classify_error(str(exc))
                error_counts[error_bucket] += 1
                evidence_file.write(
                    json.dumps(
                        {
                            "id": item["id"],
                            "category": item.get("category"),
                            "question": item["question"],
                            "verdict": "FAIL",
                            "reasons": [f"runner_error:{error_bucket}"],
                            "error": f"{type(exc).__name__}: {exc}",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                verdict_counts["FAIL"] += 1
                category_verdicts.setdefault(item.get("category", "unknown"), Counter())[
                    "FAIL"
                ] += 1
                print(
                    f"[{index}/{len(items)}] {item['id']} error {type(exc).__name__}",
                    flush=True,
                )
                continue

            item_latency_ms = int((time.perf_counter() - item_started_at) * 1000)
            answered += 1
            total_latency_ms += item_latency_ms
            observed_model_names.add(result.model_name)

            answer_text = gather_answer_text(result)
            verdict, reasons, diagnostics = classify_verdict(item, result, answer_text)
            verdict_counts[verdict] += 1
            category_verdicts.setdefault(item.get("category", "unknown"), Counter())[
                verdict
            ] += 1

            record = build_evidence_record(
                item=item,
                verdict=verdict,
                reasons=reasons,
                diagnostics=diagnostics,
                result=result,
                answer_preview_chars=args.answer_preview_chars,
                latency_ms=item_latency_ms,
                top_k=args.top_k,
                ef_search=args.ef_search,
            )
            evidence_file.write(json.dumps(record, ensure_ascii=False) + "\n")

            if verdict == "FAIL":
                failed_records.append(record)
            elif verdict == "PARTIAL":
                partial_records.append(record)

            print(
                f"[{index}/{len(items)}] {item['id']} done "
                f"verdict={verdict} latency_ms={item_latency_ms} "
                f"refusal_kw={len(diagnostics['matched_refusal_keywords'])} "
                f"cited={len(record['cited_articles'])}",
                flush=True,
            )

    print("=" * 72)
    print("Refusal eval")
    print("=" * 72)
    print(f"dataset: {args.dataset}")
    print(f"dataset_version: {payload.get('version')}")
    print(f"items_attempted: {len(items)}")
    print(f"items_answered: {answered}")
    print(f"top_k: {args.top_k}")
    print(f"ef_search: {args.ef_search}")
    print(f"observed_model_names: {sorted(observed_model_names)}")
    print(f"evidence_jsonl: {output_path}")
    if answered:
        print(f"avg_answer_latency_ms: {total_latency_ms / answered:.1f}")
    else:
        print("avg_answer_latency_ms: n/a")
    print("-" * 72)
    print(f"verdicts: PASS={verdict_counts['PASS']} "
          f"PARTIAL={verdict_counts['PARTIAL']} "
          f"FAIL={verdict_counts['FAIL']}")
    print("per_category:")
    for category in sorted(category_verdicts):
        counts = category_verdicts[category]
        print(
            f"  {category}: PASS={counts.get('PASS', 0)} "
            f"PARTIAL={counts.get('PARTIAL', 0)} "
            f"FAIL={counts.get('FAIL', 0)}"
        )
    print(f"timed_out_ids: {timed_out_ids}")
    print(f"error_counts: {dict(error_counts)}")

    for record in failed_records[: args.show_failures]:
        print("-" * 72)
        print(f"[FAIL {record['id']}] {record['question']}")
        print(f"reasons: {record['reasons']}")
        print(f"cited_articles: {record['cited_articles']}")
        print(f"diagnostics: {record['diagnostics']}")
        print(f"answer_preview: {record['answer_preview']}")

    if verdict_counts["FAIL"] > 0:
        raise SystemExit(1)
    if args.exit_on_partial and verdict_counts["PARTIAL"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
