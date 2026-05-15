# API 문서

기준일: `2026-05-13`

현재 구현 요약이며 정식 OpenAPI 문서를 대체하지 않습니다. 일반 사용자에게 보이는
화면 흐름은 [[사용자 흐름|User-Flows]]에 정리하고, 이 문서는 심사자와 개발자가 API
경계를 확인할 수 있도록 기술 용어와 한국어 설명을 함께 둡니다.

## 공개 상태 확인

| Method | Path | 목적 |
|---|---|---|
| `GET` | `/` | 서비스 상태 확인 |
| `GET` | `/health` | health check(상태 확인) |

## 공개 RAG / 문서 초안

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| `POST` | `/api/v1/retrieve` | 없음 | 법령 조각 검색 |
| `POST` | `/api/v1/answer` | 없음 | 법령 근거가 함께 제시되는 답변 생성 |
| `POST` | `/api/v1/documents/draft` | 없음 | 지원되는 문서 초안 생성 |

`/api/v1/answer` request(요청 예시):

```json
{
  "query": "string",
  "top_k": 5,
  "ef_search": 100
}
```

`/api/v1/documents/draft`가 받는 주요 입력:

- `case_intake`
- answer-derived `legal_basis`(답변에서 온 법적 근거 묶음)

문서 초안 서비스는 법령 검색이나 답변 생성을 직접 실행하지 않습니다. 요청으로
전달된 legal basis(법적 근거 묶음)만 사용합니다.

## 인증

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| `GET` | `/api/v1/auth/me` | 선택적 Bearer Firebase ID token | 서버 인증 상태 확인 |

로그인 후 사용할 수 있는 API는 다음 header를 요구합니다.

```http
Authorization: Bearer <Firebase ID token>
```

## 계약서 검토 하위 앱

`/api/v1/before`에 mounted되어 있습니다. 코드 경로명에는 `before`가 남아 있지만,
사용자 화면에서는 계약서 검토 흐름으로 설명합니다.

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| `POST` | `/api/v1/before/review` | 없음 | 기존 직접 계약서 검토 경로 |
| `POST` | `/api/v1/before/review/jobs` | 선택 | 비동기 계약서 검토 작업 생성 |
| `GET` | `/api/v1/before/review/jobs/{job_id}` | 없음 | 계약서 검토 작업 상태 확인 |
| `POST` | `/api/v1/before/accessibility/recommendations` | 없음 | 장애 특성 관련 권고 생성 |
| `GET` | `/api/v1/before/health` | 없음 | 계약서 검토 하위 앱 상태 확인 |

계약서 검토 작업 생성 시 유효한 Firebase bearer token이 있으면 해당 작업은 로그인한
프로젝트 내부 계정에 연결됩니다. 인증 정보가 없으면 익명 작업으로 유지되고, 유효하지
않은 인증 정보는 401을 반환합니다.

`GET /api/v1/before/review/jobs/{job_id}`의 인증 없음 표기는 의도된 공개 상태 확인
계약입니다. 로그인 사용자의 계약서 검토 기록 조회는
`/api/v1/scn001/before-review-jobs...` 경로를 사용합니다.

## 계약서 검토 / 상담 연결 로그인 API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/scn001/before-review-jobs` | 로그인 사용자의 계약서 검토 기록 목록 |
| `GET` | `/api/v1/scn001/before-review-jobs/{before_review_job_id}` | 로그인 사용자의 계약서 검토 기록 상세 조회 |
| `DELETE` | `/api/v1/scn001/before-review-jobs/{before_review_job_id}` | 계약서 검토 기록 삭제(목록에서 숨김) |
| `POST` | `/api/v1/scn001/bridge-runs` | 완료된 계약서 검토 작업에서 상담 연결 기록 생성 |
| `GET` | `/api/v1/scn001/bridge-runs` | 로그인 사용자의 상담 연결 기록 목록 |
| `GET` | `/api/v1/scn001/bridge-runs/{bridge_run_id}` | 로그인 사용자의 상담 연결 기록 조회 |
| `DELETE` | `/api/v1/scn001/bridge-runs/{bridge_run_id}` | 상담 연결 기록 삭제(목록에서 숨김) |
| `POST` | `/api/v1/scn001/bridge-runs/{bridge_run_id}/answer` | 계약서 검토에서 이어진 답변 생성 |

계약서 검토에서 이어진 답변은 `AnswerResponse`와 호환되는 응답을 반환하고,
프로젝트 내부 사용자 계정 연결과 하나의 주요 상담 연결 출처를 저장합니다.

존재하지 않거나 소유하지 않은 상담 연결 기록은 not found로 응답해 소유 여부를
노출하지 않습니다.

## 계약 경계

변경하지 않은 공개 API 계약:

- `/api/v1/answer`
- `/api/v1/documents/draft`

미구현 / 현재 제공하지 않음:

- `/api/v1/history` 통합 API
- 계약서 검토 기반 초안 로그인 API
- 완전 삭제 또는 파일 물리 삭제 API

## 스키마 메모

- Public `RetrievalRequest`와 `AnswerRequest`는 `query`, `top_k`, `ef_search`를
  사용합니다. 여기서 `top_k`는 검색할 법령 조각 수, `ef_search`는 pgvector 검색
  품질 관련 설정입니다. 기본 공개 답변 경로는 `top_k=5`, `ef_search=100`입니다.
- 예시 상담 경로는 `top_k=10`, `ef_search=100`을 명시할 수 있습니다.
- `/api/v1/answer` response에는 답변 본문, 핵심 포인트, 주의사항, 인용 조문,
  근거 context ids, 검색된 법령 조각, 검색 총계, 모델명이 포함됩니다.
- `/api/v1/documents/draft` response에는 초안 본문, 추가 필요 정보, 주의사항,
  증거 체크리스트, 인용 조문, 출처 context ids가 포함됩니다.
- 공개 문서는 schema를 요약합니다. application code나 OpenAPI output을
  대체하지 않습니다.

## 함께 보기

- [[RAG와 법령 코퍼스|RAG-and-Law-Corpus]]
- [[데이터 모델과 개인정보 경계|Data-Model-and-Privacy]]
