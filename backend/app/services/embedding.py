from __future__ import annotations

import os
import multiprocessing as mp
import traceback
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, TypeVar

import google.auth
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_EMBEDDING_MODEL_NAME = "gemini-embedding-001"
DEFAULT_QUERY_TASK_TYPE = "RETRIEVAL_QUERY"
OUTPUT_DIMENSIONALITY = 768
DEFAULT_EMBEDDING_TIMEOUT_MS = 20_000
DEFAULT_EMBEDDING_HARD_TIMEOUT_SECONDS = 15.0
DEFAULT_PROVIDER_TERMINATE_GRACE_SECONDS = 1.0
DEFAULT_PROVIDER_MAX_RETRIES = 2
DEFAULT_PROVIDER_RETRY_BASE_SECONDS = 1.0

T = TypeVar("T")

LEGAL_QUERY_HINT_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("감봉", "다른 부서"),
        "정당한 이유 없는 전직, 감봉 등 징벌 제한",
    ),
    (
        ("감봉", "전직"),
        "정당한 이유 없는 전직, 감봉 등 징벌 제한",
    ),
    (
        ("1년 미만",),
        "계속근로기간이 1년 미만인 근로자",
    ),
    (
        ("15시간 미만", "단시간근로자"),
        "4주간을 평균하여 1주간의 소정근로시간이 15시간 미만인 근로자",
    ),
    (
        ("퇴직급여", "대상"),
        "퇴직급여제도 설정 예외 해당 여부",
    ),
    (
        ("가족", "돌봄", "남겨"),
        "가족돌봄휴직과 가족돌봄휴가는 신청 사유 등을 적은 문서 또는 전자문서 제출",
    ),
    (
        ("가족", "돌봄", "서면"),
        "가족돌봄휴직 거절 사유 서면 통보 및 신청 관련 문서 제출",
    ),
    (
        ("가족", "돌봄", "거절"),
        "가족돌봄휴직 허용 예외, 거절 사유 서면 통보 및 지원조치",
    ),
    (
        ("가족", "돌봄", "불리한 처우"),
        "가족돌봄휴직 또는 가족돌봄휴가를 이유로 해고나 근로조건 악화 등 불리한 처우 금지",
    ),
    (
        ("가족", "돌봄", "불이익"),
        "가족돌봄휴직 또는 가족돌봄휴가를 이유로 해고나 근로조건 악화 등 불리한 처우 금지",
    ),
    (
        ("육아휴직", "거절"),
        "육아휴직 허용 의무와 육아휴직을 이유로 한 해고나 불리한 처우 금지 및 복귀 보장",
    ),
    (
        ("육아휴직", "사직"),
        "육아휴직 신청을 이유로 한 사직 강요, 해고, 불리한 처우 금지",
    ),
)


class VertexEmbeddingError(RuntimeError):
    """Raised when Vertex query embedding cannot be safely completed."""


class VertexProviderRuntimeError(RuntimeError):
    """Raised when a provider call fails for runtime reasons."""


class VertexProviderTimeoutError(RuntimeError):
    """Raised when a provider call exceeds the hard wall-clock timeout."""


def get_provider_process_context() -> mp.context.BaseContext:
    if "fork" in mp.get_all_start_methods():
        return mp.get_context("fork")
    return mp.get_context("spawn")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise VertexEmbeddingError(
            f"{name} is not set. Configure backend/.env before running retrieval."
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


def resolve_credentials_path(value: str) -> Path:
    credentials_path = Path(value).expanduser()
    if not credentials_path.is_absolute():
        return (REPO_ROOT / credentials_path).resolve()

    if credentials_path.is_file():
        return credentials_path.resolve()

    parts = credentials_path.parts
    if "config" in parts:
        config_index = parts.index("config")
        repo_relative_candidate = REPO_ROOT.joinpath(*parts[config_index:]).resolve()
        if repo_relative_candidate.is_file():
            return repo_relative_candidate

    return credentials_path


def resolve_positive_timeout_seconds(env_name: str, default: float) -> float:
    raw_value = os.environ.get(env_name, "").strip()
    if not raw_value:
        return default

    try:
        timeout_seconds = float(raw_value)
    except ValueError as exc:
        raise VertexEmbeddingError(
            f"{env_name} must be a positive number of seconds."
        ) from exc

    if timeout_seconds <= 0:
        raise VertexEmbeddingError(f"{env_name} must be greater than 0.")
    return timeout_seconds


def resolve_non_negative_int(env_name: str, default: int) -> int:
    raw_value = os.environ.get(env_name, "").strip()
    if not raw_value:
        return default

    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise VertexEmbeddingError(f"{env_name} must be a non-negative integer.") from exc

    if parsed < 0:
        raise VertexEmbeddingError(f"{env_name} must be non-negative.")
    return parsed


def resolve_vertex_runtime() -> tuple[str, str, object]:
    location = require_env("GCP_LOCATION")
    project = optional_env("GCP_PROJECT")
    credentials_path_value = optional_env("GOOGLE_APPLICATION_CREDENTIALS")

    if credentials_path_value:
        if is_placeholder_credentials_path(credentials_path_value):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
        else:
            credentials_path = resolve_credentials_path(credentials_path_value)
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
        raise VertexEmbeddingError(
            "No GCP project was resolved. Set GCP_PROJECT in backend/.env or configure "
            "ADC with a project-backed login."
        )

    return resolved_project, location, credentials


@lru_cache(maxsize=None)
def get_vertex_genai_client() -> genai.Client:
    project, location, credentials = resolve_vertex_runtime()
    return genai.Client(
        vertexai=True,
        project=project,
        location=location,
        credentials=credentials,
    )


def _provider_process_entry(
    target: Callable[..., Any],
    args: tuple[Any, ...],
    result_conn: Any,
) -> None:
    try:
        get_vertex_genai_client.cache_clear()
        payload = target(*args)
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
        result_conn.send({"status": "ok", "payload": payload})
    finally:
        result_conn.close()


def run_with_hard_timeout(
    target: Callable[..., T],
    args: tuple[Any, ...],
    *,
    timeout_seconds: float,
    timeout_label: str,
    application_error_factory: type[Exception],
    application_error_type_names: set[str],
) -> T:
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be greater than 0.")

    ctx = get_provider_process_context()
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    process = ctx.Process(
        target=_provider_process_entry,
        args=(target, args, child_conn),
    )
    process.start()
    child_conn.close()

    try:
        process.join(timeout_seconds)
        if process.is_alive():
            process.terminate()
            process.join(DEFAULT_PROVIDER_TERMINATE_GRACE_SECONDS)
            if process.is_alive():
                process.kill()
                process.join(DEFAULT_PROVIDER_TERMINATE_GRACE_SECONDS)
            raise VertexProviderTimeoutError(
                f"{timeout_label} exceeded hard wall-clock timeout after "
                f"{timeout_seconds:.1f}s."
            )

        if not parent_conn.poll(DEFAULT_PROVIDER_TERMINATE_GRACE_SECONDS):
            raise VertexProviderRuntimeError(
                f"{timeout_label} exited without returning a result. "
                f"exitcode={process.exitcode}"
            )
        try:
            result = parent_conn.recv()
        except EOFError as exc:
            raise VertexProviderRuntimeError(
                f"{timeout_label} exited before returning a result. "
                f"exitcode={process.exitcode}"
            ) from exc
    finally:
        parent_conn.close()

    if result["status"] == "ok":
        return result["payload"]

    error_type = str(result.get("error_type", "RuntimeError"))
    message = str(result.get("message", ""))
    if error_type in application_error_type_names:
        raise application_error_factory(message)

    raise VertexProviderRuntimeError(
        f"{timeout_label} failed with {error_type}: {message}"
    )


def resolve_provider_max_retries() -> int:
    return resolve_non_negative_int(
        "VERTEX_PROVIDER_MAX_RETRIES",
        DEFAULT_PROVIDER_MAX_RETRIES,
    )


def resolve_provider_retry_base_seconds() -> float:
    return resolve_positive_timeout_seconds(
        "VERTEX_PROVIDER_RETRY_BASE_SECONDS",
        DEFAULT_PROVIDER_RETRY_BASE_SECONDS,
    )


def is_retryable_provider_runtime_error(error: Exception) -> bool:
    normalized = str(error).upper()
    retry_markers = (
        "429",
        "RESOURCE_EXHAUSTED",
        "RATE LIMIT",
        "UNAVAILABLE",
        "503",
        "INTERNAL",
        "500",
    )
    return any(marker in normalized for marker in retry_markers)


def sleep_with_backoff(attempt_index: int, *, base_seconds: float) -> float:
    delay_seconds = base_seconds * (2 ** max(0, attempt_index - 1))
    time.sleep(delay_seconds)
    return delay_seconds


def matching_query_hints(query: str) -> list[str]:
    hints: list[str] = []
    for required_terms, hint in LEGAL_QUERY_HINT_RULES:
        if all(term in query for term in required_terms):
            hints.append(hint)
    return hints


def build_query_embedding_text(query: str) -> str:
    hints = matching_query_hints(query)
    if not hints:
        return query

    unique_hints = list(dict.fromkeys(hints))
    return f"{query}\n[법률용어 힌트] " + " / ".join(unique_hints)


def resolve_embedding_hard_timeout_seconds() -> float:
    return resolve_positive_timeout_seconds(
        "VERTEX_EMBEDDING_HARD_TIMEOUT_SECONDS",
        DEFAULT_EMBEDDING_HARD_TIMEOUT_SECONDS,
    )


def _embed_query_worker(
    embedding_text: str,
    model_name: str,
    task_type: str,
) -> list[float]:
    client = get_vertex_genai_client()
    response = client.models.embed_content(
        model=model_name,
        contents=embedding_text,
        config=genai_types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=OUTPUT_DIMENSIONALITY,
            http_options=genai_types.HttpOptions(timeout=DEFAULT_EMBEDDING_TIMEOUT_MS),
        ),
    )
    embeddings = response.embeddings or []
    if len(embeddings) != 1:
        raise VertexEmbeddingError(
            "Vertex AI returned an unexpected number of query embeddings: "
            f"{len(embeddings)}"
        )

    vector = list(embeddings[0].values)
    if len(vector) != OUTPUT_DIMENSIONALITY:
        raise VertexEmbeddingError(
            "Unexpected query embedding dimension: "
            f"{len(vector)} (expected {OUTPUT_DIMENSIONALITY})"
        )
    return vector


def embed_query(
    query: str,
    *,
    model_name: str = DEFAULT_EMBEDDING_MODEL_NAME,
    task_type: str = DEFAULT_QUERY_TASK_TYPE,
) -> list[float]:
    query_text = query.strip()
    if not query_text:
        raise ValueError("query must not be blank.")
    embedding_text = build_query_embedding_text(query_text)
    max_retries = resolve_provider_max_retries()
    retry_base_seconds = resolve_provider_retry_base_seconds()

    last_runtime_error: VertexProviderRuntimeError | None = None
    for attempt in range(1, max_retries + 2):
        try:
            return run_with_hard_timeout(
                _embed_query_worker,
                (embedding_text, model_name, task_type),
                timeout_seconds=resolve_embedding_hard_timeout_seconds(),
                timeout_label="query embedding provider call",
                application_error_factory=VertexEmbeddingError,
                application_error_type_names={"VertexEmbeddingError"},
            )
        except VertexProviderRuntimeError as exc:
            last_runtime_error = exc
            if attempt > max_retries or not is_retryable_provider_runtime_error(exc):
                raise
            sleep_with_backoff(attempt, base_seconds=retry_base_seconds)

    raise last_runtime_error or VertexProviderRuntimeError(
        "query embedding provider call failed without a specific runtime error."
    )
