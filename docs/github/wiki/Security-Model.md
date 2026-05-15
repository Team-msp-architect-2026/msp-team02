# 보안 모델

## 위협 경계 (Threat Boundary)

MVP는 민감한 노동 사건 맥락을 다룹니다. 보안 모델은 다음에 초점을 둡니다.

- 수집·저장하는 개인정보 최소화
- 앱 코드가 인증 토큰과 raw flow payload를 브라우저 저장소에 직접 저장하지 않기
- 로그인 후 사용할 수 있는 기능에 서버 인증 확인 요구
- 공개 문서와 공개 미러 저장소에서 비밀값 노출 방지
- 계약서 검토 결과를 사건 연결/참고용으로만 유지하고 법적 근거로 쓰지 않기

## 인증

로그인 후 사용할 수 있는 기능은 Firebase Google Sign-In을 사용합니다.

```text
Firebase Web SDK
  -> Firebase ID token
  -> backend Firebase Admin verification
  -> backend-owned project account linkage
```

로그인 후 사용할 수 있는 화면은 backend `/api/v1/auth/me` verification(서버 인증
확인)을 사용합니다. Firebase signed-in state만으로는 충분하지 않습니다.
Frontend 로그인 복원은 Firebase SDK의 browser-session auth state 범위에서만
허용하고, 앱은 raw case/answer/draft/상담 연결 payload를 Web Storage에 저장하지
않습니다.

## 인가

로그인 후 사용할 수 있는 API는 Firebase bearer token을 요구합니다. 존재하지 않거나
소유하지 않은 상담 연결 기록은 not found로 응답해 소유 여부를 노출하지 않습니다.

## 비밀값 관리

다음 항목은 commit하지 않습니다.

- `.env*`
- Firebase Admin credential JSON
- cloud IAM key JSON
- infrastructure state files
- cloud secret values
- credential-bearing database URLs
- Firebase ID tokens or Google OAuth tokens

## 공개 미러 규칙

공개 미러는 제출용으로 선별한 저장소입니다. 배포 권한, keyless deploy trust(키 파일
없이 배포 신뢰를 연결하는 방식) 세부값, cloud IAM key files, infrastructure state
files, private runbooks, 사용자/사건 원문 데이터를 공개 미러에 넣지 않습니다.

## 로그와 증거 기록 규칙

공개 증거는 PASS/PRESENT/ABSENT/NO 같은 요약 신호를 사용합니다. 실제 인증 정보,
사건 원문, 전체 답변 본문, 전체 초안 본문, 내부 계정 식별자, 내부 클라우드 목록은
기록하지 않습니다.

## 함께 보기

- [[데이터 모델과 개인정보 경계|Data-Model-and-Privacy]]
- [[클라우드 전환과 공개 미러 정책|Cloud-Migration-and-Public-Mirror-Policy]]
