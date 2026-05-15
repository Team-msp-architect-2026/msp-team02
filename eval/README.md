# Eval Dataset

현재 저장소의 MVP용 법령 RAG를 검증하기 위한 eval 자산 모음이다.

## Files

- `mvp_in_scope_eval_v1.json`: 현재 `backend/data/law_chunks/all_chunks.json` 범위 안에서만 답할 수 있는 baseline 60문항 eval 셋
- `mvp_draft_supported_queries_v1.json`: 2026-05-02 기준 After
  result/intake/draft QA에서 draft CTA를 열 수 있는 MVP query allow-list
- `scenario_demo_question_sets_v1.json`: `SCN-001`, `SCN-004`, `SCN-005` 데모용 retrieval/answer smoke 질문 세트
- `run_retrieval_eval.py`: retrieval service 기준 `hit@1`, `hit@3`, `hit@5`를 계산하는 runner
- `run_answer_eval.py`: grounded answer의 schema / citation grounding / expected point coverage를 계산하는 runner
- `run_answer_evidence_report.py`: live answer output을 문항별 evidence record로 남기는 runner

## Source Scope

- source chunk file: `backend/data/law_chunks/all_chunks.json`
- selected_as_of in current chunk file: `2026-04-11`
- current live chunk count: `1722`
- baseline eval covered law groups:
  - `근로기준법`
  - `최저임금법`
  - `근로자퇴직급여보장법`
  - `남녀고용평등과일ㆍ가정양립지원에관한법률`
  - `산업안전보건법`
  - `산업재해보상보험법`
  - `외국인근로자의고용등에관한법률`
  - `중대재해처벌등에관한법률`

## Item Schema

### `mvp_in_scope_eval_v1.json`

- `id`: 안정적인 문항 ID
- `bucket`: 상위 평가 영역
- `topic`: 세부 주제
- `question_type`: `direct_lookup` / `scenario_single` / `scenario_multi`
- `difficulty`: `easy` / `medium` / `hard`
- `question`: 실제 사용자 질문 형태
- `gold_citations`: 정답으로 간주할 citation label 목록
- `primary_citation`: 대표 citation label
- `expected_points`: 답변에 포함되어야 하는 핵심 포인트
- `confusable_citations`: retrieval 시 혼동하기 쉬운 조문

### `scenario_demo_question_sets_v1.json`

- `scenario_id`: 시나리오 ID (`SCN-001`, `SCN-004`, `SCN-005`)
- `scenario_type`: `Full` / `After`
- `coverage_status`: 현재 corpus 기준 커버 판정
- `demo_operation_note`: 데모 운영 시 주의 메모
- `questions[*].id`: 질문 ID
- `questions[*].phase`: `before` / `after` / `full`
- `questions[*].label`: 질문 역할 식별자
- `questions[*].stability`: 현재 retrieval/answer 기준 권장 안정성
- `questions[*].recommended_top_k`: smoke 시 권장 `top_k`
- `questions[*].question`: 실제 데모 질문 문안
- `questions[*].expected_citations`: 우선 surface되길 기대하는 citation 목록
- `questions[*].expected_points`: 답변 핵심 포인트
- `questions[*].demo_note`: 운영 메모

### `mvp_draft_supported_queries_v1.json`

- `version`: draft-supported allow-list version
- `purpose`: After result/intake/draft QA에서 문서 초안 CTA가 열려야 하는
  query 범위
- `generated_from`: `mvp_in_scope_eval_v1.json`, frontend document draft catalog,
  scenario preset source
- `policy`: backend contract, document type, SCN-001 live/backend draft 여부에
  대한 guard flag
- `draft_supported_query_ids.mvp_in_scope_eval`: draft-supported KLS eval ids
- `draft_supported_query_ids.frontend_fixed_presets`: frontend fixed preset ids
- `supported_documents[*]`: 문서 타입, route flow, required signals, intake
  fields, 해당 query 목록

## Draft-supported Query Scope (2026-05-02)

현재 draft-supported source of truth는
`eval/mvp_draft_supported_queries_v1.json`이다. 이 파일은 answer quality
baseline을 대체하지 않고, After result/intake/draft QA에서 어떤 query가 문서
초안 CTA를 열 수 있는지 고정한다.

지원 범위:

- 부당해고 구제신청 이유서:
  `KLS-EVAL-003`, `KLS-EVAL-004`, `KLS-EVAL-005`
- 임금체불 진정서:
  `KLS-EVAL-006`, `KLS-EVAL-007`, `KLS-EVAL-012`, `KLS-EVAL-014`,
  `KLS-EVAL-021`
- SCN-001: `SCN-001-BRIDGE-DEMO` exact fixed preset만
  `workplace_change_reason_summary` / 사업장 변경 사유 정리서 초안으로 이어진다.

Answer-only 범위:

- `mvp_in_scope_eval_v1.json`의 나머지 KLS 52개는 answer-only다.
- SCN-001 유사 질문, 수정 질문, live path, Bridge-origin modified path는
  answer-only다.
- answer-only path는 상담 답변, 핵심 포인트, 주의사항, 인용 근거만 제공하고
  draft CTA를 열지 않는다.

Guard / boundary:

- public `POST /api/v1/answer` contract unchanged.
- public `POST /api/v1/documents/draft` contract unchanged.
- 새 backend document type 없음.
- SCN-001 live/backend document draft generation 없음.
- raw payload나 auth/token state를 Web Storage에 저장하지 않음.
- Bridge continuity는 legal grounding이 아니다. Bridge 때문에 `legal_basis`,
  `cited_articles`, `source_context_ids`, `grounded_context_ids`,
  `retrieved_chunks`를 생성하거나 수정하지 않는다.
- `SCN-004-DEMO-FREEZE` fixed/freeze path는 유지한다.

## Intended Use

1. retrieval 평가:
   - `mvp_in_scope_eval_v1.json` 기준으로 `gold_citations`가 top-k 안에 들어오는지 확인
2. answer 평가:
   - 답변이 `expected_points`를 충족하는지 확인
   - `gold_citations` 밖 조문을 임의 인용하지 않았는지 확인
3. 데모 smoke:
   - `scenario_demo_question_sets_v1.json`의 질문을 시나리오별 retrieval/answer smoke에 재사용
4. regression 평가:
   - 같은 질문을 반복 실행해 retrieval/citation 안정성 확인
5. document draft QA:
   - document draft 자체는 `backend/verify/check_document_draft.py`를 기준으로 확인
   - RAG service를 수정하지 않은 문서 초안/frontend 작업에서는 full 60 eval을 기본 재실행하지 않음

## Aggregate Metrics vs Item Evidence

`run_retrieval_eval.py`와 `run_answer_eval.py`의 baseline 수치는 전체 회귀 여부를 빠르게 보기 위한 집계 지표다. 예를 들어 `hit@5=60/60`, `gold_citation_hit=60/60`, `expected_point_strict_coverage=137/153`은 전체 상태를 보여주지만, 특정 문항이 왜 OK / partial / fail인지 설명하지 않는다.

문항별 OK 판단은 exact answer text를 고정하지 않는다. live LLM 문장 표현과 citation ordering은 바뀔 수 있으므로 아래 evidence를 기준으로 본다.

- expected/gold citation이 retrieval 결과와 answer `cited_articles`에 들어왔는지
- `expected_points`가 answer / key_points 안에서 충분히 covered 됐는지
- answer에 명시된 조문 언급이 retrieved + grounded context 밖으로 벗어나지 않았는지
- raw cited context ids와 grounded context ids가 retrieved context ids 안에서 유효한지

이 기준은 "정답 문장을 그대로 재현했다"가 아니라 "검색된 근거 안에서 OK라고 판단할 수 있는 이유가 남아 있다"는 의미다.

## Answer Evidence Report

문항별 evidence가 필요할 때는 `run_answer_evidence_report.py`를 사용한다. 기본 dataset은 `mvp_in_scope_eval_v1.json`이며, 기본 출력은 JSONL이다. 진행 로그와 summary는 stderr로 출력되고, JSONL/Markdown report는 stdout 또는 `--output` 파일로 쓴다.

MVP eval 제한 실행:

```bash
python eval/run_answer_evidence_report.py --ids KLS-EVAL-001 KLS-EVAL-004 --top-k 5 --ef-search 100
```

Scenario smoke dataset 제한 실행:

```bash
python eval/run_answer_evidence_report.py \
  --dataset eval/scenario_demo_question_sets_v1.json \
  --scenario-format \
  --ids SCN-001-Q3 SCN-004-Q1 \
  --ef-search 100
```

`--scenario-format`에서는 `--top-k`를 생략하면 각 question의 `recommended_top_k`를 사용한다. SCN demo smoke 질문은 보통 `top_k=10`, `ef_search=100` 기준이다.

Markdown report 예:

```bash
python eval/run_answer_evidence_report.py \
  --ids KLS-EVAL-001 KLS-EVAL-004 \
  --top-k 5 \
  --ef-search 100 \
  --format markdown \
  --output eval/answer_evidence_sample.md
```

주요 출력 필드:

- `id`, `question`
- `expected_citations`: MVP에서는 `gold_citations`, scenario format에서는 `expected_citations`
- `retrieved_top_citation_labels`
- `answer_cited_articles`
- `retrieved_expected_citation_hit`, `answer_expected_citation_hit`
- `expected_point_coverage.covered_points`, `expected_point_coverage.missing_points`
- `grounded_citation_violation`, `citation_violations`
- `raw_cited_context_ids_valid`, `grounded_context_ids_valid`
- `final_verdict`: `PASS` / `PARTIAL` / `FAIL`
- `verdict_reason`
- `answer_preview`: 짧은 preview만 포함하며 exact answer 전체를 고정하지 않음

Verdict 기준:

- `PASS`: expected citation이 answer citations에 hit되고, expected points가 모두 covered이며, citation grounding / context id 검사가 clean
- `PARTIAL`: citation과 grounding은 clean하지만 expected point 일부가 missing
- `FAIL`: timeout/provider/schema 오류, citation 없음, raw/grounded context id invalid, grounded citation violation, 또는 answer expected citation miss

기본 exit code는 evidence 생성을 우선해 verdict와 무관하게 `0`이다. CI나 수동 회귀 검증에서 실패 verdict를 exit code로 보고 싶으면 `--fail-on-verdict fail` 또는 `--fail-on-verdict partial`을 사용한다.

## Current Retrieval Baseline (2026-04-13)

실행 명령:

```bash
python eval/run_retrieval_eval.py --top-k 5 --ef-search 100 --show-failures 10
```

측정 결과:

- `items = 60`
- `hit@1 = 51/60 (85.00%)`
- `hit@3 = 59/60 (98.33%)`
- `hit@5 = 60/60 (100.00%)`

breakdown:

- `direct_lookup`: `hit@1 2/4`, `hit@3 4/4`, `hit@5 4/4`
- `scenario_multi`: `hit@1 13/14`, `hit@3 14/14`, `hit@5 14/14`
- `scenario_single`: `hit@1 36/42`, `hit@3 41/42`, `hit@5 42/42`

note:

- 초기 실행에서 `KLS-EVAL-019`가 top-5 miss였음
- query embedding 단계의 법률용어 hint normalization 보강 후 `hit@5_failures = 0`

## Current Answer Baseline (2026-04-16)

실행 명령:

```bash
python eval/run_answer_eval.py --top-k 5 --ef-search 100 --limit 60 --show-failures 20
```

측정 결과:

- `items_answered = 60/60`
- `JSON/schema failure = 0`
- `timed_out_ids = []`
- `citation_grounding_clean = 60/60`
- `gold_citation_hit = 60/60`
- `expected_point_strict_coverage = 137/153`
- `failures_or_partial_coverage = 16`

현재 RAG refinement는 landing 완료 상태다. 다음 작업이 frontend/document draft QA만 건드리는 경우, 이 baseline은 재실행보다 회귀 의심 시 재검증 대상으로 본다.

## Current Answer Evidence Report (2026-04-20)

full 60 문항에 대해 live answer evidence report를 실행해 제출 전 QA 근거를 남겼다.

실행 명령:

```bash
python eval/run_answer_evidence_report.py --top-k 5 --ef-search 100 --limit 60 --output eval/reports/answer_evidence_2026-04-20.jsonl
```

산출물:

- summary: `eval/reports/answer_evidence_2026-04-20.summary.md`
- JSONL: `eval/reports/answer_evidence_2026-04-20.jsonl`

결과:

- PASS: 44
- PARTIAL: 16
- FAIL: 0
- expected point coverage: `135/153`
- citation grounding violation: `0`
- invalid raw / grounded context id: `0`
- timeout / provider / schema error: `0`

이 report는 aggregate metric을 대체하는 exact answer fixture가 아니다. `run_answer_eval.py`의 aggregate metric은 전체 회귀 여부를 빠르게 보는 수치이고, evidence report는 각 문항이 왜 `PASS` / `PARTIAL` / `FAIL`인지 설명하는 item-level QA 근거다.

판단 기준 요약:

- `PASS`: expected citation hit, expected point coverage, citation grounding, context id validity가 모두 clean
- `PARTIAL`: citation / retrieval / grounding은 clean하지만 expected point 일부가 missing
- `FAIL`: citation miss, context id invalid, grounding violation, timeout/provider/schema 오류 등 근거 신뢰성 문제가 있음

이번 `PARTIAL` 16건은 citation/retrieval failure가 아니라 expected point 일부 누락이다. 주된 missing 유형은 법정 예외, 숫자/기간/상한, 보조 절차 의무 등이다.

MVP 기준에서는 acceptable로 본다. 이유는 `FAIL=0`, expected citation hit clean, citation grounding violation `0`, invalid context id `0`, timeout/provider/schema error `0`이기 때문이다. 남은 `PARTIAL`은 후속 answer quality tuning 후보이며, SCN-004 demo freeze나 presentation fixed fixture의 blocker로 보지 않는다.

후속 튜닝은 다음 순서로 검토한다.

1. `PARTIAL` 16건을 법정 예외, 숫자/기간/상한, 보조 절차 의무, 복수 쟁점 답변 누락으로 분류한다.
2. answer prompt / answer planning 단계에서 main rule, exception, deadline/amount, next action을 더 안정적으로 포함할 수 있는지 검토한다.
3. expected point matcher가 의미상 맞는 답변을 과소평가한 항목과 실제 답변 누락 항목을 분리한다.
4. retrieval / citation / grounding clean 상태를 유지하면서 expected point coverage 개선만 별도 패치로 진행한다.
5. 변경 후 full 60 evidence report를 재실행해 `FAIL=0` 유지와 `PARTIAL` 감소 여부를 비교한다.

`run_answer_evidence_report.py`는 live LLM/API를 호출하므로 wording과 ordering 변동성이 있다. 따라서 발표 직전 기본 preflight 경로와 분리하고, `scripts/demo_preflight.sh`에는 포함하지 않는다. frontend presentation fixed fixture와도 목적이 다르며, presentation fixture는 데모 안정성을 위한 고정 응답이고 evidence report는 live retrieval / answer 결과의 QA 산출물이다.

## Notes

- 현재 baseline eval 파일은 모두 `in-scope` 질문만 포함한다.
- out-of-scope 거절 평가셋은 별도로 분리하는 것이 좋다.
- 데모용 질문 세트는 baseline scoring dataset이 아니라 scenario smoke / 발표 시연용 자산이다.
- `scenario_demo_question_sets_v1.json`은 retrieval/answer smoke question set이며 frontend presentation preset source of truth가 아니다. presentation-local presets는 `frontend/src/lib/scenarioPresets.ts`, fixed answer fixtures는 `frontend/src/lib/scenarioPresetAnswers.json`에 있으며 eval id와 presentation preset id를 혼용하지 않는다.
- fixed answer fixture는 발표 안정성을 위한 presentation-local fixture이고, live eval evidence report는 현재 retrieval/answer/LLM 결과가 왜 OK / PARTIAL / FAIL인지 남기는 검증 산출물이다. 둘은 source of truth와 목적이 다르다.
- 문항은 실제 현재 chunk label에 맞춰 작성했기 때문에, 청킹을 다시 돌리거나 snapshot이 바뀌면 함께 갱신해야 한다.
- SCN-004 document draft smoke는 `backend/verify/check_document_draft.py`에 있다.
- eval 전체를 document draft 생성으로 자동 연결하지 않는다. 후속 draft 확장은 먼저 문항 또는 scenario에 `draft_candidate` 분류를 부여한 뒤 별도 document type / template 작업으로 진행한다.
- draft candidate 후보 분류:
  - `none`
  - `existing_scn004_wage_complaint`
  - `existing_scn004_unfair_dismissal_brief`
  - `future_scn001_bridge_summary`
  - `future_scn005_leave_request_or_objection`
  - `future_candidate`
- 현재 단계에서는 eval JSON 60문항을 대량 편집하지 않는다. 필요하면 작은 후속 패치에서 대표 문항 몇 개에만 `draft_candidate` 예시를 먼저 제안한다.
