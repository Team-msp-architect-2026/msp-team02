# RAG와 법령 코퍼스

이 문서는 법대로(LawMainRoad)의 법령 데이터, 검색, 근거 답변 기준을 공개 가능한
수준으로 정리합니다.

## 현재 코퍼스

| 항목 | 현재 기준 |
|---|---|
| Source | `data/legalize-kr/` submodule |
| Processed source of truth | `backend/data/law_chunks/all_chunks.json` |
| 현재 법령 조각 | `1722`개 |
| 법령 선택 기준일 | `2026-04-11` |
| Embedding model | `gemini-embedding-001`, 768 dimensions |
| Vector store | PostgreSQL + pgvector |

`backend/data/law_chunks/` output은 직접 수정하지 않습니다. 코퍼스 갱신은 문서화된
pipeline 또는 명시적으로 검토된 데이터 보강 절차를 통해서만 진행합니다.

## 파이프라인

Chunking order는 고정되어 있습니다.

```text
Step 1 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
```

Step 2와 Step 3은 별도로 실행하지 않습니다. 현재 코퍼스는 기준 법령 조각에 작은
시나리오 보강 세트를 더해 `1722`개입니다.

## 검색 경로 (Retrieval Path)

```text
user query
  -> query embedding
  -> pgvector HNSW search
  -> 검색된 법령 조각
  -> 법령 근거가 함께 제시되는 답변 생성
  -> 검색된 근거에서만 인용 조문 생성
```

기본 공개 답변 동작:

- general `/api/v1/answer`: `top_k=5`, `ef_search=100`
- 예시 상담 경로: `top_k=10`, `ef_search=100`
- 계약서 검토 연결 데모 경로에는 제한적으로 질문 분해 보호 로직이 적용될 수
  있습니다. 이 로직은 데모 시나리오 경계 안에서만 사용하며 전체 RAG 동작으로
  확장된 상태가 아닙니다.

## 근거화 규칙 (Grounding Rules)

- 법률 답변은 검색된 법령 조각 안에서만 인용 조문을 만듭니다.
- 검색 결과에 없는 조문을 답변의 근거처럼 추가하지 않습니다.
- `cited_articles`와 `grounded_context_ids`가 비어 있으면 문서 초안 작성은 열리지 않습니다.
- 계약서 검토 결과는 사건 연결/참고용이며, 법적 근거가 아닙니다.
  이 정보가 검색된 법령 조각이나 인용 조문 식별자를 새로 만들거나 바꾸지 않습니다.

## 평가 기준선 (Evaluation Baseline)

현재 public-safe baseline summary:

Evaluation baseline은 60-item scenario eval set을 사용합니다. 각 item은
PASS / PARTIAL / FAIL 단위로 검토하고, 인용 조문이 검색된 법령 근거로 뒷받침되는지
확인합니다.

| Check | Result |
|---|---|
| Retrieval hit@1 | `51/60` |
| Retrieval hit@3 | `59/60` |
| Retrieval hit@5 | `60/60` |
| Answered items | `60/60` |
| Citation grounding | clean in the recorded full answer eval |
| Evidence report | `PASS=44`, `PARTIAL=16`, `FAIL=0` |

이 표는 광범위한 장기 운영 benchmark가 아니라 기록된 시나리오 평가 근거를
요약합니다. 목적은 현재 코퍼스와 시나리오 범위에서 데모 준비도와 근거 제시 원칙을
보여주는 것입니다.

남은 partial items는 답변 품질 조정 후보로 다룹니다. 공개 데모가 근거 없이
동작한다는 의미가 아닙니다.

## 예시와 실시간 답변 경로

- `임금체불·부당해고 상담` 예시를 그대로 제출하면 같은 결과를 재현할 수 있도록
  화면에서 안정화된 답변을 사용하고 실시간 답변 생성을 호출하지 않습니다.
- 예시를 수정하거나 직접 입력하면 실시간 `/api/v1/answer`를 호출할 수 있습니다.
- `사업장 변경 사유 정리서 초안` 예시는 화면 내 예시 작성 흐름을 사용합니다.
- 계약서 검토 기반 서버 초안 생성은 현재 제공하지 않습니다.

## 함께 보기

- [[RAG 평가|RAG-Evaluation]]
- [[최종 아키텍처|Final-Architecture]]
- [[API 문서|API-Endpoints-and-Schemas]]
- [[테스트 전략|Testing-Strategy]]
