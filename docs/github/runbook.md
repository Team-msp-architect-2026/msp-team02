# Runbook / 실행 점검

기준일: `2026-05-13`

이 문서는 public mirror용 concise quick reference입니다. 실행/배포 command의
canonical owner는 GitHub Wiki의 `Deployment-and-Setup-Guide`이고,
troubleshooting owner는 Wiki의 `Runbook-Troubleshooting`입니다. command가
달라질 때는 Wiki owner 문서를 먼저 갱신한 뒤 이 요약을 맞춥니다.

## Local Requirements / 로컬 요구사항

- WSL Ubuntu 또는 compatible Linux shell
- conda
- Python과 pip
- Node.js와 npm
- PostgreSQL + pgvector
- live model calls용 GCP / Vertex credentials
- SCN-001 protected auth flow용 Firebase project config

## Setup

```bash
git submodule update --init --recursive
conda activate law_main_road
pip install -r backend/requirements.txt
cd frontend
npm install
```

Environment files / 환경 파일:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

실제 env files, cloud IAM key JSON, Firebase ID tokens, auth-provider subject
identifiers, email values는 commit하지 않습니다.

## Database

PostgreSQL 확인:

```bash
python backend/verify/ensure_postgres_ready.py
```

migrations 적용:

```bash
cd backend
alembic upgrade head
cd ..
```

현재 migration line에는 SCN-001 user/Bridge linkage와 MVP history visibility
fields가 포함되어 있습니다.

## Run Servers / 서버 실행

Backend:

```bash
conda activate law_main_road
uvicorn backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

기본 URLs:

- backend: `http://localhost:8000`
- frontend: `http://localhost:5090`

## Focused Verification / 집중 검증

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
cd frontend
npm run build
```

## Demo Preflight

```bash
bash scripts/demo_preflight.sh
```

이 script는 submission-oriented path를 확인합니다. auth-required flows의 manual
browser rehearsal을 대체하지는 않습니다.

## When to Run Full Eval

broad retrieval/answer eval은 다음 중 하나가 바뀐 경우에만 실행합니다.

- retrieval service
- answer generation service
- embedding behavior
- DB corpus contents
- API response contract

doc-only changes에는 focused checks로 충분합니다.

## Demo Rehearsal Notes

SCN-004 public demo:

1. `http://localhost:5090/after`를 엽니다.
2. `SCN-004-DEMO-FREEZE`를 선택합니다.
3. unchanged preset으로 submit합니다.
4. `/after/result`를 확인합니다.
5. 각 supported draft type을 생성합니다.
6. copy와 print를 확인합니다.
7. entry disclaimer가 보이는지 확인합니다.

SCN-001 protected path:

1. Google로 sign in합니다.
2. backend `/api/v1/auth/me` verification을 기다립니다.
3. `/before`에서 completed review를 만듭니다.
4. Bridge handoff를 만듭니다.
5. `/after`에서 checked Bridge submit을 사용합니다.
6. answer-only result를 확인합니다.
7. 필요하면 `/history`와 soft-delete behavior를 확인합니다.

증거는 PASS/PRESENT/ABSENT/NO 수준으로만 기록합니다. raw tokens, provider ids,
raw query bodies, full answers, artifact bodies, real Bridge ids는 기록하지
않습니다.

docs-only sync work에서는 기본적으로 build/server/browser smoke를 실행하지
않습니다. code나 behavior가 바뀌지 않았다면 `git diff --check`와 targeted text
checks를 사용합니다.
