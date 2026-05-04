# law_main_road (아직 초안 문서입니다. 이 저장소는 프로젝트 마무리 후 결과 코드 및 문서만을 다룹니다. 개발과정은 저희 팀의 organization에서 확인하실 수 있습니다. 마무리 문서 작업 후 팀 organization을 공개하도록 하겠습니다.)

외국인 근로자를 포함한 취약 노동자를 위한 노동권 보호 AI MVP입니다.

현재 저장소는 법령 RAG, grounded answer generation, SCN-004 문서 초안,
SCN-001 Firebase Auth 기반 Before/Bridge/After 연결, 기록 조회/삭제 UI까지
구현한 상태입니다.

## Current Status

기준일: `2026-05-04`

- law corpus: `backend/data/law_chunks/all_chunks.json`
- selected snapshot: `selected_as_of = 2026-04-11`
- live chunks: `1722`
- backend: FastAPI + PostgreSQL + pgvector
- frontend: Next.js `16.2.4`, React `19.2.5`
- auth: Firebase Auth Google Sign-In + backend Firebase Admin verification
- answer model default: `gemini-2.5-flash`
- embedding model default: `gemini-embedding-001`, `768` dimensions
- latest main checkpoint: `e79fa68`

Implemented user routes:

- `/`
- `/before`
- `/after`
- `/after/result`
- `/after/intake`
- `/after/draft`
- `/history`

Main implemented flows:

- SCN-004 login-free After flow:
  `/after -> /after/result -> /after/intake -> /after/draft`
- SCN-001 protected Before/Bridge/After answer linkage
- SCN-001 protected history archive and MVP soft-delete
- SCN-001 exact fixed-preset frontend-local frozen draft flow
- SCN-004 exact fixed-preset answer fixture for stable demo rehearsal
- integrated frontend UI polish through visual checkpoint `85d10fa`, with
  later workspace/draft-scope documentation alignment through `e79fa68`:
  - Before first screen is upload-focused, removes local server/demo copy,
    preserves examples, improves loading scroll and OCR 1~2분 guidance, cleans
    result/accessibility layout, and removes hardcoded default accessibility
    legal basis
  - After entry is centered, adds guidance cards, improves preset display labels
    without changing preset id/query, restores the entry disclaimer, and uses
    primary-blue / success-green saved-history connection accents
  - History is centered with readable folded incident cards and blue left accent
  - Main page has cleaner H1/lead/nav typography and a compact flow strip
  - `DESIGN.md` is the current visual guide: token-first,
    neutral/dense/evidence-led, with disclaimers and uncertainty prominent

Not opened:

- live/backend SCN-001 document draft generation
- protected SCN-001 draft endpoint
- independent `/bridge` route
- Recovery implementation
- SCN-005 frontend/document draft expansion
- Step 3 full retention lifecycle
- public contract changes for `/api/v1/answer` or `/api/v1/documents/draft`

## GitHub Docs

Readable GitHub-facing docs are separated from internal planning notes:

- [docs/github/README.md](docs/github/README.md)
- [docs/github/project-overview.md](docs/github/project-overview.md)
- [docs/github/system-architecture.md](docs/github/system-architecture.md)
- [docs/github/user-flows.md](docs/github/user-flows.md)
- [docs/github/api-reference.md](docs/github/api-reference.md)
- [docs/github/runbook.md](docs/github/runbook.md)

Internal phase records remain under `docs/planning/`. The current code-based
checkpoint is
[docs/planning/23_code_based_status_2026_04_29.md](docs/planning/23_code_based_status_2026_04_29.md).

## Repository Layout

| Path | Role |
|---|---|
| `backend/` | FastAPI app, retrieval, answer generation, document draft, auth, DB |
| `frontend/` | Next.js app routes and UI state |
| `scripts/` | legal corpus preprocessing pipeline |
| `data/legalize-kr/` | upstream law source submodule |
| `backend/data/law_chunks/` | processed law chunk output |
| `docs/planning/` | internal phase/status planning notes |
| `docs/github/` | public-facing GitHub documentation |
| `docs/product/` | product flow notes |
| `docs/ops/` | local setup and operations notes |
| `eval/` | retrieval/answer eval assets |

## Quick Start

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

Default URLs:

- backend: `http://localhost:8000`
- frontend: `http://localhost:5090`

Environment templates:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

## Verification

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

Run broad retrieval/answer eval only when retrieval, answer generation,
embedding behavior, DB contents, or API response contracts change.

## Privacy Boundaries

- Do not commit credential JSON, local env files, DB files, Firebase ID tokens,
  provider subjects, or raw email values.
- Raw `user_statement`, full answer/draft payloads, case intake, raw Bridge
  payloads, and raw `after_query_seed` are not stored in browser storage.
- SCN-001 Bridge context is continuity/reference only, not legal grounding.
- `data/legalize-kr/` and `backend/data/law_chunks/` are not edited directly.
