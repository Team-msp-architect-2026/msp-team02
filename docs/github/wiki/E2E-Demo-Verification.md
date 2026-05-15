# E2E 데모 검증

이 문서는 공개 가능한 end-to-end 검증 상태를 요약합니다. 실제 비공개 증거,
사건 원문, 전체 응답 본문, 인증 정보, 내부 클라우드 목록은 포함하지 않습니다.

## 검증 범위

| 영역 | 공개 가능한 상태 |
|---|---|
| `임금체불·부당해고 상담` 예시 | PASS: 답변, 문서 정보 입력, 초안 확인 |
| 문서 초안 동작 | PASS: 초안 본문, 복사, 브라우저 인쇄 |
| 예시 수정과 직접 입력 | PASS: 브라우저/네트워크 확인 기록 |
| 계약서 검토 로그인과 서버 인증 확인 | PASS: 실제 브라우저 확인 |
| 계약서 검토에서 이어지는 상담 답변 | PASS: 브라우저/네트워크/DB 확인 |
| 계약서 검토 연결을 선택하지 않은 경우 | PASS: 계약서 검토에서 이어진 답변 결과로 유지 |
| 사건 기록 보관함 | PASS: 기록 있음/없음 상태 확인 |
| 기록 삭제 | PASS: 확인/취소, 삭제 후 목록에서 숨김 |
| AI 법률 상담 화면의 저장 사건 선택 | PASS: 화면에 표시된 안전한 요약만 사용하고 선택 상태 정리 |
| 공개 `www` 도메인 | PASS: Firebase Hosting custom domain connected, Firebase Auth authorized domain updated, 주요 화면 기본 접속 확인 |

이 PASS가 같은 도메인 아래의 `/api/**` 라우팅, root apex, `api.*`,
HTTPS Load Balancer, Cloud Armor, 장기 운영 서비스 선언까지 완료했다는 의미는
아닙니다.

## 메인 데모 경로

```text
AI 법률 상담
  -> 임금체불·부당해고 상담 예시
  -> 답변 결과
  -> 문서 유형 선택
  -> 필요한 사실관계 입력
  -> 초안 확인
  -> 복사 또는 브라우저 인쇄
```

예시를 그대로 제출하는 경로는 심사용으로 안정화되어 있습니다. 실시간 답변 생성에
의존하지 않고 같은 결과를 재현할 수 있게 구성했습니다.

## 데모 영상

공개 README와 Wiki에서는 YouTube 시연 영상을 대표 확인 자료로 연결합니다.
GitHub README/Wiki는 YouTube iframe player를 허용하지 않으므로, thumbnail image를
클릭하면 YouTube 영상으로 이동하는 방식입니다. MP4 파일은 브라우저 환경에 따라 바로
열리거나 다운로드될 수 있는 백업 파일입니다.

- [YouTube 시연 영상 보기](https://youtu.be/fFEPP3KtHMs)
- [MP4 백업 파일 열기 또는 다운로드](https://raw.githubusercontent.com/Team-msp-architect-2026/msp-team02/main/docs/video/lmr_demo_web.mp4)

영상은 AI 법률 상담, 답변 결과, 문서 정보 입력, 초안 확인 흐름을 빠르게 보여 주는
보조 자료입니다. 실제 사용자/사건 원문, 인증 정보, 서버 직접 실행 URL, 내부
클라우드 리소스 식별자를 포함하지 않는 공개용 영상만 배치합니다.

## 로그인 후 계약서 검토 연결 흐름

```text
계약서 검토
  -> 로그인 후 분석 시작
  -> 상담 연결 기록 생성
  -> AI 법률 상담에 연결
  -> 이어지는 답변 결과 확인
```

로그인 후 사용할 수 있는 화면은 브라우저의 Firebase 로그인 상태만이 아니라 서버의
인증 확인 결과를 기준으로 열립니다.

이는 계약서 검토 화면의 사용자 경험 경계를 설명합니다. API 수준의 세부 인증
라벨은 [[API 문서|API-Endpoints-and-Schemas]]에서 따로 요약합니다.

## 공개 검증 명령

집중 확인:

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
```

Frontend build:

```bash
cd frontend
npm run build
```

현재 데모 사전 점검:

```bash
bash scripts/demo_preflight.sh
```

문서만 바뀐 경우에는 전체 검색/답변 평가가 필요하지 않습니다.

## 증거 기록 위생

공개 보고서에는 다음 수준만 기록합니다.

- PASS / PARTIAL / FAIL
- PRESENT / ABSENT
- YES / NO
- 화면과 API 이름
- 샘플 데이터만 보이는 스크린샷

공개 보고서에는 업로드 원문 파일, 사용자 진술 원문, 전체 답변/초안 데이터,
인증 정보, 내부 클라우드 목록, 서버 직접 실행 URL을 기록하지 않습니다.

## 알려진 런타임 리스크

- 외부 제공자 timeout은 일시적일 수 있습니다.
- OCR과 실시간 제공자 호출에는 재시도가 필요할 수 있습니다.
- 클라우드 전환은 개발 환경 우선 상태로 유지합니다. 공모전 데모 운영 상태는
  장기 운영 서비스 선언이 아닙니다.

## 함께 보기

- [[테스트 전략|Testing-Strategy]]
- [[사용자 흐름|User-Flows]]
- [[트러블슈팅 런북|Runbook-Troubleshooting]]
