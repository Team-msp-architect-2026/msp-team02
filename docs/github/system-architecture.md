# 시스템 아키텍처

기준일: `2026-05-13`

이 문서는 법대로(LawMainRoad)의 public-safe short architecture reference입니다.
더 자세한 architecture notes의 publish source는 GitHub Wiki입니다.

## 기술 스택

| 계층 | 선택 |
|---|---|
| Backend | FastAPI |
| Database | PostgreSQL + pgvector |
| Auth | Firebase Auth Google Sign-In + Firebase Admin SDK verification |
| LLM | Vertex AI Gemini |
| Embedding | `gemini-embedding-001`, 768 dimensions |
| Frontend | Next.js App Router, React, TypeScript |
| Local environment | WSL Ubuntu + conda |
| Public demo host | `https://www.law-main-road.cloud` |

## High-level Flow

```text
Legal source submodule
  -> preprocessing / chunking scripts
  -> backend/data/law_chunks/all_chunks.json
  -> PostgreSQL law_chunks + pgvector embeddings
  -> retrieval
  -> grounded answer
  -> optional document draft
  -> Next.js frontend
```

## Backend

FastAPI backend는 public RAG/draft APIs, protected SCN-001 APIs, 그리고
`/api/v1/before`에 mounted된 Before sub-application을 제공합니다.

핵심 책임:

- PostgreSQL + pgvector 기반 law corpus retrieval
- citation constraints를 지키는 grounded answer generation
- request-provided legal basis 기반 SCN-004 document draft generation
- protected SCN-001 actions를 위한 Firebase-backed backend auth verification
- MVP soft-delete visibility를 포함한 SCN-001 Bridge/history/deletion paths

Router-level surfaces / 라우터 표면:

- public retrieval, answer, document draft APIs
- auth status API
- mounted Before review와 accessibility APIs
- protected SCN-001 Before history, Bridge run, Bridge answer, soft-delete APIs

## 데이터베이스 모델

현재 tables:

- `law_chunks`
- `before_review_jobs`
- `after_artifact_runs`
- `users`
- `bridge_runs`

SCN-001 history는 MVP soft-delete를 위해 user visibility fields를 사용합니다.
이는 hard delete나 file purge를 열지 않고 user-facing list에서 기록을 숨깁니다.

## Frontend

구현 routes:

- `/`
- `/before`
- `/after`
- `/after/result`
- `/after/intake`
- `/after/draft`
- `/history`

High-level frontend responsibilities / frontend 주요 책임:

- Firebase sign-in state와 backend `/api/v1/auth/me` verification
- in-memory After/Bridge/draft flow state
- SCN-004 login-free answer와 document draft flow
- SCN-001 protected Before/Bridge/history UI
- presentation stability를 위한 fixed preset과 frozen draft behavior

현재 visual baseline:

- `DESIGN.md`가 visual guide입니다.
- Components는 local `--kl-*` token surface를 사용합니다.
- 최신 visual polish는 frontend/docs-only 작업이며 backend schema, auth
  persistence, Web Storage policy, public API contracts를 변경하지 않습니다.

Visual/UI state / 화면 상태:

- Before first screen은 upload-focused입니다.
- After entry는 guidance/disclaimer를 보이는 상태로 유지하고 preset labels를 정리했습니다.
- History는 centered folded incident cards를 사용합니다.
- Accessibility recommendation UI는 hardcoded default legal basis를 더 이상 사용하지 않습니다.

## Auth Boundary / 인증 경계

SCN-001 protected paths는 다음 흐름을 사용합니다.

```text
Firebase Web SDK
  -> Firebase ID token
  -> Authorization: Bearer <id token>
  -> backend Firebase Admin verification
  -> backend-owned project account linkage
```

Frontend gates는 backend-verified `backendUser.logged_in`을 기준으로 동작합니다.
Firebase signed-in state만으로는 protected SCN-001 actions에 충분하지 않습니다.

## Privacy Boundary / 개인정보 경계

앱은 민감한 raw payload를 Web Storage에 저장하지 않습니다.

- raw user statement
- full answer payload
- full draft payload
- case intake
- raw Bridge payload
- raw `after_query_seed`
- auth tokens or provider ids

SCN-001 Bridge context는 safe summary로만 표시되고 사용됩니다. Bridge는 사건
맥락 연결/참고용이며, legal citations, grounded context ids, retrieved chunks를
새로 만들거나 수정하지 않습니다.

## Cloud Posture

- Latest code/runtime checkpoint: `b013429`
- Phase 7A `www.law-main-road.cloud` public domain launch is complete.
- Phase 7B private GCS artifact storage + operations dashboard is documented as
  an optional hardening candidate only.
- Runtime GCS artifact writer activation, artifact retrieval UI, root apex,
  `api.*`, same-origin `/api/**`, HTTPS Load Balancer, Cloud Armor, and prod
  opening remain not opened.
