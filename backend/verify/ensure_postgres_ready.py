from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
import psycopg2

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_PGDATA = BACKEND_DIR / ".pgdata"
DEFAULT_LOG_PATH = BACKEND_DIR / "logs" / "postgres.log"
DEFAULT_READY_TIMEOUT_SECONDS = 10.0
DEFAULT_POLL_INTERVAL_SECONDS = 0.5
DEFAULT_CONNECT_TIMEOUT_SECONDS = 3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--start-if-needed",
        action="store_true",
        help="Start the local postgres server if it is not accepting connections.",
    )
    parser.add_argument(
        "--pgdata",
        type=Path,
        default=DEFAULT_PGDATA,
        help="Path to the local PostgreSQL data directory.",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        default=DEFAULT_LOG_PATH,
        help="Path to the postgres log file used when starting the server.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=DEFAULT_READY_TIMEOUT_SECONDS,
        help="Maximum time to wait for a successful DB connection probe after starting.",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=DEFAULT_POLL_INTERVAL_SECONDS,
        help="Polling interval used while waiting for readiness.",
    )
    return parser.parse_args()


def require_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set in backend/.env.")
    return database_url


def resolve_local_connection(database_url: str) -> tuple[str, int, str, str]:
    parsed = urlparse(database_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    database = (parsed.path or "").lstrip("/") or "postgres"
    user = parsed.username or "postgres"
    return host, port, database, user


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )


def resolve_binary(name: str) -> str:
    env_bin = Path(sys.executable).resolve().parent / name
    if env_bin.is_file():
        return str(env_bin)

    discovered = shutil.which(name)
    if discovered:
        return discovered

    raise RuntimeError(f"{name} was not found in the current environment.")


def pg_isready(host: str, port: int, database: str, user: str) -> subprocess.CompletedProcess[str]:
    return run_command(
        [
            resolve_binary("pg_isready"),
            "-h",
            host,
            "-p",
            str(port),
            "-d",
            database,
            "-U",
            user,
        ]
    )


def safe_pg_isready(host: str, port: int, database: str, user: str) -> dict[str, object]:
    try:
        result = pg_isready(host, port, database, user)
    except RuntimeError as exc:
        return {
            "available": False,
            "error": str(exc),
        }

    return {
        "available": True,
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def start_postgres(pgdata: Path, log_path: Path, port: int) -> subprocess.CompletedProcess[str]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    return run_command(
        [
            resolve_binary("pg_ctl"),
            "-D",
            str(pgdata),
            "-l",
            str(log_path),
            "-o",
            f"-p {port}",
            "start",
        ]
    )


def print_json(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def pgdata_has_cluster(pgdata: Path) -> bool:
    return (pgdata / "PG_VERSION").is_file()


def probe_database(database_url: str) -> tuple[bool, dict[str, object]]:
    try:
        with psycopg2.connect(
            database_url,
            connect_timeout=DEFAULT_CONNECT_TIMEOUT_SECONDS,
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
        if row != (1,):
            return False, {
                "query": "SELECT 1",
                "error": f"unexpected result: {row!r}",
            }
        return True, {
            "query": "SELECT 1",
            "result": 1,
        }
    except Exception as exc:
        return False, {
            "query": "SELECT 1",
            "error_type": type(exc).__name__,
            "error": str(exc),
        }


def wait_for_ready_probe(
    *,
    database_url: str,
    host: str,
    port: int,
    database: str,
    user: str,
    timeout_seconds: float,
    poll_interval_seconds: float,
) -> tuple[bool, dict[str, object]]:
    started_at = time.monotonic()
    attempts = 0
    last_pg_isready: dict[str, object] | None = None
    last_probe: dict[str, object] | None = None

    while True:
        attempts += 1
        last_pg_isready = safe_pg_isready(host, port, database, user)
        is_ready, last_probe = probe_database(database_url)
        elapsed_ms = int((time.monotonic() - started_at) * 1000)
        if is_ready:
            return True, {
                "attempts": attempts,
                "elapsed_ms": elapsed_ms,
                "pg_isready": last_pg_isready,
                "probe": last_probe,
            }

        if time.monotonic() - started_at >= timeout_seconds:
            return False, {
                "attempts": attempts,
                "elapsed_ms": elapsed_ms,
                "pg_isready": last_pg_isready,
                "probe": last_probe,
            }

        time.sleep(poll_interval_seconds)


def main() -> None:
    args = parse_args()
    if args.timeout_seconds <= 0:
        raise ValueError("--timeout-seconds must be greater than 0.")
    if args.poll_interval_seconds <= 0:
        raise ValueError("--poll-interval-seconds must be greater than 0.")

    database_url = require_database_url()
    host, port, database, user = resolve_local_connection(database_url)

    initial_ready, initial_details = wait_for_ready_probe(
        database_url=database_url,
        host=host,
        port=port,
        database=database,
        user=user,
        timeout_seconds=min(args.timeout_seconds, args.poll_interval_seconds),
        poll_interval_seconds=args.poll_interval_seconds,
    )
    if initial_ready:
        print_json(
            {
                "status": "ready",
                "host": host,
                "port": port,
                "database": database,
                "user": user,
                "readiness": initial_details,
            }
        )
        return

    if not args.start_if_needed:
        print_json(
            {
                "status": "not_ready",
                "host": host,
                "port": port,
                "database": database,
                "user": user,
                "pgdata": str(args.pgdata),
                "pgdata_initialized": pgdata_has_cluster(args.pgdata),
                "readiness": initial_details,
            }
        )
        sys.exit(1)

    if not pgdata_has_cluster(args.pgdata):
        print_json(
            {
                "status": "pgdata_not_initialized",
                "pgdata": str(args.pgdata),
                "hint": "Initialize the cluster first, then rerun with --start-if-needed.",
            }
        )
        sys.exit(1)

    start_result = start_postgres(args.pgdata, args.log_path, port)
    if start_result.returncode != 0:
        recovered_ready, recovered_details = wait_for_ready_probe(
            database_url=database_url,
            host=host,
            port=port,
            database=database,
            user=user,
            timeout_seconds=args.timeout_seconds,
            poll_interval_seconds=args.poll_interval_seconds,
        )
        if recovered_ready:
            print_json(
                {
                    "status": "ready_existing_server",
                    "host": host,
                    "port": port,
                    "database": database,
                    "user": user,
                    "readiness": recovered_details,
                    "pg_ctl_stdout": start_result.stdout.strip(),
                    "pg_ctl_stderr": start_result.stderr.strip(),
                    "log_path": str(args.log_path),
                }
            )
            return

        print_json(
            {
                "status": "start_failed",
                "pg_ctl_stdout": start_result.stdout.strip(),
                "pg_ctl_stderr": start_result.stderr.strip(),
                "readiness": recovered_details,
                "log_path": str(args.log_path),
            }
        )
        sys.exit(start_result.returncode)

    ready_after_start, after_start_details = wait_for_ready_probe(
        database_url=database_url,
        host=host,
        port=port,
        database=database,
        user=user,
        timeout_seconds=args.timeout_seconds,
        poll_interval_seconds=args.poll_interval_seconds,
    )
    if not ready_after_start:
        print_json(
            {
                "status": "started_but_not_ready",
                "readiness": after_start_details,
                "log_path": str(args.log_path),
            }
        )
        sys.exit(1)

    print_json(
        {
            "status": "started",
            "host": host,
            "port": port,
            "database": database,
            "user": user,
            "readiness": after_start_details,
            "log_path": str(args.log_path),
        }
    )


if __name__ == "__main__":
    main()
