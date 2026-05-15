# Answer Evidence Report Summary - 2026-04-20

## Scope

- 기준일: `2026-04-20`
- Dataset: `eval/mvp_in_scope_eval_v1.json`
- Source chunk file: `backend/data/law_chunks/all_chunks.json`
- `selected_as_of`: `2026-04-11`
- Items: `60`
- Parameters: `top_k=5`, `ef_search=100`, `limit=60`
- Command:

```bash
python eval/run_answer_evidence_report.py --top-k 5 --ef-search 100 --limit 60 --output eval/reports/answer_evidence_2026-04-20.jsonl
```

- Output artifact: `eval/reports/answer_evidence_2026-04-20.jsonl`
- Output size: `60` JSONL records, `160029` bytes
- Note: the JSONL report stores per-question evidence and `answer_preview`, not full answer text.

## Report Role

This is a live answer evidence report, not an exact answer fixture. It records why each live answer can be judged `PASS`, `PARTIAL`, or `FAIL` based on citations, expected point coverage, grounding, and context id validity.

It is also separate from frontend presentation fixed fixtures. Presentation fixtures are stored under frontend code for demo stability; this report is an eval artifact from the live retrieval / answer path.

## Verdict Summary

| Verdict | Count |
|---|---:|
| PASS | 44 |
| PARTIAL | 16 |
| FAIL | 0 |

Plain summary:

- PASS: 44
- PARTIAL: 16
- FAIL: 0
- Expected point coverage: `135/153`

Expected point coverage:

- Covered: `135/153`
- Missing: `18/153`

## Safety Checks

| Check | Result |
|---|---|
| Citation grounding violations | `0` |
| Raw cited context id invalid | `0` |
| Grounded context id invalid | `0` |
| Retrieved expected citation miss | `0` |
| Answer expected citation miss | `0` |
| Timeout errors | `0` |
| Provider/schema/runtime errors | `0` |

## Failures

No `FAIL` verdicts.

No citation miss, citation grounding issue, invalid context id, timeout, or provider error was observed in this run.

## Partial Items

All `PARTIAL` verdicts are expected point coverage issues. They are not citation or retrieval failures: citation hit and grounding checks passed for every partial item.

| ID | Coverage | Missing points |
|---|---:|---|
| KLS-EVAL-003 | 1/2 | 일시보상이나 사업 계속 불능 등 법정 예외가 있는 경우만 다를 수 있다 |
| KLS-EVAL-007 | 2/3 | 법령 또는 단체협약상 특별한 규정이 있을 때만 예외가 가능하다 |
| KLS-EVAL-013 | 2/3 | 3년 이상 계속근로자는 2년마다 1일 가산되지만 총 25일 한도가 있다 |
| KLS-EVAL-014 | 1/2 | 최저임금에 미치지 못하는 임금 약정 부분은 무효이고 최저임금과 동일한 임금을 지급하기로 본다 |
| KLS-EVAL-016 | 1/2 | 단순노무업무로 고시된 직종 종사자는 그 예외에서 제외된다 |
| KLS-EVAL-019 | 1/2 | 원칙적으로 사용자는 퇴직급여제도를 설정해야 한다 |
| KLS-EVAL-021 | 2/3 | 55세 이후 퇴직 등 대통령령상 예외가 있으면 현금 지급 예외가 가능하다 |
| KLS-EVAL-027 | 1/3 | 사업주와 근로자는 교육을 받아야 한다<br>교육 내용은 근로자가 자유롭게 열람할 수 있는 장소에 게시하거나 갖추어 두어야 한다 |
| KLS-EVAL-028 | 3/4 | 조사 기간 중 피해근로자 보호를 위해 근무장소 변경, 유급휴가 등 조치를 할 수 있고 의사에 반하면 안 된다 |
| KLS-EVAL-031 | 1/3 | 육아휴직 기간은 원칙적으로 1년 이내이고, 법정 요건에 따라 추가 6개월 예외가 있을 수 있다<br>육아휴직을 이유로 해고나 불리한 처우를 해서는 안 되며, 복귀 시 같은 업무 또는 같은 수준의 임금을 지급하는 직무로 복귀시켜야 한다 |
| KLS-EVAL-038 | 2/3 | 환기·채광·조명·보온·청결 등 작업환경 기준 미준수로 생기는 건강장해도 예방 대상이다 |
| KLS-EVAL-044 | 3/4 | 다만 출퇴근 경로 일탈·중단이 있으면 원칙적으로 제외되며 법정 예외가 있을 수 있다 |
| KLS-EVAL-047 | 2/3 | 1일당 평균임금의 70퍼센트 상당액을 지급한다 |
| KLS-EVAL-050 | 1/2 | 한국산업인력공단에 계약 체결 대행을 맡길 수 있다 |
| KLS-EVAL-053 | 2/3 | 기숙사를 제공하는 경우 건강과 안전을 지킬 수 있어야 한다 |
| KLS-EVAL-054 | 1/2 | 일정 경우 출입국관리법상 신고를 한 것으로 보거나 출입국관서에 통보된다 |

Representative missing point patterns:

- Legal exceptions or exclusions were sometimes omitted even when the main rule was correct.
- Numeric or period-specific details were sometimes omitted, such as leave accrual caps or benefit amounts.
- Secondary procedural duties were sometimes omitted, such as posting training materials or agency/reporting linkage.
- Multi-point scenario questions were more likely to be `PARTIAL` when they required both the main rule and exception/protection detail.

## QA Interpretation

This run supports the current SCN-004 freeze state because answer generation returned valid grounded citations for all 60 MVP eval items and did not produce context id or provider failures.

The remaining weakness is answer-side expected point coverage, not retrieval, citation grounding, or API behavior. No backend API contract, retrieval behavior, answer behavior, frontend presentation preset fixture, or demo preflight script was changed for this report.

## MVP Judgment And Future Tuning

MVP 기준으로는 acceptable로 판단한다. 근거는 `FAIL=0`, expected citation hit clean, citation grounding violation `0`, invalid context id `0`, timeout/provider/schema error `0`이며, 모든 `PARTIAL`은 근거 신뢰성 문제가 아니라 expected point 일부 누락이다.

후속 튜닝은 SCN-004 demo freeze와 분리해서 진행한다. 우선순위는 다음과 같다.

1. PARTIAL 16건을 유형별로 분류한다: 법정 예외, 숫자/기간/상한, 보조 절차 의무, 복수 쟁점 답변 누락.
2. answer prompt 또는 answer planning 단계에서 "main rule + exception + deadline/amount + next action" 구조를 더 강하게 유도할지 검토한다.
3. expected point matcher가 실제 답변 의미를 과소평가한 항목과 실제 답변 누락 항목을 분리한다.
4. retrieval / citation / grounding이 clean한 상태를 유지하면서 답변 coverage만 개선한다.
5. 개선 후 `run_answer_evidence_report.py` full 60을 다시 실행해 `FAIL=0` 유지와 PARTIAL 감소 여부를 비교한다.

이 튜닝은 live answer 품질 개선 작업이며 presentation fixed fixture, `scripts/demo_preflight.sh`, SCN-004 document draft freeze 기준을 직접 변경하지 않는다.
