# 클라우드 전환과 공개 미러 정책

이 문서는 공개 가능한 수준의 클라우드 전환 상태와 저장소 정책을
정리합니다.

## 환경 프로필 (Environment Profiles)

클라우드 전환은 개발 환경 우선 정책을 사용합니다.

| Profile | 의미 |
|---|---|
| `dev` | 첫 Terraform 적용과 기본 동작 확인 환경 |
| `demo/contest` | dev 확인 이후 기간을 정해 공개하는 발표/심사 운영 상태 |
| `prod` | 별도 장기 운영 전환 검토 없이는 제공하지 않음 |

현재 프로젝트는 장기 운영 서비스 준비 완료를 주장하지 않습니다.

## 저장소 역할 (Repository Ownership)

| Repository | 역할 |
|---|---|
| private source/deploy repo | 개발과 비공개 배포 자동화 |
| public mirror repo | 제출용으로 선별한 공개 정리본 |

공개 미러는 배포 권한을 가진 저장소가 아니며, WIF deploy permission(키 파일 없이
배포 권한을 연결하는 설정), deployment identity binding, service account key JSON,
cloud secrets, deploy credentials를 받지 않습니다.

## 공개 미러에 넣지 않는 것

- deploy credentials
- infrastructure state files
- cloud IAM key JSON
- cloud secret values
- private cloud inventory
- 사용자/사건 원문 데이터
- 전체 답변/초안 데이터
- 인증 제공자 subject 식별자, 이메일 값, 데이터베이스 계정 식별자
- private runbooks

## 공개 미러에 넣을 수 있는 것

- README
- curated final code snapshot, after security review
- public Wiki docs
- redacted architecture diagrams
- safe screenshots
- public-safe demo video
- contest notice and license information

## 제출 운영 자세

공개 데모는 공모전 심사와 발표를 위한 것입니다. 운영 강화 항목, 장기 운영 전환,
보관 기간 정책 확장은 이후 검토에서 명시적으로 열기 전까지 향후 과제로 관리합니다.

## Public Demo URL / Domain

승인된 public demo URL은 다음과 같습니다.

```text
https://www.law-main-road.cloud
```

Cloud Run managed HTTPS URL은 첫 클라우드 전환과 rollback 확인에 충분한 기본
배포 경로로 유지합니다. Public contest/portfolio용 custom domain은 Phase 7A
선택 강화 항목으로 열었고, 첫 경로는 Firebase Hosting custom domain입니다.

- custom domain은 공모전 데모 운영 상태이며, 별도 승인 없이 `prod`를 의미하지
  않습니다.
- domain 구매, Gabia DNS, Firebase Authorized Domains, CORS, certificate 상태는
  `www` host 기준으로 검증 완료했습니다.
- Frontend API base는 direct backend path를 유지합니다. Same-origin `/api/**`
  rewrite와 frontend rebuild는 Phase 7A에서 하지 않았습니다.
- Gabia URL forwarding은 가장 단순한 임시 연결 방식이지만, public portfolio의 기본
  custom domain hosting 방식으로는 선호하지 않습니다.
- HTTPS Load Balancer, Cloud Armor, root apex, 별도 `api` domain은 이후 별도
  운영 강화 후보로 둡니다.
- direct backend Cloud Run URL과 내부 클라우드 목록은 public docs/screenshots에
  노출하지 않습니다.

## 클라우드 경계 요약

- first cloud target은 `dev`입니다.
- `demo/contest`는 dev 확인 이후 기간을 정해 공개하는 발표/심사 운영 상태입니다.
- Phase 7A public `www` domain launch는 공모전 데모 운영 상태로 완료됐습니다.
- `prod`는 운영 책임자, 비용, 안정성, 보안, rollback, 보관 정책을 별도 검토에서
  승인하기 전까지 제공하지 않습니다.
- public mirror는 제출용으로 선별한 공개 정리본이며 development/deployment source
  of authority가 아닙니다.

## 함께 보기

- [[보안 모델|Security-Model]]
- [[배포와 실행 가이드|Deployment-and-Setup-Guide]]
- [[범위 및 비목표|Scope-and-Non-Goals]]
