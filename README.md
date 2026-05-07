# 법대로(LawMainRoad)

외국인 근로자를 위한 노동권 보호 통합 AI MVP입니다.

법대로(LawMainRoad)는 근로계약, 기숙사, 임금체불, 부당해고, 사업장 변경
같은 노동 문제를 한국 노동법 근거와 함께 정리하도록 돕는 프로젝트입니다.
이 저장소는 공모전 제출과 공개 검토를 위한 curated public mirror입니다.

## 공개 문서

상세 문서는 GitHub Wiki에서 확인할 수 있습니다.

- [Wiki Home](https://github.com/Team-msp-architect-2026/msp-team02/wiki)
- [프로젝트 수행 및 완성](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Project-Execution-and-Completion)
- [최종 아키텍처](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture)
- [사용자 흐름](https://github.com/Team-msp-architect-2026/msp-team02/wiki/User-Flows)
- [API 엔드포인트와 스키마](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)
- [클라우드 전환과 공개 미러 정책](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy)

## 핵심 기능

- 한국 노동법 기반 검색과 근거 중심 답변
- SCN-004 After 답변 및 문서 초안 흐름
- SCN-001 Before -> Bridge -> After 연결 흐름
- Firebase Google Sign-In 기반 protected SCN-001 경로
- 사용자 기록 조회와 MVP soft-delete
- 데모 안정성을 위한 fixed preset path

## 구현 범위

현재 공개 문서 기준 구현 범위:

- SCN-004 login-free After flow
- SCN-001 backend-verified protected flow
- 법령 corpus 기반 RAG와 citation grounding
- PostgreSQL + pgvector 기반 검색 foundation
- Next.js frontend와 FastAPI backend
- Firebase Auth Google Sign-In + backend verification

현재 미오픈(NOT opened) 범위:

- SCN-001 live/backend document draft generation
- protected SCN-001 draft endpoint
- independent `/bridge` route
- Recovery implementation
- SCN-005 frontend/document draft expansion
- full retention lifecycle, hard delete, artifact file purge
- production deployment claim

## 아키텍처 요약

```text
Legal source data
  -> chunking pipeline
  -> PostgreSQL + pgvector
  -> FastAPI retrieval / answer / draft / auth APIs
  -> Next.js user flows
```

AI path는 Vertex AI Gemini와 embedding 기반 검색을 사용합니다. 문서 초안은
지원되는 시나리오에서 answer-derived legal basis를 근거로 생성되며, 사용자가
입력하지 않은 사실은 단정하지 않습니다.

## Demo / Cloud Posture

이 public mirror는 공모전 검토와 공개 문서 확인을 위한 저장소입니다.

- cloud migration은 dev-first로 진행합니다.
- demo/contest는 기간이 정해진 public presentation posture입니다.
- prod는 별도 production-opening review 전까지 미오픈(NOT opened)입니다.
- 이 mirror는 deploy authority가 아닙니다.

## 보안과 개인정보 경계

공개 저장소와 Wiki에는 다음 정보를 포함하지 않습니다.

- credential values, local env values, cloud IAM key files
- raw user/case facts, full answer/draft payloads, raw Bridge payloads
- auth-provider subject identifiers, email values, database account identifiers
- exact private cloud resource identifiers, cloud secret values, private runbook details

Bridge는 사건 맥락 연결/참고용이며, 법적 근거(legal grounding)가 아닙니다.

## License

이 저장소의 라이선스는 [LICENSE](LICENSE)를 따릅니다.
