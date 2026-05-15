# API Reference / API 참조

기준일: `2026-05-13`

이 문서는 법대로(LawMainRoad)의 public-safe short API reference입니다. 상세 API
notes의 publish source는 GitHub Wiki입니다.

현재 구현 요약이며 formal OpenAPI replacement가 아닙니다.

## Public Health

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | service status 확인 |
| `GET` | `/health` | health check |

## Public RAG / Draft

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/retrieve` | none | law chunks retrieval |
| `POST` | `/api/v1/answer` | none | grounded answer generation |
| `POST` | `/api/v1/documents/draft` | none | SCN-004 document draft generation |

`/api/v1/answer` request:

```json
{
  "query": "string",
  "top_k": 5,
  "ef_search": 100
}
```

`/api/v1/documents/draft`가 받는 주요 입력:

- `case_intake`
- answer-derived `legal_basis`

draft service는 retrieval이나 answer generation을 직접 실행하지 않습니다. request로
전달된 legal basis만 사용합니다.

## Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/auth/me` | optional Bearer Firebase ID token | backend auth status 확인 |

Protected SCN-001 calls는 다음 header를 요구합니다.

```http
Authorization: Bearer <Firebase ID token>
```

## Before Sub-app

`/api/v1/before`에 mounted되어 있습니다.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/before/review` | none | legacy/direct review path |
| `POST` | `/api/v1/before/review/jobs` | optional | async Before review job 생성 |
| `GET` | `/api/v1/before/review/jobs/{job_id}` | none | Before review job polling |
| `POST` | `/api/v1/before/accessibility/recommendations` | none | accessibility recommendation |
| `GET` | `/api/v1/before/health` | none | Before sub-app health 확인 |

Before job 생성 시 valid Firebase bearer token이 있으면 해당 job은 signed-in
project account relationship에 연결됩니다. auth가 없으면 anonymous로 유지되고,
invalid auth는 401을 반환합니다.

`GET /api/v1/before/review/jobs/{job_id}`의 `none` auth label은 의도된 public
polling contract입니다. signed-in user-owned Before history 조회는 protected
`/api/v1/scn001/before-review-jobs...` 경로를 사용합니다.

## SCN-001 Protected APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/scn001/before-review-jobs` | protected Before history 목록 |
| `GET` | `/api/v1/scn001/before-review-jobs/{before_review_job_id}` | protected Before history detail 조회 |
| `DELETE` | `/api/v1/scn001/before-review-jobs/{before_review_job_id}` | Before record MVP soft-delete |
| `POST` | `/api/v1/scn001/bridge-runs` | completed Before job에서 Bridge run 생성 |
| `GET` | `/api/v1/scn001/bridge-runs` | protected Bridge history 목록 |
| `GET` | `/api/v1/scn001/bridge-runs/{bridge_run_id}` | protected Bridge run 조회 |
| `DELETE` | `/api/v1/scn001/bridge-runs/{bridge_run_id}` | Bridge record MVP soft-delete |
| `POST` | `/api/v1/scn001/bridge-runs/{bridge_run_id}/answer` | protected Bridge-origin answer 생성 |

Protected Bridge answer는 `AnswerResponse`-compatible response를 반환하고,
project-local account relationship과 one primary Bridge source reference를
저장합니다.

존재하지 않거나 소유하지 않은 Bridge records는 not found로 masked됩니다.

## Contract Boundaries

변경하지 않은 public contracts:

- `/api/v1/answer`
- `/api/v1/documents/draft`

미구현 / 미오픈(NOT opened):

- `/api/v1/history` unified API
- protected SCN-001 draft endpoint
- hard-delete or artifact purge API
