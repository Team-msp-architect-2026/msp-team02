#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
FRONTEND_DIR="${REPO_ROOT}/frontend"
LOG_DIR="${BACKEND_DIR}/logs"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5090}"
EXPECTED_CONDA_ENV="${EXPECTED_CONDA_ENV:-law_main_road}"

BACKEND_LOG="${LOG_DIR}/starting_backend.log"
FRONTEND_LOG="${LOG_DIR}/starting_frontend.log"
BACKEND_PID_FILE="${LOG_DIR}/starting_backend.pid"
FRONTEND_PID_FILE="${LOG_DIR}/starting_frontend.pid"

mkdir -p "${LOG_DIR}"

log() {
  printf '[starting] %s\n' "$*"
}

fail() {
  printf '[starting][error] %s\n' "$*" >&2
  exit 1
}

activate_conda_if_needed() {
  if [[ "${CONDA_DEFAULT_ENV:-}" == "${EXPECTED_CONDA_ENV}" ]]; then
    log "conda env already active: ${CONDA_DEFAULT_ENV}"
    return 0
  fi

  if command -v conda >/dev/null 2>&1; then
    log "activating conda env: ${EXPECTED_CONDA_ENV}"
    eval "$(conda shell.bash hook)"
    conda activate "${EXPECTED_CONDA_ENV}"
    return 0
  fi

  fail "conda env '${EXPECTED_CONDA_ENV}' is not active and 'conda' command was not found. Activate the env first, then rerun this script."
}

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || fail "required file not found: ${path}"
}

port_in_use() {
  local port="$1"
  python - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
s = socket.socket()
s.settimeout(0.5)
result = s.connect_ex(("127.0.0.1", port))
s.close()
sys.exit(0 if result == 0 else 1)
PY
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-40}"
  local sleep_seconds="${4:-0.5}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "${label} is ready: ${url}"
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  fail "${label} did not become ready: ${url}. Check logs: ${BACKEND_LOG} ${FRONTEND_LOG}"
}

start_backend() {
  if port_in_use "${BACKEND_PORT}"; then
    log "backend already appears to be running on port ${BACKEND_PORT}"
    return 0
  fi

  log "starting backend on port ${BACKEND_PORT}"
  nohup python -m uvicorn backend.main:app --reload >"${BACKEND_LOG}" 2>&1 &
  echo $! >"${BACKEND_PID_FILE}"
  wait_for_http "http://127.0.0.1:${BACKEND_PORT}/health" "backend"
}

start_frontend() {
  if port_in_use "${FRONTEND_PORT}"; then
    log "frontend already appears to be running on port ${FRONTEND_PORT}"
    return 0
  fi

  log "starting frontend on port ${FRONTEND_PORT}"
  (
    cd "${FRONTEND_DIR}"
    nohup npm run dev >"${FRONTEND_LOG}" 2>&1 &
    echo $! >"${FRONTEND_PID_FILE}"
  )
  wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" "frontend"
}

main() {
  cd "${REPO_ROOT}"

  log "repo root: ${REPO_ROOT}"
  activate_conda_if_needed

  require_file "${BACKEND_DIR}/.env"
  require_file "${FRONTEND_DIR}/package.json"

  log "checking PostgreSQL readiness"
  python "${BACKEND_DIR}/verify/ensure_postgres_ready.py" --start-if-needed

  log "upgrading alembic to head"
  (
    cd "${BACKEND_DIR}"
    alembic upgrade head
  )

  log "syncing before manual chunks into DB supplement"
  python "${BACKEND_DIR}/scripts/sync_before_manual_chunks_to_db.py"

  log "running backend import smoke"
  python -c "from backend.main import app; print('import_ok')"

  start_backend
  start_frontend

  log "done"
  log "backend:  http://127.0.0.1:${BACKEND_PORT}/health"
  log "before:   http://127.0.0.1:${BACKEND_PORT}/api/v1/before/health"
  log "frontend: http://127.0.0.1:${FRONTEND_PORT}"
  log "backend log:  ${BACKEND_LOG}"
  log "frontend log: ${FRONTEND_LOG}"
}

main "$@"
