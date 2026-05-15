from __future__ import annotations

import json
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.db import SessionLocal

INPUT_PATH = BACKEND_DIR / "data" / "before_assets" / "law_chunks" / "all_chunks.json"
TARGET_CHUNK_IDS = {
    "여권법__제14조__ord01__mstmanual__passport14",
    "출입국관리법__제27조__ord01__mstmanual__immigration27",
}


def load_manual_chunks() -> list[dict]:
    chunks = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    selected = [chunk for chunk in chunks if chunk["chunk_id"] in TARGET_CHUNK_IDS]
    if len(selected) != len(TARGET_CHUNK_IDS):
        found_ids = {chunk["chunk_id"] for chunk in selected}
        missing = sorted(TARGET_CHUNK_IDS - found_ids)
        raise ValueError(f"Missing manual chunks in before asset file: {missing}")
    return selected


def ensure_table() -> None:
    create_sql = text(
        """
        CREATE TABLE IF NOT EXISTS before_law_chunk_supplements (
            chunk_id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    with SessionLocal() as session:
        session.execute(create_sql)
        session.commit()


def upsert_chunks(chunks: list[dict]) -> int:
    upsert_sql = text(
        """
        INSERT INTO before_law_chunk_supplements (chunk_id, payload)
        VALUES (:chunk_id, CAST(:payload AS JSONB))
        ON CONFLICT (chunk_id) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = NOW()
        """
    )
    with SessionLocal() as session:
        for chunk in chunks:
            session.execute(
                upsert_sql,
                {
                    "chunk_id": chunk["chunk_id"],
                    "payload": json.dumps(chunk, ensure_ascii=False),
                },
            )
        session.commit()
    return len(chunks)


def main() -> None:
    ensure_table()
    chunks = load_manual_chunks()
    upserted = upsert_chunks(chunks)
    print("before manual chunk sync complete")
    print(f"input: {INPUT_PATH}")
    print(f"upserted: {upserted}")
    for chunk in chunks:
        print(f"- {chunk['chunk_id']}")


if __name__ == "__main__":
    main()
