# 데이터 모델과 개인정보 경계

## 법령 코퍼스 (Law Corpus)

현재 source of truth:

- `backend/data/law_chunks/all_chunks.json`
- 현재 법령 조각: `1722`개
- 법령 선택 기준일: `2026-04-11`

법령 조각 산출물은 직접 수정하지 않습니다. 갱신은 문서화된 파이프라인 또는 명시적으로
검토된 데이터 보강 절차를 거쳐야 합니다.

## 핵심 테이블 (Core Tables)

현재 database model에 포함된 tables:

- `law_chunks`
- `users`
- `before_review_jobs`
- `bridge_runs`
- `after_artifact_runs`

사용자 화면의 기록 삭제는 visibility fields를 사용해 목록에서 기록을 숨깁니다.
이는 완전 삭제, 파일 물리 삭제, 보관 기간 정책을 제공한다는 의미가 아닙니다.

## 브라우저 저장소 경계

Frontend는 raw flow payload를 브라우저 저장소에 저장하지 않습니다. 로그인 상태는
Firebase SDK의 browser-session auth state로만 복원하며, 앱 코드가 인증 토큰이나
장기 credential을 직접 Web Storage에 저장하지 않습니다.

앱 코드가 브라우저 저장소에 저장하지 않는 항목:

- OAuth bearer credentials 또는 장기 인증 정보
- 사용자 진술 원문
- 전체 답변 데이터
- 전체 초안 데이터
- 문서 작성을 위한 사건 입력값
- 상담 연결 원문 데이터
- raw `after_query_seed`(상담 질문 생성을 위한 내부 seed 값)
- 인증 제공자 subject 식별자, 이메일 값, 데이터베이스 계정 식별자

저장된 사건 선택, 화면 표시, 답변 질문 구성, 브라우저 저장소는 화면에 표시된 안전한
요약 정보만 사용합니다. 즉시 생성된 상담 연결은 현재 세션 동안 서버가 반환한 연결
필드를 메모리에 둘 수 있지만, 이를 법적 근거로 노출하지 않고 브라우저 저장소에
저장하지 않습니다.

## 공개 문서 경계

공개 스크린샷과 문서에는 다음 항목을 노출하지 않습니다.

- 정확한 클라우드 리소스 식별자
- 클라우드 identity 이메일
- 비공개 구조를 드러내는 클라우드 secret 이름 또는 값
- 비공개 bucket 이름
- 서버 직접 실행 URL
- 실제 사용자/사건 데이터

## 보관/삭제 경계

사건 기록은 현재 기록 삭제 visibility를 지원합니다. 이는 사용자 목록에서 기록을
숨기고, 숨겨진 기록이 상담 연결로 이어지는 것을 막습니다. 완전 삭제, 파일 물리
삭제, 복구, 내보내기, 계정 삭제, orphan cleanup, 보관 기간 정책은 현재 MVP 범위
밖입니다.

## 함께 보기

- [[보안 모델|Security-Model]]
- [[설계 원칙|Design-Principles]]
- [[클라우드 전환과 공개 미러 정책|Cloud-Migration-and-Public-Mirror-Policy]]
