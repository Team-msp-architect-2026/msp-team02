# 법대로(LawMainRoad)

<div align="center">
  <img src="https://img.shields.io/badge/Python-151515?style=for-the-badge&logo=python&logoColor=3776AB" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-151515?style=for-the-badge&logo=fastapi&logoColor=009688" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-151515?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-151515?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" /> <br/>
  
  <img src="https://img.shields.io/badge/PostgreSQL-151515?style=for-the-badge&logo=postgresql&logoColor=4169E1" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/pgvector-151515?style=for-the-badge&logo=postgresql&logoColor=4169E1" alt="pgvector" />
  <img src="https://img.shields.io/badge/Vertex_AI-151515?style=for-the-badge&logo=googlecloud&logoColor=4285F4" alt="Vertex AI" />
  <img src="https://img.shields.io/badge/Firebase-151515?style=for-the-badge&logo=firebase&logoColor=FFCA28" alt="Firebase" />
  <img src="https://img.shields.io/badge/Google_Cloud-151515?style=for-the-badge&logo=googlecloud&logoColor=4285F4" alt="Google Cloud" />
</div>

> **외국인 근로자와 취약 노동자를 위해, 인용 조문이 함께 제시되는 법령 기반 답변과 그 답변에서 이어지는 문서 초안 작성까지 한 흐름으로 제공하는 RAG MVP**

[![법대로 데모 시연 영상](https://img.youtube.com/vi/fFEPP3KtHMs/maxresdefault.jpg)](https://youtu.be/fFEPP3KtHMs)

법대로(LawMainRoad)는 외국인 근로자와 취약 노동자가 근로계약, 임금체불, 부당해고, 사업장 변경 같은 노동 문제를 한국 노동법 근거와 함께 정리할 수 있도록 돕는 AI 지원 MVP입니다.

- **공개 데모:** https://www.law-main-road.cloud
- **시연 영상:** [YouTube](https://youtu.be/fFEPP3KtHMs) · [MP4 백업](https://raw.githubusercontent.com/Team-msp-architect-2026/msp-team02/main/docs/video/lmr_demo_web.mp4)
- **문서 최종 정리일:** `2026-05-14` / **구현 기준일:** `2026-05-13`

> 이 공개 저장소는 공모전 제출과 공개 검토를 위한 정리본입니다. 실제 개발·배포 자동화 기준은 접근 권한이 필요한 [`law_main_road_main`](https://github.com/2026-moel-datacontest-core/law_main_road_main) 내부 저장소에서 관리하며, 이 저장소에는 배포 권한·비밀값·내부 클라우드 운영 정보를 두지 않습니다.

---

## 빠른 심사 흐름 (5분)

1. 위 YouTube 썸네일을 클릭해 전체 시연 영상을 먼저 확인합니다.
2. https://www.law-main-road.cloud 를 엽니다.
3. 메인 화면에서 **AI 법률 상담**을 선택합니다.
4. 예시 사례에서 `사업장 변경 사유 정리서 초안`을 선택하고 제출합니다.
5. 답변 화면에서 **법령 근거, 인용 조문, 주의사항**을 확인합니다.
6. 지원되는 문서 유형을 선택하고 필요한 사실관계를 입력합니다.
7. 초안 화면에서 **문서 본문, 추가로 필요한 정보, 증거 체크리스트, 복사·인쇄** 동작을 확인합니다.

추가 확인 흐름:

- Google 로그인 후 **계약서 검토 결과를 AI 법률 상담에 연결**할 수 있습니다.
- **사건 기록 화면**에서 저장된 사건 카드와 기록 삭제(목록에서 숨김)를 확인할 수 있습니다.

---

## Core Design

- **Citation-grounded RAG** — 법률 답변은 항상 인용 조문(`cited_articles`)과 함께만 제공. 근거 없는 답변 생성을 금지합니다.
- **Bridge handoff (continuity, not grounding)** — 계약서 검토 결과를 상담 흐름으로 단방향 연결하되, 답변의 법적 근거는 검색된 법령에서만 가져옵니다.
- **Public / Protected 분리** — AI 법률 상담은 로그인 없이, 계약서 검토·사건 기록·검토 연결은 서버 인증 확인 후에만 열립니다.
- **Minimal PII surface** — 사건 원문·답변·초안·상담 연결 원문은 브라우저 저장소에 남기지 않고, 인증 제공자 식별자는 비즈니스 응답에 노출하지 않습니다.
- **Demo-stable preset path** — 발표 안정성을 위해 fixed-answer preset과 live RAG path를 함께 운영합니다.
- **Public mirror boundary** — 공개 저장소는 검토용 정리본. 운영 권한·비밀값·내부 클라우드 식별자는 내부 저장소에서만 관리합니다.

---

## Architecture Overview

[![법대로 클라우드 아키텍처 개요](docs/images/cloud-migration-overview.png)](docs/images/cloud-migration-overview.png)

Next.js 화면은 사용자 요청과 조회를 담당하고, FastAPI 서버가 PostgreSQL+pgvector 기반 법령 검색과 Vertex AI Gemini 호출을 통해 답변·OCR·임베딩을 처리합니다. 답변은 검색된 법령 조각에서만 근거를 가져오며, 같은 답변에서 이어지는 지원 문서 초안 흐름을 함께 제공합니다.

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

| 영역 | 기술 |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Backend | FastAPI |
| Database | PostgreSQL + pgvector |
| Login | Firebase Google Sign-In + Firebase Admin 서버 확인 |
| LLM / OCR | Vertex AI Gemini |
| Embedding | `gemini-embedding-001`, 768 dimensions |
| Corpus | 2026-04-11 기준 법령 조각 1,722개 |

> 전체 클라우드 자원·경계와 ADR은 [Final Architecture](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture) 문서를 참고하세요.

---

## 사용자 흐름

일반 사용자가 보는 흐름은 세 가지입니다.

- **AI 법률 상담 (login-free)** — 질문 입력 → 법령 근거가 함께 제시되는 답변 → 지원되는 문서 초안
- **계약서 검토 연결 (login)** — 계약서 검토 → 상담에 연결 → 이어지는 법률 상담 답변
- **사건 기록 (login)** — 저장된 사건 카드 제공 → 기록 삭제 시 목록에서 숨김

계약서 검토 결과는 상담을 이어가기 위한 **참고 정보(continuity)** 이며, 답변의 **법적 근거는 검색된 법령에서만** 가져옵니다.

주요 화면: 메인 / 계약서 검토 / AI 법률 상담 입력 / 답변 결과 / 문서 정보 입력 / 문서 초안 / 사건 기록 — 자세한 화면 구성은 [UI Screens](https://github.com/Team-msp-architect-2026/msp-team02/wiki/UI-Screens) 참고.

API 상세 경로와 요청/응답 구조는 [API Endpoints & Schemas](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas)를 따릅니다.

---

## Documentation

상세 설계·운영 문서는 **[GitHub Wiki](https://github.com/Team-msp-architect-2026/msp-team02/wiki)** 에서 관리합니다.

| 카테고리 | 문서 |
|---|---|
| **Start Here** | [User Flows](https://github.com/Team-msp-architect-2026/msp-team02/wiki/User-Flows) · [UI Screens](https://github.com/Team-msp-architect-2026/msp-team02/wiki/UI-Screens) · [E2E Demo Verification](https://github.com/Team-msp-architect-2026/msp-team02/wiki/E2E-Demo-Verification) |
| **Architecture** | [Final Architecture](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Final-Architecture) · [API Endpoints & Schemas](https://github.com/Team-msp-architect-2026/msp-team02/wiki/API-Endpoints-and-Schemas) |
| **Operations** | [Cloud Migration & Public Mirror Policy](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy) |

내부 계획서·운영 기록을 그대로 공개하지 않고, 현재 구현 상태와 공개 가능한 범위만 다시 정리했습니다.

---

## 범위 경계

**현재 제공:**

- 로그인 없이 사용할 수 있는 AI 법률 상담과 법령 근거가 함께 제시되는 답변
- 임금체불·부당해고 상담 → 지원되는 문서 초안
- 로그인 사용자용 계약서 검토 / 사건 기록 / 기록 삭제(목록에서 숨김)
- 계약서 검토 결과를 AI 법률 상담에 연결
- 공개 데모 도메인 `https://www.law-main-road.cloud` 연결, YouTube 시연 영상 및 MP4 백업
- `사업장 변경 사유 정리서 초안` 예시 작성 흐름

**현재 미제공:**

- 계약서 검토 결과를 바탕으로 **서버에서 새 문서 초안을 생성**하는 기능과 그 전용 로그인 API
- 독립된 상담 연결 전용 화면, Recovery 흐름
- 추가 문서 유형 및 시나리오, 완전 삭제·파일 물리 삭제·계정 삭제·복구·보관 기간 정책
- 장기 운영 배포 선언, root apex `law-main-road.cloud`, `api.` 서브도메인, `/api/**` 동일 도메인 라우팅, HTTPS Load Balancer, Cloud Armor

**클라우드 단계:** `dev` → **`demo/contest` (현재)** → `prod` (미선언)

> `사업장 변경 사유 정리서 초안`은 화면에서 제공하는 **예시 작성 흐름**이며, 서버에서 실시간으로 계약서 검토 기반 초안을 생성한다는 의미가 아닙니다. 상세 정책은 [Cloud Migration & Public Mirror Policy](https://github.com/Team-msp-architect-2026/msp-team02/wiki/Cloud-Migration-and-Public-Mirror-Policy) 참고.

---

## 보안과 개인정보 경계

공개 저장소·문서에는 다음 정보를 포함하지 않습니다.

- 인증·로컬·클라우드 비밀값, 인프라 상태 파일, 클라우드 키 파일
- 클라우드 프로젝트 식별자, 서버 직접 실행 URL, 내부 클라우드 목록
- 인증 제공자의 개인 식별자, 이메일 값, 데이터베이스 계정 식별자
- 사건 원문 데이터, 답변·초안·상담 연결 전체 원문 데이터

프론트엔드는 민감한 원문 데이터를 **브라우저 저장소에 남기지 않는 방향**으로 설계되어 있으며, 로그인 후 사용 기능은 **서버 인증 확인 이후에만** 열립니다.

---

## 개발 실행 안내

개발·배포 자동화 기준은 접근 권한이 필요한 내부 source/deploy 저장소에서 관리합니다. 이 공개 저장소만 clone한 경우 runnable source tree가 포함되지 않을 수 있습니다.

**Backend**

```bash
conda activate law_main_road
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

- backend: `http://localhost:8000`
- frontend: `http://localhost:5090`
- env templates: `backend/.env.example`, `frontend/.env.example`

**검증**

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
cd frontend && npm run build
bash scripts/demo_preflight.sh
```

기대되는 확인 신호:

- 백엔드 import 확인에서 `import_ok` 출력
- 문서 초안 검증 스크립트 정상 종료
- 프론트엔드 빌드 정상 완료
- 실시간 Vertex/OCR 확인은 인증 정보가 필요하며, 문서만 바뀐 경우에는 필수 아님

전체 검색·답변 평가는 검색, 답변 생성, 임베딩, 데이터베이스 내용, API 응답 계약이 **변경된 경우에만** 별도로 수행합니다.

---

## 참고

법대로(LawMainRoad)는 법률 정보를 정리하고 관련 근거를 확인하는 데 도움을 주는 MVP입니다. 결과는 변호사 자문, 행정기관 판단, 법원의 판단을 **대체하지 않으며**, 실제 신고·상담·소송·체류 관련 결정에는 관련 기관 또는 전문가 확인이 필요합니다.
