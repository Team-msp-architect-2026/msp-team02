#!/usr/bin/env bash
set -euo pipefail
set -E

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"
CONDA_SH="/home/jongwon/anaconda3/etc/profile.d/conda.sh"
CONDA_ENV_NAME="law_main_road"
CURRENT_STEP="initialization"

info() {
  printf '[INFO] %s\n' "$*"
}

pass() {
  printf '[PASS] %s\n' "$*"
}

fail() {
  printf '[FAIL] %s\n' "$*" >&2
}

on_error() {
  local exit_code=$?
  fail "Step failed: ${CURRENT_STEP} (exit ${exit_code})"
  fail "Fix the issue above, then rerun: bash scripts/demo_preflight.sh"
  exit "${exit_code}"
}

trap on_error ERR

run_step() {
  local label="$1"
  shift

  CURRENT_STEP="${label}"
  info "${label}"
  "$@"
  pass "${label}"
}

check_git_status() {
  git status -sb
  info "Local-only dirty files do not fail this preflight."
  info "Expected local-only files should not be staged before submission/demo commits."
}

check_main_matches_origin() {
  local branch
  local head_sha
  local origin_main_sha

  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${branch}" != "main" ]]; then
    fail "Expected branch main, but current branch is ${branch}."
    return 1
  fi

  if ! git show-ref --verify --quiet refs/remotes/origin/main; then
    fail "origin/main ref is not available. Fetch or check remote setup manually."
    return 1
  fi

  head_sha="$(git rev-parse HEAD)"
  origin_main_sha="$(git rev-parse origin/main)"

  if [[ "${head_sha}" != "${origin_main_sha}" ]]; then
    fail "Expected main == origin/main, but HEAD ${head_sha} != origin/main ${origin_main_sha}."
    return 1
  fi
}

check_postgres_ready() {
  pg_isready -h 127.0.0.1 -p 5432
}

activate_conda_env() {
  if [[ ! -f "${CONDA_SH}" ]]; then
    fail "Conda profile not found: ${CONDA_SH}"
    return 1
  fi

  # shellcheck source=/home/jongwon/anaconda3/etc/profile.d/conda.sh
  source "${CONDA_SH}"
  conda activate "${CONDA_ENV_NAME}"
  python --version
}

backend_import_check() {
  python -c "from backend.main import app; print('import_ok')"
}

document_draft_smoke() {
  python backend/verify/check_document_draft.py
}

frontend_build() {
  (
    cd "${FRONTEND_DIR}"
    npm run build
  )
}

post_build_git_status() {
  info "Post-build git status. npm run build may update frontend/next-env.d.ts."
  git status -sb
  info "Review generated/local-only changes before staging. This script never runs git add/commit/restore."
}

playwright_chromium_smoke() {
  (
    cd "${FRONTEND_DIR}"
    node -e "const { chromium } = require('@playwright/test'); (async () => { const browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); await page.goto('data:text/html,<h1>ok</h1>'); console.log(await page.textContent('h1')); await browser.close(); })().catch((error) => { console.error(error); process.exit(1); });"
  )
}

print_manual_demo_commands() {
  info "Preflight completed. This script did not start backend/frontend servers, PostgreSQL, or kill any process."
  info "Start demo servers manually in separate terminals when ready."

  cat <<'EOF'

backend:
source /home/jongwon/anaconda3/etc/profile.d/conda.sh
conda activate law_main_road
uvicorn backend.main:app --reload

frontend:
cd frontend
npm run dev

browser:
http://localhost:3000/after
EOF
}

main() {
  cd "${REPO_ROOT}"

  info "Repo root: ${REPO_ROOT}"
  run_step "Git status" check_git_status
  run_step "main == origin/main" check_main_matches_origin
  run_step "PostgreSQL readiness" check_postgres_ready
  run_step "Conda env activation (${CONDA_ENV_NAME})" activate_conda_env
  run_step "Backend import check" backend_import_check
  run_step "Document draft smoke" document_draft_smoke
  run_step "Frontend build" frontend_build
  run_step "Post-build git status" post_build_git_status
  run_step "WSL Playwright Chromium smoke" playwright_chromium_smoke
  print_manual_demo_commands
}

main "$@"
