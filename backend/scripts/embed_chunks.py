from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import google.auth
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv
from sqlalchemy import func, select, update
from tqdm import tqdm

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from app.db import SessionLocal
from app.models import LawChunk

DEFAULT_BATCH_SIZE = 5
DEFAULT_MODEL_NAME = "gemini-embedding-001"
DEFAULT_TASK_TYPE = "RETRIEVAL_DOCUMENT"
OUTPUT_DIMENSIONALITY = 768
DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000
LOG_PATH = BACKEND_DIR / "logs" / "embed_chunks.log"


@dataclass(frozen=True)
class ChunkToEmbed:
    chunk_id: str
    embedding_text: str


@dataclass
class EmbedStats:
    requested: int = 0
    succeeded: int = 0
    updated: int = 0
    failed: int = 0
    batch_failures: int = 0
    truncated: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of rows to send to Vertex AI per request",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process only the first N target rows after filtering",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Recompute embeddings even if the row already has one",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Call Vertex AI but skip database updates",
    )
    parser.add_argument(
        "--model-name",
        default=DEFAULT_MODEL_NAME,
        help="Vertex AI embedding model name",
    )
    parser.add_argument(
        "--task-type",
        default=DEFAULT_TASK_TYPE,
        help="Vertex AI task type for embed_content",
    )
    return parser.parse_args()


def configure_logger() -> logging.Logger:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("embed_chunks")
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    # Keep one log file per invocation so verification reflects the latest run.
    file_handler = logging.FileHandler(LOG_PATH, mode="w", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    logger.propagate = False
    return logger


def validate_args(args: argparse.Namespace) -> None:
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be greater than 0.")
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be greater than 0.")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"{name} is not set. Configure backend/.env before running embed_chunks.py."
        )
    return value


def optional_env(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def is_placeholder_credentials_path(value: str) -> bool:
    normalized = value.strip()
    return normalized in {
        "/path/to/service-account.json",
        "path/to/service-account.json",
    }


def init_vertex_client() -> genai.Client:
    location = require_env("GCP_LOCATION")
    project = optional_env("GCP_PROJECT")
    credentials_path_value = optional_env("GOOGLE_APPLICATION_CREDENTIALS")

    credentials_path: Path | None = None
    if credentials_path_value:
        if is_placeholder_credentials_path(credentials_path_value):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
            credentials_path_value = None
        else:
            credentials_path = Path(credentials_path_value).expanduser()
            if not credentials_path.is_file():
                raise FileNotFoundError(
                    "GOOGLE_APPLICATION_CREDENTIALS does not point to a readable file: "
                    f"{credentials_path}"
                )
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(credentials_path)

    if project == "your-gcp-project-id":
        project = None

    credentials, adc_project = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    resolved_project = project or adc_project
    if not resolved_project:
        raise RuntimeError(
            "No GCP project was resolved. Set GCP_PROJECT in backend/.env or configure "
            "ADC with a project-backed login."
        )

    return genai.Client(
        vertexai=True,
        project=resolved_project,
        location=location,
        credentials=credentials,
    )


def load_targets(force: bool, limit: int | None) -> tuple[int, int, list[ChunkToEmbed]]:
    with SessionLocal() as session:
        total_rows = session.scalar(select(func.count()).select_from(LawChunk)) or 0
        null_rows = (
            session.scalar(
                select(func.count())
                .select_from(LawChunk)
                .where(LawChunk.embedding.is_(None))
            )
            or 0
        )

        statement = select(LawChunk.chunk_id, LawChunk.embedding_text).order_by(
            LawChunk.chunk_id
        )
        if not force:
            statement = statement.where(LawChunk.embedding.is_(None))
        if limit is not None:
            statement = statement.limit(limit)

        rows = session.execute(statement).all()
        targets = [
            ChunkToEmbed(chunk_id=row.chunk_id, embedding_text=row.embedding_text)
            for row in rows
        ]

    return total_rows, null_rows, targets


def build_contents(batch: Sequence[ChunkToEmbed]) -> list[str]:
    contents: list[str] = []
    for item in batch:
        text = item.embedding_text.strip()
        if not text:
            raise ValueError(f"embedding_text is empty for chunk_id={item.chunk_id}")
        contents.append(text)
    return contents


def embed_batch(
    client: genai.Client,
    batch: Sequence[ChunkToEmbed],
    model_name: str,
    task_type: str,
    logger: logging.Logger,
    stats: EmbedStats,
) -> list[tuple[str, list[float]]]:
    response = client.models.embed_content(
        model=model_name,
        contents=build_contents(batch),
        config=genai_types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=OUTPUT_DIMENSIONALITY,
            auto_truncate=True,
            http_options=genai_types.HttpOptions(timeout=DEFAULT_EMBEDDING_TIMEOUT_MS),
        ),
    )
    embeddings = response.embeddings or []

    if len(embeddings) != len(batch):
        raise RuntimeError(
            "Vertex AI returned an unexpected number of embeddings: "
            f"expected {len(batch)}, got {len(embeddings)}"
        )

    prepared_vectors: list[tuple[str, list[float]]] = []
    for item, embedding in zip(batch, embeddings):
        vector = list(embedding.values)
        if len(vector) != OUTPUT_DIMENSIONALITY:
            raise ValueError(
                f"Unexpected embedding dimension for {item.chunk_id}: {len(vector)}"
            )

        statistics = getattr(embedding, "statistics", None)
        if statistics and getattr(statistics, "truncated", False):
            stats.truncated += 1
            logger.warning(
                "Embedding text was truncated by Vertex AI: chunk_id=%s token_count=%s",
                item.chunk_id,
                getattr(statistics, "token_count", "unknown"),
            )

        prepared_vectors.append((item.chunk_id, vector))

    return prepared_vectors


def save_embeddings(rows: Sequence[tuple[str, list[float]]]) -> None:
    with SessionLocal() as session:
        for chunk_id, vector in rows:
            session.execute(
                update(LawChunk)
                .where(LawChunk.chunk_id == chunk_id)
                .values(embedding=vector)
            )
        session.commit()


def process_batch(
    client: genai.Client,
    batch: Sequence[ChunkToEmbed],
    model_name: str,
    task_type: str,
    dry_run: bool,
    logger: logging.Logger,
    stats: EmbedStats,
    progress: tqdm,
    allow_split_retry: bool = True,
) -> None:
    try:
        rows = embed_batch(
            client=client,
            batch=batch,
            model_name=model_name,
            task_type=task_type,
            logger=logger,
            stats=stats,
        )

        stats.succeeded += len(batch)
        if not dry_run:
            save_embeddings(rows)
            stats.updated += len(batch)

        progress.update(len(batch))
    except Exception:
        if allow_split_retry or len(batch) == 1:
            stats.batch_failures += 1
        logger.exception(
            "Embedding batch failed: dry_run=%s chunk_ids=%s",
            dry_run,
            [item.chunk_id for item in batch],
        )

        if allow_split_retry and len(batch) > 1:
            for item in batch:
                process_batch(
                    client=client,
                    batch=[item],
                    model_name=model_name,
                    task_type=task_type,
                    dry_run=dry_run,
                    logger=logger,
                    stats=stats,
                    progress=progress,
                    allow_split_retry=False,
                )
            return

        stats.failed += len(batch)
        progress.update(len(batch))


def batched(
    rows: Sequence[ChunkToEmbed], batch_size: int
) -> list[Sequence[ChunkToEmbed]]:
    return [rows[i : i + batch_size] for i in range(0, len(rows), batch_size)]


def main() -> None:
    args = parse_args()
    validate_args(args)
    logger = configure_logger()
    try:
        total_rows, null_rows, targets = load_targets(force=args.force, limit=args.limit)
        stats = EmbedStats(requested=len(targets))

        print("=" * 72)
        print("Chunk embedding")
        print("=" * 72)
        print(f"total_rows: {total_rows}")
        print(f"null_embedding_rows: {null_rows}")
        print(f"target_rows: {len(targets)}")
        print(f"batch_size: {args.batch_size}")
        print(f"force: {args.force}")
        print(f"dry_run: {args.dry_run}")
        print(f"model_name: {args.model_name}")
        print(f"task_type: {args.task_type}")
        print(f"log_path: {LOG_PATH}")

        if not targets:
            print("No target rows found. Nothing to do.")
            return

        client = init_vertex_client()

        progress = tqdm(total=len(targets), desc="embedding", unit="row")
        try:
            for batch in batched(targets, args.batch_size):
                process_batch(
                    client=client,
                    batch=batch,
                    model_name=args.model_name,
                    task_type=args.task_type,
                    dry_run=args.dry_run,
                    logger=logger,
                    stats=stats,
                    progress=progress,
                )
        finally:
            progress.close()

        print("-" * 72)
        print(f"succeeded: {stats.succeeded}")
        print(f"updated: {stats.updated}")
        print(f"failed: {stats.failed}")
        print(f"batch_failures: {stats.batch_failures}")
        print(f"truncated: {stats.truncated}")
        print(
            "status: "
            + ("dry-run complete" if args.dry_run else "embedding update complete")
        )
    except Exception:
        logger.exception("Embedding run failed before completion.")
        raise


if __name__ == "__main__":
    main()
