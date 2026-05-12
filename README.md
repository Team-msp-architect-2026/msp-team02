# 법대로(LawMainRoad)

법대로(LawMainRoad)는 외국인 근로자와 취약 노동자가 근로계약, 임금체불,
부당해고, 사업장 변경 같은 노동 문제를 한국 노동법 근거와 함께 정리할 수
있도록 돕는 AI 지원 MVP입니다.

**공개 데모:** https://www.law-main-road.cloud

이 MVP는 법률 정보를 정리하고 관련 근거를 확인하는 데 도움을 주는 도구이며,
법률 자문이나 행정기관의 판단을 대체하지 않습니다.

이 공개 저장소는 공모전 제출과 공개 검토를 위한 정리본입니다.
개발과 배포의 기준 저장소는 접근 권한이 필요한
[`2026-moel-datacontest-core/law_main_road_main`](https://github.com/2026-moel-datacontest-core/law_main_road_main)
입니다(reviewer access required). 이 공개 저장소는 배포 권한이나 WIF 배포 권한을
갖지 않습니다.

## 빠른 심사 흐름

5분 안에 확인할 수 있는 public demo 흐름:

1. https://www.law-main-road.cloud 를 엽니다.
2. `/after`로 이동하거나 메인 화면의 법률 상담 흐름을 선택합니다.
3. 예시 사례에서 `임금체불·부당해고 상담`을 선택하고 제출합니다.
4. `/after/result`에서 검색 근거, 인용 조문, 주의사항을 확인합니다.
5. 지원되는 문서 유형을 선택해 `/after/intake`로 이동합니다.
6. 필요한 사실관계를 입력한 뒤 `/after/draft`에서 초안, 누락 항목, 증거 체크리스트, copy/print 동작을 확인합니다.

선택 확인 흐름:

- Google login 후 `/before`에서 계약서 검토 결과를 법률 상담에 연결하는 흐름을 확인합니다.
- `/history`에서 서버 인증이 확인된 사용자의 사건 기록 카드와 기록 삭제 동작을 확인합니다.

## 공개 문서

상세 문서는 GitHub Wiki를 canonical 공개 문서로 사용합니다. 이 README는 심사자가
5분 안에 프로젝트 목적, 구현 범위, cloud migration 상태, 실행/검증 경계, 보안과
개인정보 원칙을 빠르게 확인하기 위한 landing 문서입니다.

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

기준일: `2026-05-12`

- 로그인 없이 사용할 수 있는 AI 법률 상담과 문서 초안 흐름
- 로그인 사용자용 계약서 검토, 사건 기록, 상담 연결 흐름
- 사건 기록 보관함과 기록 삭제(목록에서 숨김)
- `사업장 변경 사유 정리서 초안` 고정 예시 흐름
- Firebase Auth Google Sign-In + backend verification
- PostgreSQL + pgvector 기반 법령 검색
- Vertex AI Gemini 기반 answer/OCR/embedding 연동
- 개발 환경 우선 runtime smoke와 Phase 7A public `www.law-main-road.cloud` launch 완료
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

- AI 법률 상담: `/after -> /after/result -> /after/intake -> /after/draft`
- 계약서 검토 연결: 계약서 검토 -> 상담 맥락 연결 -> AI 법률 상담 답변
- 사건 기록: 서버 인증이 확인된 사용자의 기록 보관함과 기록 삭제

## 아키텍처 요약

Runtime:

```text
User
  -> Next.js frontend
  -> FastAPI backend
  -> PostgreSQL + pgvector retrieval
  -> Vertex AI Gemini answer / OCR / embedding
  -> grounded answer or supported draft
```

Data pipeline:

```text
legalize-kr source data
  -> preprocessing / chunking pipeline
  -> 1722 law chunks
  -> PostgreSQL law_chunks + pgvector embeddings
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

| Endpoint area | Auth | Purpose | Demo use |
|---|---|---|---|
| `/api/v1/retrieve` | none | law chunk retrieval | live/free-input answer paths |
| `/api/v1/answer` | none | grounded legal answer | 상담 질문 답변, 선택 해제된 계약서 연결 fallback |
| `/api/v1/documents/draft` | none | supported draft generation | 지원되는 임금체불/부당해고 초안 흐름 |
| `/api/v1/auth/me` | optional Firebase bearer | backend auth status | protected UI gate |
| `/api/v1/scn001/bridge-runs` | Firebase bearer | protected context-link creation | 계약서 검토 결과를 상담에 연결 |
| `/api/v1/scn001/before-review-jobs` | Firebase bearer | protected contract-review history | `/before`, `/history` |

AI 법률 상담 흐름은 login-free demo를 유지합니다. 계약서 검토와 사건 기록 같은
보호 기능은 서버 인증이 확인된 로그인 상태를 요구합니다. 계약서 검토 결과는 상담
맥락을 이어 주는 참고 정보이며, 법적 근거(legal grounding)가 아닙니다.

## 데모 / 클라우드 상태

클라우드 전환은 개발 환경에서 먼저 검증한 뒤 공개 데모 운영으로 확장하는 방식을
사용합니다.

- `dev`: 첫 cloud target과 smoke-test 환경
- `demo/contest`: dev smoke 이후 기간 한정 공개 데모 운영 상태
- `prod`: 별도 production-opening review 전까지 미오픈(NOT opened)

완료된 공개 제출 상태:

- 개발 환경 우선 backend/frontend runtime smoke 완료
- Phase 7A custom domain launch 완료: `https://www.law-main-road.cloud`
- Firebase Auth Authorized Domains와 backend CORS는 `www` host 기준 검증 완료
- public frontend URL은 의도적으로 공개하고, backend direct runtime URL과 내부 cloud inventory는 공개하지 않음

의도적으로 열지 않은 cloud hardening:

- root apex `law-main-road.cloud`
- `api.law-main-road.cloud`
- same-origin `/api/**` rewrite
- HTTPS Load Balancer
- Cloud Armor
- production opening

이 저장소와 공개 문서는 장기 운영 서비스가 준비됐다는 주장으로 읽히지 않습니다.
공모전 제출과 공개 검토를 위한 데모 운영 상태, 구현 범위, 미오픈 범위를 구분해
설명합니다.

이 공개 저장소는 제출용 정리본이며 배포 기준 저장소가 아닙니다. cloud migration과
public mirror 정책의 상세 내용은
[Cloud-Migration-and-Public-Mirror-Policy](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy)를
따릅니다.

## 미오픈 범위

다음 항목은 현재 공개 구현 범위에서 미오픈(NOT opened) 상태입니다.

- 계약서 검토 기반 초안 생성을 backend live service로 제공하는 기능
- 계약서 검토 기반 초안 생성 전용 보호 API
- 독립 상담 연결 화면(`/bridge`)
- Recovery
- 추가 문서/상담 시나리오
- full retention lifecycle
- hard delete, artifact purge, account deletion, undo/restore
- 운영 배포 주장

`사업장 변경 사유 정리서 초안` 예시는 화면에서 제공하는 고정 템플릿 흐름입니다.
backend live draft generation이나 전용 보호 API가 열렸다는 의미가 아닙니다.

## 보안과 개인정보 경계

공개 문서와 공개 저장소에는 다음 정보를 포함하지 않습니다.

- 인증 비밀값, local env values, cloud secret values
- infrastructure state files 또는 cloud IAM key files
- cloud project identifier, private/backend runtime URL, private cloud inventory
- 인증 provider의 개인 식별자, 이메일 값, database account identifier
- 사건 원문 데이터, 답변/초안/상담 연결 전체 원문 데이터
- 승인된 공개 저장소 정책을 넘어서는 private development/deploy 세부 정보

Frontend는 민감한 flow 원문 데이터를 Web Storage에 저장하지 않는 방향으로 설계되어
있습니다. 보호 기능은 backend verification 이후에만 수행됩니다.

## 개발 과정 및 commit 기록 안내

개발과 배포 자동화 기준은 access-controlled source/deploy repo
[`2026-moel-datacontest-core/law_main_road_main`](https://github.com/2026-moel-datacontest-core/law_main_road_main)
에서 관리합니다(reviewer access required). 이 공개 저장소는 제출용 README/Wiki와
공개 가능한 snapshot surface입니다. 이 저장소에는 WIF 배포 권한, service account
key JSON, infrastructure state, private runtime URL, credential, secret value를
두지 않습니다.

## 로컬 실행

아래 명령은 source/deploy codebase를 checkout한 reviewer/developer 환경에서
사용하는 공개 가능한 실행 요약입니다. source/deploy repo 접근이 필요한 경우
reviewer access를 별도로 받아야 합니다. 이 공개 저장소 clone은 docs/submission
surface이며, runnable source tree, credentials, private runtime inventory를
포함하지 않을 수 있습니다.

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

- `backend/.env.example`
- `frontend/.env.example`

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

Expected focused-check signals:

- backend import smoke prints `import_ok`
- document draft checker exits successfully
- frontend build completes without TypeScript/build errors
- live Vertex/OCR checks require configured credentials and are not required for doc-only changes

## 참고

법대로(LawMainRoad)는 법률 정보를 정리하고 관련 근거를 확인하는 데 도움을 주는
MVP입니다. 결과는 법률 자문이나 행정기관의 판단을 대체하지 않으며, 실제 신고,
상담, 소송, 체류 관련 결정에는 관련 기관 또는 전문가 확인이 필요합니다.
