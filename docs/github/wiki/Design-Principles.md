# 설계 원칙

## 1. 근거 중심 법률 답변

법률 답변은 검색된 법령 조각을 기반으로 작성합니다. 검색 결과에 없는 조문을
답변의 근거처럼 제시하지 않습니다.

## 2. 누락 사실은 보이게 유지

사용자가 입력하지 않은 사실은 단정하지 않습니다. 문서 초안에서는 확인 필요
표시, 추가 확인 항목, 주의사항으로 남깁니다.

## 3. 시나리오 경계 우선

AI 법률 상담 데모 안정성과 로그인 사용자용 계약서 검토/기록 흐름을 섞어 확장하지
않습니다. 신규 문서 타입이나 Recovery는 별도 단계에서 검토합니다.

## 4. 상담 연결은 근거가 아님

계약서 검토 맥락은 사용자의 사건 맥락을 이어 주는 참고 정보입니다.
이 맥락은 사건 연결/참고용이며, 법적 근거가 아닙니다.
계약서 검토 맥락이 `legal_basis`, `cited_articles`, `grounded_context_ids`,
`retrieved_chunks`를 새로 만들거나 바꾸지 않습니다.

## 5. 서버 인증 확인 기반 보호 UX

로그인 후 사용할 수 있는 화면은 Firebase signed-in 상태만으로 열지 않습니다.
backend `/api/v1/auth/me` verification이 완료된 `backendUser.logged_in` 기준으로
동작합니다.

## 6. 데이터 최소화

토큰, 사용자 진술 원문, 전체 답변/초안 데이터, 상담 연결 원문 데이터,
raw `after_query_seed`는 브라우저 저장소에 저장하지 않습니다.

## 7. 공개 API 계약 안정성

`/api/v1/answer`와 `/api/v1/documents/draft` 공개 API 계약은 문서 편의를
위해 임의로 확장하지 않습니다.

## 8. Dev-first 클라우드 전환

첫 Terraform apply target은 `dev`입니다. `demo/contest`는 기간이 정해진 공개
발표 상태이고, `prod`는 별도 장기 운영 전환 검토 없이는 제공하지 않습니다.

## 9. 공개 문서는 선별해 작성

공개 Wiki는 내부 설계 기록을 그대로 복사하지 않습니다. 사용자와 심사자가
이해해야 하는 구현 상태, 한계, 검증 근거, 보안 경계만 다시 구성합니다.

## 함께 보기

- [[범위 및 비목표|Scope-and-Non-Goals]]
- [[API 문서|API-Endpoints-and-Schemas]]
- [[데이터 모델과 개인정보 경계|Data-Model-and-Privacy]]
- [[RAG와 법령 코퍼스|RAG-and-Law-Corpus]]
