# 사용자 흐름

기준일: `2026-05-13`

## SCN-004 After Document Draft

SCN-004는 현재 main login-free demo path입니다.

```text
/after
  -> /after/result
  -> /after/intake
  -> /after/draft
```

동작:

- 사용자는 dispute statement를 직접 입력하거나 `SCN-004-DEMO-FREEZE`를 선택합니다.
- entry screen은 centered layout이며 guidance cards와 restored disclaimer를 표시합니다.
- exact preset은 frontend fixed answer fixture를 사용합니다.
- modified preset은 `/api/v1/answer`를 `top_k=10`으로 호출합니다.
- free input은 `/api/v1/answer`를 `top_k=5`로 호출합니다.
- 두 live path 모두 `ef_search=100`을 사용합니다.
- draft flow는 citations와 grounded context ids가 있을 때만 열립니다.

Draft types / 초안 유형:

- 고용노동청 임금체불 진정서 초안
- 노동위원회 부당해고 구제신청 이유서 초안

Draft screen에 표시되는 항목:

- rendered text
- missing fields
- cautions
- evidence checklist
- cited articles
- source context ids
- copy
- browser print

## SCN-001 Before -> Bridge -> After

이 경로는 backend-verified login을 요구합니다.

```text
/before
  -> Before review job
  -> protected bridge run
  -> /after Bridge handoff
  -> protected Bridge answer
  -> /after/result answer-only
```

동작:

- `/before` actual analysis requires backend-verified auth.
- completed Before job은 protected Bridge run을 만들 수 있습니다.
- Bridge handoff state는 React memory에만 있습니다.
- checked Bridge context는 다음 endpoint를 호출합니다.
  `POST /api/v1/scn001/bridge-runs/{bridge_run_id}/answer`
- all-unchecked Bridge context는 public `/api/v1/answer`를 호출하지만 결과는
  Bridge-origin answer-only로 유지됩니다.
- Bridge는 사건 맥락 연결/참고용이며, 법적 근거(legal grounding)가 아닙니다.

## Saved History

Backend-verified logged-in users는 다음 기능을 사용할 수 있습니다.

- `/after` saved history selector
- `/history` record archive

History 동작:

- incident-centered cards
- centered folded layout with blue left accent
- user-facing Korean summaries
- confirmed issues
- candidate legal references
- recommended next steps
- After question connection
- Before/Bridge records의 MVP soft-delete

UI는 raw Bridge payloads, raw `after_query_seed`, auth-provider subject
identifiers, email values, tokens, full answer body, artifact body, real bridge
id를 노출하지 않습니다.

## SCN-001 Fixed-preset Frozen Draft

exact `SCN-001-BRIDGE-DEMO` preset은 frontend-local frozen draft를 지원합니다.

```text
/after
  -> /after/result
  -> /after/intake
  -> /after/draft
```

Document type / 문서 유형:

- `workplace_change_reason_summary`
- 사업장 변경 사유 정리서 초안

경계:

- backend draft endpoint call 없음
- LLM call 없음
- `/api/v1/documents/draft` call 없음
- live/backend SCN-001 draft generation은 미오픈(NOT opened)

## Out-of-scope Flows / 범위 밖 흐름

- independent `/bridge`
- Recovery
- SCN-005 document draft
- production retention lifecycle
- hard delete and artifact file purge
- `/api/v1/history` unified backend API
- live/backend SCN-001 draft generation과 protected SCN-001 draft endpoint
