# 테스트 전략

## 목표 (Goals)

Testing은 데모 안정성, 공개 API 계약 안정성, 개인정보 경계 보존에
초점을 둡니다.

## 집중 확인 명령 (Focused Checks)

```bash
python -c "from backend.main import app; print('import_ok')"
python backend/verify/check_document_draft.py
cd frontend
npm run build
```

## 데모 사전 점검 (Demo Preflight)

```bash
bash scripts/demo_preflight.sh
```

검색, 답변 생성, 임베딩, 데이터베이스, API 계약 동작이 바뀌지 않은
QA/문서 작업에는 이 command를 사용합니다.

## 전체 Retrieval / Answer 평가

전체 답변 근거 평가는 다음 중 하나가 바뀐 경우에만 실행합니다.

- retrieval behavior
- answer generation behavior
- embedding behavior
- DB contents
- public API response contract

PASS / PARTIAL / FAIL 근거가 필요할 때는 item-level evidence tooling을
사용합니다. 전체 60개 답변 근거 보고서를 `scripts/demo_preflight.sh`에
추가하지 않습니다.

## Refusal / Out-of-scope Evaluation

Refusal/out-of-scope eval runner exists but first live run identified a known
gap. The result is recorded as measurement stabilization evidence, not as a
passing headline score. The current answer path is citation-first and lacks
explicit refusal mode, so out-of-scope prompts can still produce cited articles
or fail citation validation when the model tries to refuse without citations.

See [[RAG 평가|RAG-Evaluation]] for the recorded result and follow-up TODOs.

## 수동 브라우저 확인

권장 수동 확인:

- `임금체불·부당해고 상담` 예시 답변 -> 문서 정보 입력 -> 초안
- 문서 초안 복사와 브라우저 인쇄
- 로그인, 계약서 검토, 상담 연결, 이어지는 답변
- 사건 기록 표시와 기록 삭제
- AI 법률 상담 화면의 저장 사건 선택
- 로그아웃 후 화면 상태 초기화

## 문서만 변경한 경우

Wiki만 바뀐 경우의 예상 검증은 문서 중심입니다.

- 파일 목록과 링크 존재 확인
- README/Wiki의 YouTube 시연 영상과 MP4 백업 링크가 올바른지 확인
- 공개 문서 부적합 표현 검색
- GitHub Wiki link syntax scan
- `git diff` review scoped to `docs/github`
- backend, frontend, schema, API, Terraform, infra edits 없음

## 알려진 런타임 리스크

- provider timeout은 일시적일 수 있습니다.
- OCR과 실시간 provider 호출에는 재시도가 필요할 수 있습니다.
- 클라우드 전환은 개발 환경 우선 검증 상태로 유지합니다.

## 함께 보기

- [[트러블슈팅 런북|Runbook-Troubleshooting]]
- [[프로젝트 수행 및 완성|Project-Execution-and-Completion]]
- [[E2E 데모 검증|E2E-Demo-Verification]]
