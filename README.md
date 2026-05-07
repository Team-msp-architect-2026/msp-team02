# 법대로(LawMainRoad)

법대로(LawMainRoad)는 외국인 근로자와 취약 노동자가 근로계약, 임금체불,
부당해고, 사업장 변경 같은 노동 문제를 한국 노동법 근거와 함께 정리할 수
있도록 돕는 AI 지원 MVP입니다.

이 public repository는 공모전 제출과 공개 검토를 위한 curated public mirror입니다.
현재 public mirror는 deploy authority가 아니며, 개발과 배포 자동화의 최종
권한을 의미하지 않습니다.

## 공개 문서

상세 문서는 GitHub Wiki를 canonical 공개 문서로 사용합니다. 이 README는 첫
화면에서 프로젝트 목적, 현재 구현 범위, 공개 경계, 실행 방법을 빠르게 확인하기
위한 요약 문서입니다.

주요 Wiki 링크:

- [GitHub Wiki](https://github.com/Team-msp-architect-2026/msp-team02/wiki)
- [Final-Architecture](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture)
- [User-Flows](https://github.com/Team-msp-architect-2026/msp-team02/wiki/User-Flows)
- [API-Endpoints-and-Schemas](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)
- [Cloud-Migration-and-Public-Mirror-Policy](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy)

내부 planning, architecture, operations 기록은 공개 Wiki와 README에 그대로
노출하지 않습니다. 공개 문서는 현재 구현 기준과 공개 가능한 범위를 기준으로
다시 정리한 내용입니다.

## 현재 구현 범위

기준일: `2026-05-07`

- SCN-004 login-free After answer/draft demo
- SCN-001 Before -> Bridge -> After answer linkage
- SCN-001 protected history archive and MVP soft-delete
- SCN-001 고정 preset 기반 frontend-local frozen draft demo
- Firebase Auth Google Sign-In + backend verification
- PostgreSQL + pgvector 기반 법령 검색
- Vertex AI Gemini 기반 answer/OCR/embedding 연동
- Next.js App Router 기반 frontend
- FastAPI 기반 backend
- 법령 chunk `1722`개, `selected_as_of = 2026-04-11`

구현된 주요 route:

- `/`
- `/before`
- `/after`
- `/after/result`
- `/after/intake`
- `/after/draft`
- `/history`

대표 흐름:

- SCN-004: `/after -> /after/result -> /after/intake -> /after/draft`
- SCN-001: Before review -> Bridge context -> After answer
- History: backend-verified user의 SCN-001 record archive와 MVP soft-delete

## 아키텍처 요약

```text
legal source data
  -> preprocessing / chunking
  -> law chunks
  -> PostgreSQL + pgvector
  -> retrieval
  -> grounded answer
  -> optional document draft
  -> Next.js frontend
```

주요 기술:

| 영역 | 기술 |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Backend | FastAPI |
| Database | PostgreSQL + pgvector |
| Auth | Firebase Auth Google Sign-In, Firebase Admin verification |
| LLM/OCR | Vertex AI Gemini |
| Embedding | `gemini-embedding-001`, 768 dimensions |

## API와 사용자 흐름

공개 문서의 canonical API 설명은
[API-Endpoints-and-Schemas](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)를
따릅니다.

현재 README에서 강조하는 public/protected API 경계:

- `/api/v1/retrieve`
- `/api/v1/answer`
- `/api/v1/documents/draft`
- `/api/v1/auth/me`
- `/api/v1/scn001/bridge-runs`
- `/api/v1/scn001/before-review-jobs`

SCN-004 After flow는 login-free demo 흐름을 유지합니다. SCN-001 protected
actions는 backend-verified auth를 요구합니다. Bridge는 사건 맥락을 이어 주는
연결/참고 정보이며, 법적 근거(legal grounding)가 아닙니다.

## 데모 / 클라우드 상태

Cloud migration은 dev-first policy를 사용합니다.

- `dev`: first cloud target and smoke-test environment
- `demo/contest`: dev smoke 이후 기간 한정 public presentation posture
- `prod`: 별도 production-opening review 전까지 미오픈(NOT opened)

이 저장소와 공개 문서는 운영 배포 주장으로 읽히지 않습니다. 공모전 제출과 공개
검토를 위한 demo posture, 구현 범위, 미오픈 범위를 구분해 설명합니다.

public mirror는 curated submission surface이며 deploy authority가 아닙니다.
cloud migration과 public mirror 정책의 상세 내용은
[Cloud-Migration-and-Public-Mirror-Policy](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy)를
따릅니다.

## 미오픈 범위

다음 항목은 현재 공개 구현 범위에서 미오픈(NOT opened) 상태입니다.

- SCN-001 live/backend document draft generation
- protected SCN-001 draft endpoint
- independent `/bridge`
- Recovery
- SCN-005
- full retention lifecycle
- hard delete, artifact purge, account deletion, undo/restore
- 운영 배포 주장

SCN-001의 고정 preset 기반 frozen draft demo는 frontend-local deterministic
flow입니다. live/backend SCN-001 draft generation 또는 protected SCN-001 draft
endpoint를 의미하지 않습니다.

## 보안과 개인정보 경계

공개 문서와 public mirror에는 다음 정보를 포함하지 않습니다.

- 인증 비밀값, local env values, cloud secret values
- infrastructure state files 또는 cloud IAM key files
- cloud project identifier, runtime URL, private cloud inventory
- 인증 provider의 개인 식별자, 이메일 값, database account identifier
- 사건 원문 데이터, 답변/초안/Bridge 전체 원문 데이터
- 승인된 public mirror 정책을 넘어서는 private development/deploy 세부 정보

Frontend는 민감한 flow 원문 데이터를 Web Storage에 저장하지 않는 방향으로 설계되어
있습니다. SCN-001 protected actions는 backend verification 이후에만 수행됩니다.

## 개발 과정 및 commit 기록 안내

개발 과정과 commit 기록은 현재 private organization에서 관리 중이며, 공개 전환
이후 아래 organization에서 확인할 수 있도록 연결할 예정입니다.

- https://github.com/2026-moel-datacontest-core

이 README에는 private repository 이름, cloud project identifier, runtime URL,
credential, deployment identity, infrastructure state, secret value를 공개하지
않습니다.

## 로컬 실행

Backend:

```bash
conda activate law_main_road
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- backend: `http://localhost:8000`
- frontend: `http://localhost:5090`

Environment templates:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

## 검증

Focused checks:

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
cd frontend
npm run build
```

Demo preflight:

```bash
bash scripts/demo_preflight.sh
```

Broad retrieval/answer eval은 retrieval, answer generation, embedding behavior,
DB contents, API response contract가 변경된 경우에만 별도로 수행합니다.

## 참고

법대로(LawMainRoad)는 법률 정보를 정리하고 관련 근거를 확인하는 데 도움을 주는
MVP입니다. 결과는 법률 자문이나 행정기관의 판단을 대체하지 않으며, 실제 신고,
상담, 소송, 체류 관련 결정에는 관련 기관 또는 전문가 확인이 필요합니다.
