"""
settings.py — before stack 공통 설정 모듈
main repo 내부 자산 경로와 before 전용 환경변수 fallback 을 정의한다.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# ── 기준 디렉토리 ─────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
ASSETS_DIR = BACKEND_DIR / "data" / "before_assets"
ARTIFACTS_DIR = BACKEND_DIR / "data" / "before_artifacts"
TEST_RUNS_DIR = ARTIFACTS_DIR / "runs"

load_dotenv(BACKEND_DIR / ".env")


# ── before 전용 환경변수 fallback 로드 ────────────────────────────────────────

def _set_env_default(key: str, value: str) -> None:
    """기존 환경변수가 없을 때만 기본값을 주입한다."""
    if value and not os.environ.get(key):
        os.environ[key] = value


def _load_env_file_defaults(env_path: Path) -> None:
    """간단한 KEY=VALUE 형식의 env 파일을 fallback 기본값으로 로드한다."""
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key == "GOOGLE_APPLICATION_CREDENTIALS" and value:
            cred_path = Path(value).expanduser()
            if not cred_path.is_absolute():
                cred_path = (REPO_ROOT / cred_path).resolve()
            value = str(cred_path)

        _set_env_default(key, value)


def _load_project_id_from_service_account() -> None:
    """서비스 계정 JSON 에서 project_id 를 읽어 fallback 으로 사용한다."""
    if os.environ.get("GCP_PROJECT_ID"):
        return

    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        return

    cred_path = Path(credentials_path).expanduser()
    if not cred_path.is_absolute():
        cred_path = (REPO_ROOT / cred_path).resolve()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(cred_path)

    if not cred_path.exists():
        return

    try:
        payload = json.loads(cred_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    project_id = payload.get("project_id", "")
    _set_env_default("GCP_PROJECT_ID", project_id)


def _load_before_env_defaults() -> None:
    """before 전용 환경변수를 공용 이름으로 fallback 주입한다."""
    before_credentials = os.environ.get("BEFORE_GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if before_credentials:
        cred_path = Path(before_credentials).expanduser()
        if not cred_path.is_absolute():
            cred_path = (REPO_ROOT / cred_path).resolve()
        _set_env_default("GOOGLE_APPLICATION_CREDENTIALS", str(cred_path))

    _set_env_default(
        "GCP_PROJECT_ID",
        os.environ.get("BEFORE_GCP_PROJECT_ID", "").strip()
        or os.environ.get("GCP_PROJECT", "").strip(),
    )
    _set_env_default(
        "GCP_LOCATION",
        os.environ.get("BEFORE_GCP_LOCATION", "").strip(),
    )
    _set_env_default(
        "VERTEX_MODEL",
        os.environ.get("BEFORE_VERTEX_MODEL", "").strip()
        or os.environ.get("VERTEX_ANSWER_MODEL", "").strip(),
    )
    _load_project_id_from_service_account()


_load_before_env_defaults()

# ── 데이터 경로 상수 ──────────────────────────────────────────────────────────

LAW_CHUNKS_PATH = ASSETS_DIR / "law_chunks" / "all_chunks.json"
STANDARD_MAP_PATH = ASSETS_DIR / "data" / "standard_map.json"
MIN_WAGE_YAML_PATH = ASSETS_DIR / "config" / "minimum_wage.yaml"
BEFORE_LAW_SOURCE: str = os.environ.get("BEFORE_LAW_SOURCE", "db").strip().lower() or "db"

if BEFORE_LAW_SOURCE not in {"file", "db"}:
    raise EnvironmentError(
        "BEFORE_LAW_SOURCE must be one of: file, db\n"
        "  export BEFORE_LAW_SOURCE=file\n"
        "  export BEFORE_LAW_SOURCE=db"
    )

# ── Vertex AI 설정 (Phase A / Phase B 공용) ──────────────────────────────────

GCP_PROJECT_ID:  str = os.environ.get("GCP_PROJECT_ID", "") or os.environ.get("GCP_PROJECT", "")
GCP_LOCATION:    str = os.environ.get("GCP_LOCATION", "us-central1")
VERTEX_MODEL:    str = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash")
PHASE_A_VERTEX_MODEL: str = os.environ.get("PHASE_A_VERTEX_MODEL", VERTEX_MODEL)

# GOOGLE_APPLICATION_CREDENTIALS 는 Vertex AI SDK 가 자동으로 읽음
# 로컬에서는 export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json 으로 설정


# ── LLM 프로바이더 선택 ───────────────────────────────────────────────────────

LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "vertex")
# 'vertex' | 'ollama'
# Phase B 기본값: 'vertex'

OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL:    str = os.environ.get("OLLAMA_MODEL", "qwen2.5:14b")


# ── 검증 헬퍼 ─────────────────────────────────────────────────────────────────

def require_phase_a_env() -> None:
    """
    Phase A 실행에 필요한 환경변수가 모두 설정됐는지 확인한다.
    누락 시 EnvironmentError를 raise한다.
    """
    missing = []
    if not GCP_PROJECT_ID:
        missing.append("GCP_PROJECT_ID")
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not _is_workload_identity():
        missing.append("GOOGLE_APPLICATION_CREDENTIALS")
    if missing:
        raise EnvironmentError(
            f"Phase A 필수 환경변수 누락: {', '.join(missing)}\n"
            "  export GCP_PROJECT_ID=your_project_id\n"
            "  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service_account_key.json"
        )


def require_phase_b_env() -> None:
    """
    Phase B 실행에 필요한 환경변수가 모두 설정됐는지 확인한다.
    누락 시 EnvironmentError를 raise한다.
    """
    missing = []
    if not GCP_PROJECT_ID:
        missing.append("GCP_PROJECT_ID")
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not _is_workload_identity():
        missing.append("GOOGLE_APPLICATION_CREDENTIALS")
    if missing:
        raise EnvironmentError(
            f"Phase B 필수 환경변수 누락: {', '.join(missing)}\n"
            "  export GCP_PROJECT_ID=your_project_id\n"
            "  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service_account_key.json"
        )


def _is_workload_identity() -> bool:
    """Cloud Run / GKE Workload Identity 환경인지 확인."""
    return (
        os.path.exists("/var/run/secrets/kubernetes.io/serviceaccount/token")
        or os.environ.get("K_SERVICE") is not None   # Cloud Run
    )


# ── 파일 존재 확인 ────────────────────────────────────────────────────────────

def check_required_files() -> None:
    """
    서버 시작 전 필수 파일들의 존재를 확인한다.
    누락 시 FileNotFoundError를 raise한다.
    """
    required = {
        "standard_map.json": STANDARD_MAP_PATH,
        "minimum_wage.yaml": MIN_WAGE_YAML_PATH,
    }
    if BEFORE_LAW_SOURCE == "file":
        required["all_chunks.json"] = LAW_CHUNKS_PATH
    missing = [name for name, path in required.items() if not path.exists()]
    if missing:
        raise FileNotFoundError(
            f"필수 파일 없음: {', '.join(missing)}\n"
            "  - standard_map.json 없으면: python -m jobs.standard_mapper 실행\n"
            "  - minimum_wage.yaml 없으면: assets/config/ 디렉토리 확인"
        )
