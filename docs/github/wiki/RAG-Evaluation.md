# RAG 평가

이 문서는 법대로(LawMainRoad)의 RAG 평가 결과를 공개 가능한 수준으로
정리합니다. Headline은 현재 MVP 범위 안에서 답할 수 있는 in-scope 법령
질문 평가를 중심으로 유지합니다.

## In-scope Evaluation Headline

In-scope RAG evaluation passed hard grounding/citation checks.

기준 평가셋은 `eval/mvp_in_scope_eval_v1.json` 60문항이며, 현재 코퍼스
`backend/data/law_chunks/all_chunks.json` 기준으로 검색된 법령 조각과 답변
인용이 일치하는지 확인합니다.

| Check | Result |
|---|---|
| Corpus row count | `1722` |
| `selected_as_of` | `2026-04-11` |
| Retrieval hit@1 | `51/60` |
| Retrieval hit@3 | `59/60` |
| Retrieval hit@5 | `60/60` |
| Answered items | `60/60` |
| Citation grounding | clean in the recorded full answer eval |
| Evidence report | `PASS=44`, `PARTIAL=16`, `FAIL=0` |

`PARTIAL` means citation and grounding checks are clean, while one or more
expected answer points still need answer-side completeness tuning.

The remaining `PARTIAL` cases are answer completeness issues, not citation
grounding failures. They are tracked as answer quality tuning candidates and
are not treated as SCN-004 demo blockers.

## Refusal / Out-of-scope Eval

Refusal/out-of-scope eval runner exists but first live run identified a known
gap.

This is a measurement stabilization result, not passing evidence. The run was
executed after runtime recovery succeeded and the backend, PostgreSQL/pgvector,
corpus rows, embeddings, and Vertex provider path were confirmed usable.

| Field | Value |
|---|---|
| Dataset | `eval/refusal_eval_v1.json` |
| Runner | `python eval/run_refusal_eval.py --top-k 5 --ef-search 100 --output eval/reports/refusal_eval_2026-05-14.recovery-20260514165745.jsonl` |
| Evidence JSONL | `eval/reports/refusal_eval_2026-05-14.recovery-20260514165745.jsonl` |
| Stdout log | `eval/reports/refusal_eval_2026-05-14.recovery-20260514165745.stdout.txt` |
| Items attempted | `15` |
| Items answered | `13` |
| Observed model | `gemini-2.5-flash` |
| Verdicts | `PASS=0`, `PARTIAL=0`, `FAIL=15` |
| Timed out ids | `[]` |
| Error counts | `{'grounded_generation_error': 2}` |

Failure shape:

- `13` items failed with `cited_articles_present_should_be_empty`.
- `2` items failed with `grounded_generation_error`:
  `KLS-REFUSAL-005`, `KLS-REFUSAL-013`.

This is not a retrieval/runtime failure. It is a product behavior gap: current
answer path is citation-first and lacks explicit refusal mode. In out-of-scope
or refusal prompts, the current path can still attach retrieved citations or
reject citation-empty model output as an invalid grounded answer.

Because this is a known gap, refusal score is not used as a public headline
metric for this submission.

## Next Stabilization Slice

The next stabilization slice should separate product behavior from measurement
semantics.

- Add explicit refusal mode for out-of-scope and unsafe/boundary questions.
- Support citation-empty refusal response where no retrieved law should be
  presented as grounding.
- Design a v2 refusal rubric that distinguishes hard refusal, safe redirect,
  irrelevant citation leakage, and harmful/non-responsive answers.
- Add regression tests for citation-empty refusal responses and existing
  in-scope grounded answers.
- Manually review boundary categories such as `harmful_or_evasion`,
  `case_outcome_prediction`, and `ambiguous_factual_temporal`.
