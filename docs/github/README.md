# 법대로(LawMainRoad)

법대로(LawMainRoad)는 외국인 근로자와 취약 노동자가 근로계약, 임금체불,
부당해고, 사업장 변경 같은 노동 문제를 한국 노동법 근거와 함께 정리할 수
있도록 돕는 AI 지원 MVP입니다.


- **공개 데모:** https://www.law-main-road.cloud
- **데모 시연 영상:** [YouTube에서 보기](https://youtu.be/fFEPP3KtHMs)
- **MP4 백업 파일:** [브라우저에서 열기 또는 다운로드](https://raw.githubusercontent.com/Team-msp-architect-2026/msp-team02/main/docs/video/lmr_demo_web.mp4)

[![법대로 데모 시연 영상](https://img.youtube.com/vi/fFEPP3KtHMs/maxresdefault.jpg)](https://youtu.be/fFEPP3KtHMs)

이 MVP는 **법률 자문을 제공하는 서비스가 아니라**, 한국 노동법 조문을 함께
보여 주며 사용자의 상황을 정리하는 데 도움을 주는 도구입니다. 변호사 자문,
행정기관·법원의 판단을 대체하지 않으며, 실제 신고·소송·체류 관련 결정에는
관련 기관 또는 전문가 확인이 필요합니다.

이 공개 저장소는 공모전 제출과 공개 검토를 위한 정리본입니다. 실제 개발과 배포
자동화 기준은 접근 권한이 필요한
[`2026-moel-datacontest-core/law_main_road_main`](https://github.com/2026-moel-datacontest-core/law_main_road_main)
저장소에서 관리합니다. 이 저장소에는 배포 권한, 비밀값, 내부 클라우드 운영 정보를
두지 않습니다.

## 빠른 심사 흐름

5분 안에 확인할 수 있는 흐름입니다.

1. 위 YouTube 썸네일(약 2분)을 먼저 확인하거나, 시간이 부족하면 2번부터 바로 시작합니다.
2. https://www.law-main-road.cloud 를 엽니다.
3. 메인 화면에서 AI 법률 상담을 선택합니다.
4. 예시 사례에서 `임금체불·부당해고 상담`을 선택하고 제출합니다.
5. 답변 화면에서 법령 근거, 인용 조문, 주의사항을 확인합니다.
6. 지원되는 문서 유형(예: 사업장 변경 사유 정리서 초안)을 선택하고 필요한 사실관계를 입력합니다.
7. 초안 화면에서 문서 본문, 추가로 필요한 정보, 증거 체크리스트, 복사와 인쇄 동작을 확인합니다.

추가 확인 흐름:

- Google 로그인 후 계약서 검토 결과를 AI 법률 상담에 연결할 수 있습니다.
- 사건 기록 화면에서 저장된 사건 카드와 기록 삭제(목록에서 숨김)를 확인할 수 있습니다.

## 공개 문서

상세 문서는 GitHub Wiki를 기준 공개 문서로 사용합니다. 이 README는 심사자가
프로젝트 목적, 구현 범위, 공개 데모 상태, 보안·개인정보 경계를 빠르게 확인할 수
있도록 정리한 첫 페이지입니다.

**먼저 보기 좋은 문서**

- [E2E 데모 검증](https://github.com/Team-msp-architect-2026/msp-team02/wiki/E2E-Demo-Verification) — 공개 데모가 실제로 동작했음을 보여 주는 기록
- [UI 화면 구성](https://github.com/Team-msp-architect-2026/msp-team02/wiki/UI-Screens) — 주요 화면을 한눈에
- [사용자 흐름](https://github.com/Team-msp-architect-2026/msp-team02/wiki/User-Flows) — 빠른 심사 흐름의 배경 설명

**기술 상세**

- [최종 아키텍처](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture)
- [API 문서](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)
- [클라우드 전환과 공개 미러 정책](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy)
- [GitHub Wiki 전체 색인](https://github.com/Team-msp-architect-2026/msp-team02/wiki)

내부 계획서와 운영 기록을 그대로 공개하지 않고, 현재 구현 상태와 공개 가능한
범위만 다시 정리했습니다.

## 현재 제공 기능

> 문서 최종 정리일 `2026-05-14` · 구현 기준일 `2026-05-13`

- 로그인 없이 사용할 수 있는 AI 법률 상담
- 법령 근거가 함께 제시되는 답변
- 임금체불·부당해고 상담에서 이어지는 문서 초안 작성
- 로그인 사용자용 계약서 검토, 사건 기록, 기록 삭제
- 계약서 검토 결과를 AI 법률 상담에 연결하는 기능
- `사업장 변경 사유 정리서 초안` 예시 작성
- Google 로그인과 서버 인증 확인
- PostgreSQL + pgvector 기반 법령 검색
- Vertex AI Gemini 기반 답변, OCR, 임베딩 연동
- 공개 데모 도메인 `https://www.law-main-road.cloud` 연결
- 공개 검토용 YouTube 시연 영상과 MP4 백업 파일
- Next.js 화면과 FastAPI 서버 기반 구현
- 2026년 4월 11일 기준으로 정리한 법령 조각 1,722개 사용

주요 화면:

- 메인 화면
- 계약서 검토 화면
- AI 법률 상담 입력 화면
- 답변 결과 화면
- 문서 정보 입력 화면
- 문서 초안 화면
- 사건 기록 화면

## 아키텍처 요약

![법대로 클라우드 아키텍처 개요 — 사용자 → Next.js → FastAPI → PostgreSQL/pgvector → Vertex AI Gemini 흐름](../images/cloud-migration-overview.png)

> 전체 구성도. 상세 경계는 [최종 아키텍처](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture) 문서를 참고하세요.

```text
사용자
  -> Next.js 화면
  -> FastAPI 서버
  -> PostgreSQL + pgvector 법령 검색
  -> Vertex AI Gemini 답변 / OCR / 임베딩
  -> 법령 근거가 함께 제시되는 답변 또는 지원되는 문서 초안
```

```text
legalize-kr 법령 데이터
  -> 전처리와 법령 조각 생성
  -> 1,722개 법령 조각
  -> PostgreSQL 법령 테이블과 pgvector 임베딩
```

주요 기술:

| 영역 | 기술 |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Backend | FastAPI |
| Database | PostgreSQL + pgvector |
| Login | Firebase Google Sign-In, Firebase Admin 확인 |
| LLM/OCR | Vertex AI Gemini |
| Embedding | `gemini-embedding-001`, 768 dimensions |

## 사용자 흐름과 API 경계

일반 사용자가 보는 흐름은 세 가지입니다.

- AI 법률 상담: 질문 입력 -> 법령 근거가 함께 제시되는 답변 -> 지원되는 문서 초안
- 계약서 검토 연결: 계약서 검토 -> 상담에 연결 -> 이어지는 법률 상담 답변
- 사건 기록: 로그인 사용자에게 저장된 사건 카드 제공 -> 기록 삭제 시 목록에서 숨김

AI 법률 상담은 로그인 없이 사용할 수 있습니다. 계약서 검토, 사건 기록, 저장된
사건을 상담에 연결하는 기능은 서버 인증이 확인된 로그인 상태에서 사용할 수
있습니다. 계약서 검토 결과는 상담을 이어가기 위한 참고 정보이며, 답변의 법적
근거는 검색된 법령에서만 가져옵니다.

API의 상세 경로와 요청/응답 구조는
[API 문서](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)를
따릅니다.

## 데모와 클라우드 상태

클라우드 전환은 개발 환경에서 먼저 확인한 뒤 공모전 공개 데모로 확장하는 방식을
사용합니다.

- `dev`: 첫 클라우드 적용과 기본 동작 확인 환경
- `demo/contest`: 공모전 심사와 발표를 위한 기간 한정 공개 데모 상태
- `prod`: 장기 운영 서비스로는 아직 제공하지 않음

완료된 공개 제출 상태:

- 백엔드와 프론트엔드 기본 동작 확인 완료
- 공개 데모 도메인 연결 완료: `https://www.law-main-road.cloud`
- 공개 검토용 YouTube 시연 영상 연결: `https://youtu.be/fFEPP3KtHMs`
- 공개 검토용 web-optimized MP4 백업 파일 배치: `docs/video/lmr_demo_web.mp4`
- 공개 데모는 `www.law-main-road.cloud` 한 도메인에서만 동작합니다.
- 사용자가 접속하는 프론트엔드 URL만 공개하고, 서버 직접 실행 URL과 내부 클라우드 목록은 공개하지 않습니다.

현재 제공하지 않는 클라우드 운영 항목:

- root apex `law-main-road.cloud`
- `api.law-main-road.cloud`
- 같은 도메인 아래의 `/api/**` 라우팅
- HTTPS Load Balancer
- Cloud Armor
- 장기 운영 서비스 선언

이 저장소와 공개 문서는 장기 운영 서비스가 준비됐다는 주장으로 읽히지 않도록,
공모전 데모 상태와 현재 제공하지 않는 기능을 구분해 설명합니다.

## 현재 제공하지 않는 기능

- 계약서 검토 결과를 바탕으로 서버에서 새 문서 초안을 생성하는 기능
- 계약서 검토 기반 초안을 위한 별도 로그인 API
- 계약서 검토 결과를 별도 페이지에서 상담으로 옮기는 전용 연결 화면 (현재는 동일 흐름 안에서 연결)
- 사건 발생 이후 복구 단계(임금 지급 후속 조치, 분쟁 사후 관리 등) 흐름
- 추가 문서 유형과 추가 상담 시나리오
- 완전 삭제, 파일 물리 삭제, 계정 삭제, 복구, 보관 기간 정책
- 장기 운영 배포 선언

`사업장 변경 사유 정리서 초안`은 화면에서 제공하는 예시 작성 흐름입니다. 서버에서
실시간으로 계약서 검토 기반 초안을 생성한다는 의미가 아닙니다.

## 보안과 개인정보 경계

공개 문서와 공개 저장소에는 다음 정보를 포함하지 않습니다.

- 인증 비밀값, 로컬 환경값, 클라우드 비밀값
- 인프라 상태 파일 또는 클라우드 키 파일
- 클라우드 프로젝트 식별자, 서버 직접 실행 URL, 내부 클라우드 목록
- 인증 제공자의 개인 식별자, 이메일 값, 데이터베이스 계정 식별자
- 사건 원문 데이터, 답변·초안·상담 연결 전체 원문 데이터
- 승인된 공개 저장소 정책을 넘어서는 비공개 개발·배포 세부 정보

프론트엔드는 민감한 원문 데이터를 브라우저 저장소에 남기지 않는 방향으로 설계되어
있습니다. 로그인 후 사용할 수 있는 기능은 서버 인증 확인 이후에만 열립니다.

## 개발 과정과 실행 안내

개발과 배포 자동화 기준은 접근 권한이 필요한 source/deploy 저장소에서 관리합니다.
이 공개 저장소는 제출용 README/Wiki와 공개 가능한 정리본이며, 서비스 계정 키,
인프라 상태 파일, 서버 직접 실행 URL, 인증 정보, 비밀값을 포함하지 않습니다.

아래 명령은 source/deploy codebase 접근 권한을 가진 reviewer/developer 환경에서
사용하는 공개 가능한 실행 요약입니다. 이 공개 저장소만 clone한 경우에는 runnable
source tree가 포함되지 않을 수 있습니다.

Backend:

```bash
conda activate law_main_road
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- backend: `http://localhost:8000`
- frontend: `http://localhost:5090`

Environment templates:

- `backend/.env.example`
- `frontend/.env.example`

## 검증

아래 명령은 source/deploy 저장소 접근 권한이 있는 환경에서의 참고용입니다. 이
공개 저장소만 clone한 경우에는 다음 명령이 그대로 동작하지 않을 수 있으며,
동일 검증이 통과한 결과는
[E2E 데모 검증](https://github.com/Team-msp-architect-2026/msp-team02/wiki/E2E-Demo-Verification)
문서에서 확인할 수 있습니다.

Focused checks:

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
cd frontend
npm run build
```

Demo preflight:

```bash
bash scripts/demo_preflight.sh
```

전체 검색/답변 평가는 검색, 답변 생성, 임베딩, 데이터베이스 내용, API 응답 계약이
변경된 경우에만 별도로 수행합니다.

기대되는 확인 신호:

- 백엔드 import 확인에서 `import_ok` 출력
- 문서 초안 검증 스크립트 정상 종료
- 프론트엔드 빌드 정상 완료
- 실시간 Vertex/OCR 확인은 인증 정보가 필요하며 문서만 바뀐 경우에는 필수 아님

## 참고

법대로(LawMainRoad)는 법률 정보를 정리하고 관련 근거를 확인하는 데 도움을 주는
MVP입니다. 결과는 법률 자문이나 행정기관의 판단을 대체하지 않으며, 실제 신고,
상담, 소송, 체류 관련 결정에는 관련 기관 또는 전문가 확인이 필요합니다.
