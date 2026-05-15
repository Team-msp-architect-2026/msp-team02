from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.retrieval import retrieve_law_chunks

HIT_LEVELS = (1, 3, 5)
DEFAULT_DATASET_PATH = REPO_ROOT / "eval" / "mvp_in_scope_eval_v1.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to the retrieval eval dataset JSON file",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of retrieved chunks per question. Must be at least 5.",
    )
    parser.add_argument(
        "--ef-search",
        type=int,
        default=100,
        help="Runtime HNSW ef_search value",
    )
    parser.add_argument(
        "--show-failures",
        type=int,
        default=10,
        help="Maximum number of hit@5 failures to print",
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


def has_hit(gold_citations: set[str], predicted_citations: list[str], k: int) -> bool:
    return bool(gold_citations.intersection(predicted_citations[:k]))


def main() -> None:
    args = parse_args()
    if args.top_k < 5:
        raise ValueError("--top-k must be at least 5 to compute hit@5.")
    if args.show_failures < 0:
        raise ValueError("--show-failures must be 0 or greater.")

    items = load_eval_items(args.dataset)
    overall_hits = {level: 0 for level in HIT_LEVELS}
    by_question_type: dict[str, dict[str, int]] = defaultdict(
        lambda: {"count": 0, "hit@1": 0, "hit@3": 0, "hit@5": 0}
    )
    failures: list[dict[str, Any]] = []

    for item in items:
        result = retrieve_law_chunks(
            query=item["question"],
            top_k=args.top_k,
            ef_search=args.ef_search,
        )
        predicted_citations = [chunk.citation_label for chunk in result.chunks]
        gold_citations = set(item["gold_citations"])
        question_type = item["question_type"]

        by_question_type[question_type]["count"] += 1

        for level in HIT_LEVELS:
            hit = has_hit(gold_citations, predicted_citations, level)
            if hit:
                overall_hits[level] += 1
                by_question_type[question_type][f"hit@{level}"] += 1

        if not has_hit(gold_citations, predicted_citations, 5):
            failures.append(
                {
                    "id": item["id"],
                    "question_type": question_type,
                    "question": item["question"],
                    "gold_citations": item["gold_citations"],
                    "predicted_top5": predicted_citations[:5],
                }
            )

    total_items = len(items)

    print("=" * 72)
    print("Retrieval eval")
    print("=" * 72)
    print(f"dataset: {args.dataset}")
    print(f"items: {total_items}")
    print(f"top_k: {args.top_k}")
    print(f"ef_search: {args.ef_search}")
    for level in HIT_LEVELS:
        hits = overall_hits[level]
        rate = (hits / total_items) if total_items else 0.0
        print(f"hit@{level}: {hits}/{total_items} ({rate:.2%})")

    print("-" * 72)
    print("Question type breakdown")
    for question_type in sorted(by_question_type):
        counts = by_question_type[question_type]
        total = counts["count"]
        hit1 = counts["hit@1"] / total if total else 0.0
        hit3 = counts["hit@3"] / total if total else 0.0
        hit5 = counts["hit@5"] / total if total else 0.0
        print(
            f"{question_type}: count={total} "
            f"hit@1={counts['hit@1']}/{total} ({hit1:.2%}) "
            f"hit@3={counts['hit@3']}/{total} ({hit3:.2%}) "
            f"hit@5={counts['hit@5']}/{total} ({hit5:.2%})"
        )

    print("-" * 72)
    print(f"hit@5_failures: {len(failures)}")
    for failure in failures[: args.show_failures]:
        print(f"[{failure['id']}] {failure['question_type']}")
        print(f"question: {failure['question']}")
        print(f"gold: {failure['gold_citations']}")
        print(f"predicted_top5: {failure['predicted_top5']}")


if __name__ == "__main__":
    main()
