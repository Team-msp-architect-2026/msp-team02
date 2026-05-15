# 프로젝트 개요

기준일: `2026-05-13`

법대로(LawMainRoad)는 한국의 외국인 근로자와 취약 노동자를 위한 노동권 지원
MVP입니다.

이 제품은 사용자의 노동 문제를 한국 노동법 근거와 연결해 정리하도록 돕습니다.
최종 법적 판단을 대신하지 않으며, 관련 법령을 검색하고 위험 신호를 요약하며
다음 행동을 제안합니다. 지원되는 경우에는 누락 사실을 명시한 검토용 문서
초안까지 생성합니다.

## 제공 기능

- Before flow에서 근로계약 관련 쟁점을 검토합니다.
- After flow에서 검색된 법령 근거를 바탕으로 노동 분쟁 질문에 답합니다.
- Bridge를 통해 Before의 위험 신호를 After 질문에 연결합니다.
- 법적 근거(legal grounding)가 있을 때 SCN-004 문서 초안을 deterministic하게 생성합니다.
- SCN-001 Bridge 정보는 사건 맥락 연결/참고용이며, 법적 근거(legal grounding)가 아닙니다.
- public demo URL은 `https://www.law-main-road.cloud`입니다. 이 URL은
  `demo/contest` posture이며 production opening을 의미하지 않습니다.

## 주요 시나리오

### SCN-001: 외국인 근로자 계약 / 기숙사 / 사업장 변경

구현됨:

- Before review와 Bridge handoff
- protected Bridge answer endpoint
- `/after` saved history selector
- `/history` record archive
- MVP soft-delete
- `workplace_change_reason_summary` exact fixed-preset frozen draft

경계:

- live/backend SCN-001 draft generation은 미오픈(NOT opened)입니다.
- protected SCN-001 draft endpoint는 미오픈(NOT opened)입니다.

### SCN-004: 임금체불 / 부당해고

구현됨:

- login-free After answer flow
- document draft eligibility guard
- wage complaint draft
- unfair dismissal brief draft
- copy와 browser print
- 안정적인 rehearsal을 위한 fixed demo preset

지원 draft types:

- `labor_office_wage_complaint`
- `labor_commission_unfair_dismissal_brief`

### SCN-005 and Recovery

SCN-005와 Recovery는 후속 후보입니다. 현재 frontend preset flow로 노출되지
않습니다.

### Cloud Hardening

구현/문서 상태:

- Phase 7A `www.law-main-road.cloud` public domain launch 완료
- Phase 7B private GCS artifact storage + operations dashboard 후보 문서화 완료

경계:

- Phase 7B runtime GCS writer, artifact retrieval UI, physical purge lifecycle은
  미오픈(NOT opened)입니다.

## 현재 사용자-facing routes

- `/`: home과 auth entry
- `/before`: contract review와 Bridge handoff
- `/after`: dispute question input, presets, saved history selector
- `/after/result`: grounded answer와 draft eligibility
- `/after/intake`: 지원 draft용 optional fact intake
- `/after/draft`: draft preview, copy, print
- `/history`: protected SCN-001 record archive

## 설계 원칙

- 한국어 primary, 영어 secondary.
- 법령 citation은 검색된 context로 뒷받침될 때만 표시합니다.
- 누락 사실은 추정하지 않고 보이는 상태로 남깁니다.
- disclaimer와 uncertainty를 명확하게 유지합니다.
- 작업 route의 UI는 token-first, neutral/dense/evidence-led 방향을 따르고,
  main page는 조금 더 따뜻하지만 service-oriented 톤을 유지합니다.
- 민감한 raw payload는 browser storage에 저장하지 않습니다.
- SCN-004 public demo는 login-free로 유지합니다.
- SCN-001 protected features는 Firebase signed-in state만이 아니라 backend-verified
  auth를 요구합니다.

최신 UI checkpoint:

- Before는 upload-focused first screen, OCR 1~2분 guidance, hardcoded default
  accessibility legal basis 제거 상태입니다.
- After entry는 centered layout, guidance cards, restored disclaimer를 갖습니다.
- History는 centered folded incident cards를 사용합니다.
- Main은 정리된 H1/lead/nav typography와 compact flow strip을 사용합니다.
- `DESIGN.md`는 현재 frontend visual direction을 token-first, neutral, dense,
  evidence-led, disclaimer/uncertainty 명시 기준으로 안내합니다.
