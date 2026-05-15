# 트러블슈팅 런북

이 문서는 공개 가능한 트러블슈팅 런북입니다. 비공개 클라우드 리소스 식별자,
비밀값, 사건 원문 데이터는 포함하지 않습니다.

Canonical owner: 이 Wiki page는 troubleshooting 판단과 증거 기록 위생을
관리합니다. setup, server run, verification command의 기준 문서는
[[배포와 실행 가이드|Deployment-and-Setup-Guide]]입니다. `docs/github/runbook.md`는
public mirror용 간단 quick reference로 유지합니다.

## Backend import 실패

실행:

```bash
conda activate law_main_road
python -c "from backend.main import app; print('import_ok')"
```

확인:

- Python environment가 `base`가 아닌지
- dependencies가 project environment에 설치되어 있는지
- 필요한 위치에 local `.env`가 있는지

## Frontend build 실패

실행:

```bash
cd frontend
npm run build
```

확인:

- Node dependencies가 설치되어 있는지
- local testing 기준 `NEXT_PUBLIC_API_BASE_URL`이 올바른지
- route code가 계약에 없는 backend fields를 가정하지 않는지

## 로그인처럼 보이지만 보호 UI가 닫힌 경우

로그인 후 사용할 수 있는 화면은 Firebase signed-in state만이 아니라 서버 인증
확인을 요구합니다.

확인:

- frontend에 Firebase user가 있는지
- request에 Firebase-issued bearer credential이 포함되는지
- `/api/v1/auth/me`가 로그인된 서버 사용자 상태를 반환하는지

## OCR 또는 provider timeout

앱은 작업 식별자, provider 상태, 내부 오류 세부 사항을 사용자 화면에서
숨겨야 합니다. 사용자 안내 문구는 문서 품질과 길이에 따라 OCR이
약 1~2분 걸릴 수 있음을 설명해야 합니다.

실시간 provider 호출이 실패하면 local/private environment에서 인증 정보와
provider availability를 확인한 뒤 재시도합니다.

## 문서 초안 흐름이 비활성화된 경우

문서 초안 작성은 의도적으로 제한되어 있습니다. 답변에 다음 항목이 있는지 확인합니다.

- 인용 조문
- 근거 context ids
- 지원되는 시나리오/문서 유형

계약서 검토에서 이어진 상담이나 사용자가 수정한 사업장 변경 상담은
`사업장 변경 사유 정리서 초안` 고정 예시를 그대로 쓰는 경우를 제외하고
답변 확인까지만 제공합니다.

## 공개 증거 기록 위생

issues, screenshots, Wiki updates를 작성할 때는 요약 상태 신호를 사용합니다.
업로드 원문 문서, 사건 진술 원문, 전체 응답 데이터, 인증 정보, 내부 클라우드 목록,
서버 직접 실행 URL을 붙여 넣지 않습니다.

## 함께 보기

- [[테스트 전략|Testing-Strategy]]
- [[API 문서|API-Endpoints-and-Schemas]]
- [[E2E 데모 검증|E2E-Demo-Verification]]
