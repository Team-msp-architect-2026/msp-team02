from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
DEFAULT_INPUT_PATH = BACKEND_DIR / "data" / "law_chunks" / "all_chunks.json"
DATE_FIELDS = ("promulgation_date", "enforcement_date", "selected_as_of")
EXPECTED_KEYS = {
    "article_label",
    "article_no",
    "article_ordinal",
    "article_title",
    "chapter",
    "char_count_normalized",
    "char_count_original",
    "chunk_id",
    "chunk_id_suffix",
    "citation_label",
    "content",
    "content_normalized",
    "doc_type",
    "embedding_text",
    "enforcement_date",
    "field",
    "full_title",
    "law_id",
    "law_mst",
    "law_name",
    "legal_type",
    "ministry",
    "paragraph_no",
    "parent_article",
    "part",
    "promulgation_date",
    "relative_path",
    "section",
    "selected_as_of",
    "selected_commit",
    "source_ref",
    "source_url",
    "status",
    "structure_path",
    "subsection",
    "tier",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT_PATH),
        help="Path to all_chunks.json",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of rows per upsert batch",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and transform rows without writing to the database",
    )
    return parser.parse_args()


def parse_iso_date(value: str | None) -> date | None:
    if value in (None, ""):
        return None
    return date.fromisoformat(value)


def transform_chunk(chunk: dict[str, Any]) -> dict[str, Any]:
    unknown_keys = set(chunk) - EXPECTED_KEYS
    if unknown_keys:
        raise ValueError(f"Unexpected keys in chunk: {sorted(unknown_keys)}")

    missing_keys = EXPECTED_KEYS - set(chunk)
    if missing_keys:
        raise ValueError(f"Missing keys in chunk: {sorted(missing_keys)}")

    row = dict(chunk)

    for key in DATE_FIELDS:
        row[key] = parse_iso_date(row.get(key))

    return row


def load_chunks(input_path: Path) -> list[dict[str, Any]]:
    with input_path.open(encoding="utf-8") as f:
        chunks = json.load(f)

    if not isinstance(chunks, list):
        raise ValueError("Input JSON must be a list of chunk objects.")

    return [transform_chunk(chunk) for chunk in chunks]


def batched(rows: list[dict[str, Any]], batch_size: int) -> list[list[dict[str, Any]]]:
    return [rows[i : i + batch_size] for i in range(0, len(rows), batch_size)]


def upsert_rows(rows: list[dict[str, Any]], batch_size: int) -> int:
    from sqlalchemy.dialects.postgresql import insert

    from app.db import SessionLocal
    from app.models import LawChunk

    table = LawChunk.__table__
    # embedding is excluded from upsert so that Task 4 embeddings are never
    # overwritten by a metadata-only re-ingestion run.
    UPSERT_EXCLUDE = {"chunk_id", "embedding"}
    updatable_columns = [
        column.name for column in table.columns if column.name not in UPSERT_EXCLUDE
    ]

    upserted = 0
    with SessionLocal() as session:
        for batch in batched(rows, batch_size):
            statement = insert(table).values(batch)
            update_map = {
                column: getattr(statement.excluded, column)
                for column in updatable_columns
            }
            session.execute(
                statement.on_conflict_do_update(
                    index_elements=[table.c.chunk_id],
                    set_=update_map,
                )
            )
            session.commit()
            upserted += len(batch)

    return upserted


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()

    if args.batch_size <= 0:
        raise ValueError("--batch-size must be greater than 0.")
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    rows = load_chunks(input_path)

    print("=" * 60)
    print("Chunk ingestion")
    print("=" * 60)
    print(f"input: {input_path}")
    print(f"rows: {len(rows)}")
    print(f"batch_size: {args.batch_size}")

    if rows:
        print(f"sample chunk_id: {rows[0]['chunk_id']}")

    if args.dry_run:
        print("dry-run complete: no database writes performed")
        return

    written = upsert_rows(rows, args.batch_size)
    print(f"upsert complete: {written} rows upserted (insert or update, embedding preserved)")


if __name__ == "__main__":
    main()
