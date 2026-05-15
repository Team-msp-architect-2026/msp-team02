from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_DB_POOL_SIZE = 2
DEFAULT_DB_MAX_OVERFLOW = 3
DEFAULT_DB_POOL_TIMEOUT_SECONDS = 30


def _resolve_int_env(name: str, default: int, *, minimum: int) -> int:
    raw_value = os.environ.get(name, "").strip()
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc

    if value < minimum:
        raise RuntimeError(f"{name} must be greater than or equal to {minimum}.")
    return value


DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Create backend/.env from backend/.env.example."
    )

DB_POOL_SIZE = _resolve_int_env("DB_POOL_SIZE", DEFAULT_DB_POOL_SIZE, minimum=1)
DB_MAX_OVERFLOW = _resolve_int_env(
    "DB_MAX_OVERFLOW",
    DEFAULT_DB_MAX_OVERFLOW,
    minimum=0,
)
DB_POOL_TIMEOUT_SECONDS = _resolve_int_env(
    "DB_POOL_TIMEOUT_SECONDS",
    DEFAULT_DB_POOL_TIMEOUT_SECONDS,
    minimum=1,
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT_SECONDS,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
