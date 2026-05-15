# ADR 설계 결정

이 문서는 공개 가능한 설계 결정을 요약합니다. 내부 phase notes는
`docs/planning/`에 유지합니다.

## ADR-001: PostgreSQL + pgvector 선택

결정: 법령 조각 저장과 벡터 검색에 PostgreSQL + pgvector를 사용합니다.

이유: MVP backend에는 구조화된 기록과 벡터 검색을 하나의 data layer에서
다루는 구조가 필요합니다.

## ADR-002: 로그인 기능의 Firebase Auth

결정: backend Firebase Admin verification과 함께 Firebase Google Sign-In을 사용합니다.

이유: 계약서 검토 연결 흐름은 별도 비밀번호 수집을 피하면서 사용자별 계약서 검토,
상담 연결, 사건 기록을 다룰 필요가 있습니다.

## ADR-003: Frontend 인증 persistence는 browser session

결정: 현재 frontend는 Firebase `browserSessionPersistence`를 사용합니다.

이유: 같은 브라우저 세션 안에서 새로고침이나 직접 `/history` 진입 후에도 로그인
상태를 복원하기 위한 선택입니다. 앱은 raw case/answer/draft/상담 연결 payload를
Web Storage에 저장하지 않고, Firebase SDK의 browser-session auth state만 허용합니다.
장기 local persistence는 후속 사용자 경험 tradeoff로 둡니다.

## ADR-004: AI 법률 상담은 로그인 없이 사용 가능하게 유지

결정: AI 법률 상담과 문서 초안 흐름은 로그인 없이 사용할 수 있게 유지합니다.

이유: 대표 공개 데모 흐름이므로 안정성을 유지해야 합니다.

## ADR-005: 상담 연결은 continuity이며 grounding이 아님

결정: 계약서 검토 맥락은 화면에 표시된 안전한 요약 정보를 전달할 수 있지만,
인용 조문이나 근거 context ids를 만들 수 없습니다.

이유: legal grounding은 prior case summary만이 아니라 retrieval/answer evidence에서
나와야 합니다.

## ADR-006: 사업장 변경 사유 정리서 예시 초안은 화면 내 작성

결정: `사업장 변경 사유 정리서 초안` 예시는 deterministic template을 바탕으로
frontend에서 생성합니다.

이유: 계약서 검토 기반 서버 초안 생성과 로그인 초안 API는 현재 MVP에서 제공하지
않습니다.

## ADR-007: 기록 삭제는 목록 숨김 방식으로 구현

결정: 사건 기록에 user-facing delete visibility를 구현합니다.

이유: 보관 기간 정책, 완전 삭제, 파일 물리 삭제, 복구 정책은 별도 정책 검토가
필요합니다.

## ADR-008: Cloud migration은 dev-first

결정: first Terraform apply target은 `dev`입니다. `demo/contest`는 dev 확인
이후에 따르고, `prod`는 별도 검토를 요구합니다.

이유: 공개 공모전 데모 운영 상태를 장기 운영 서비스로 표현하지 않기 위한 결정입니다.

## ADR-009: Public demo domain routing은 Firebase Hosting으로 시작

결정: Cloud Run managed HTTPS URL은 smoke/rollback path로 유지하고, public
contest/portfolio용 custom domain은 Phase 7A에서 Firebase Hosting custom domain
방식으로 시작했습니다. 첫 public demo host는 `https://www.law-main-road.cloud`입니다.
별도 `demo` Terraform environment를 만들지 않고, 기존 `dev` resources에
`demo/contest` 운영 상태를 얹습니다.

검토한 선택지:

- Cloud Run managed HTTPS URL만 사용: 가장 단순하고 Phase 1-6 migration proof에는
  충분하지만, public portfolio URL로는 덜 정돈되어 보입니다.
- Gabia URL forwarding: 가장 쉽게 연결할 수 있지만, 진짜 custom domain hosting이
  아니며 주소창이 Cloud Run URL로 바뀌거나 masking 방식이 auth/routing 문제를 만들 수
  있습니다.
- Cloud Run direct domain mapping: 단순해 보이지만 target region과 feature support
  제약 때문에 기본 선택지로 두지 않습니다.
- Firebase Hosting custom domain: Firebase를 이미 Auth에 사용하고 있어 가장
  가벼운 public domain edge 후보입니다. Phase 7A의 첫 선택지로 사용했고 `www`
  host 연결을 완료했습니다.
- HTTPS Load Balancer + serverless NEG: 가장 확장성이 좋고 Cloud Armor/API domain으로
  이어질 수 있지만, 비용과 Terraform/DNS/certificate 복잡도가 커서 defer합니다.

이유: Phase 1-6의 목표는 dev-first Cloud Run 배포와 운영 baseline 검증입니다. Domain은
배포 필수조건이 아니라 public demo polish와 edge routing hardening에 가깝습니다.
`www.law-main-road.cloud`, Gabia DNS records for the `www` host, Firebase
Authorized Domains, CORS, frontend API base, custom API domain 여부는 Phase 7A에서
통제된 범위로 다룹니다. 첫 pass는 `www` frontend custom domain과 작은 backend
CORS 확장까지만 완료했습니다. Root apex `law-main-road.cloud`는 열지 않았습니다.

현재 기본값:

- Cloud Run managed HTTPS frontend URL은 smoke/demo rollback path로 유지합니다.
- direct backend Cloud Run URL은 public docs/screenshots에 노출하지 않습니다.
- custom domain이 붙어도 `prod`는 열리지 않습니다.
- `www.law-main-road.cloud`는 첫 public frontend host로 연결 완료됐습니다.
- Firebase Auth Authorized Domains includes `www.law-main-road.cloud`.
- Frontend API base는 직접 backend URL을 유지합니다. Same-origin `/api/**`
  rewrite와 frontend rebuild는 하지 않았습니다.
- Backend CORS는 `www` custom origin과 기존 frontend rollback/debug origin만
  허용하며 wildcard는 사용하지 않습니다.
- `api.law-main-road.cloud`, root apex, HTTPS Load Balancer, Cloud Armor는 명시
  승인 전까지 defer합니다.

## 함께 보기

- [[설계 원칙|Design-Principles]]
- [[범위 및 비목표|Scope-and-Non-Goals]]
- [[클라우드 전환과 공개 미러 정책|Cloud-Migration-and-Public-Mirror-Policy]]
