# 문서 표현 정비 검증 부록

검증일: `2026-05-14`

이 부록은 공개 README와 Wiki가 첫 읽기 문서로 자연스럽게 읽히는지, 내부 구현
약어가 필요한 기술 문맥에만 남아 있는지 확인하기 위한 재현 가능한 점검 기준입니다.
본문 문서의 canonical 설명은 [[홈|Home]], [[사용자 흐름|User-Flows]],
[[최종 아키텍처|Final-Architecture]], [[API 문서|API-Endpoints-and-Schemas]]를
따릅니다.

## 1. 표현 정비 기준

첫 읽기 문서에서는 내부 구현 표현보다 사용자 화면 이름을 우선합니다.

| 내부 표현 | 공개 문서 표현 | 예외 |
|---|---|---|
| SCN-001 / SCN-004 / SCN-005 | 계약서 검토 / AI 법률 상담 / 사건 기록 등 화면 이름 | 없음 |
| Bridge / handoff | 상담 연결 / 이어지는 상담 답변 | API path, DB table 이름 |
| frozen draft | 고정 예시 / 사업장 변경 사유 정리서 예시 | 없음 |
| login-free | 로그인 없이 사용 | 없음 |
| protected | 로그인 사용자용 / 서버 인증 확인 필요 | API 인증 설명 |
| MVP soft-delete | 기록 삭제(목록에서 숨김) | 없음 |
| route map | 화면 경로 | 없음 |

기술 문서에서는 다음 식별자를 의도적으로 보존할 수 있습니다.

- API path: `/api/v1/scn001/bridge-runs`, `/api/v1/answer`, `/api/v1/documents/draft`
- DB table: `bridge_runs`, `before_review_jobs`, `after_artifact_runs`, `users`
- API parameter: `top_k`, `ef_search`
- Auth term: Firebase Auth, Bearer Firebase ID token, Workload Identity Federation
- Image/file path: `images/screens/*.png`, `docs/video/lmr_demo_web.mp4`

## 2. 현재 잔여 hit

아래 결과는 이 검증 부록 자체를 제외하고 README, Wiki, `docs/video/README.md`를
스캔한 기준입니다.

| 표현 | 잔여 hit | 판정 |
|---|---:|---|
| `SCN-` | 0 | OK |
| `Bridge` | 6 | OK, 전부 API path 또는 DB table 식별자 |
| `handoff` | 0 | OK |
| `frozen draft` | 0 | OK |
| `login-free` | 0 | OK |
| `protected` | 0 | OK |
| `MVP soft-delete` | 0 | OK |
| `route map` | 0 | OK |

`Bridge` 잔여 6건:

```text
API-Endpoints-and-Schemas.md: /api/v1/scn001/bridge-runs path 5건
Data-Model-and-Privacy.md: bridge_runs table 1건
```

설명문은 모두 상담 연결 또는 기록으로 풀어 쓰고, 코드형 식별자가 필요한 위치에만
영문 명칭을 남깁니다.

## 3. 정합성 확인 항목

- README와 Home은 public demo URL, demo video, 구현 기준일, 장기 운영 미제공 경계를
  같은 의미로 설명합니다.
- `browserSessionPersistence`는 ADR, Security, Data Model에서 같은 정책으로
  설명합니다.
- 계약서 검토 맥락은 continuity/reference이며 legal grounding이 아니라는 설명을
  유지합니다.
- `/api/v1/answer`와 `/api/v1/documents/draft` public contract를 문서 편의로
  확장하지 않습니다.
- `사업장 변경 사유 정리서 초안`은 화면 내 deterministic 예시이며 live/backend
  계약서 검토 기반 초안 생성이 아닙니다.
- 기록 삭제는 목록에서 숨김이며 hard delete, artifact purge, retention lifecycle,
  account deletion을 제공한다고 쓰지 않습니다.
- public demo domain은 `demo/contest` 상태이며 `prod` 오픈이나 장기 운영 서비스를
  의미하지 않습니다.
- public mirror에는 deploy credential, Terraform state, service account key JSON,
  raw user/case data, direct backend URL을 넣지 않습니다.

## 4. 데모 영상 확인 항목

공개 문서의 첫 확인 링크는 YouTube 시연 영상을 가리킵니다. GitHub README/Wiki는
YouTube iframe player를 허용하지 않으므로 thumbnail image를 클릭하면 YouTube로
이동하는 방식으로 안내합니다. MP4 파일은 브라우저 환경에 따라 바로 열리거나
다운로드될 수 있는 백업 파일입니다.

```text
https://youtu.be/fFEPP3KtHMs
docs/video/lmr_demo_web.mp4
```

`docs/video/lmr_demo_web.mp4`는 web-optimized MP4 백업 파일입니다. 로컬 원본
`docs/video/lmr_demo.mp4`는 GitHub 일반 파일 제한을 넘을 수 있으므로 public mirror
commit 대상에서 제외합니다.

## 5. 재현 명령

```bash
# 내부 표현 잔여 hit
for term in 'SCN-' 'Bridge' 'handoff' 'frozen draft' \
            'login-free' 'protected' 'MVP soft-delete' 'route map'; do
  printf '%s ' "$term"
  rg -i --glob '*.md' --glob '!Verification-Wording-Replacement.md' \
    "$term" docs/github/README.md docs/github/wiki docs/video/README.md | wc -l
done

# 의도적으로 남은 Bridge hit 확인
rg -n --glob '*.md' --glob '!Verification-Wording-Replacement.md' \
  -i 'Bridge' docs/github/README.md docs/github/wiki docs/video/README.md

# 데모 영상 크기 확인
find docs/video -maxdepth 1 -type f -printf '%f %s\n' | sort
```

## 6. 한계

- GitHub Wiki raw URL은 짧게 캐시될 수 있습니다. HTML 화면과 raw 화면이 다르면
  HTML 화면을 우선 확인하고 raw는 cache-buster를 붙여 다시 확인합니다.
- 이 부록의 hit 수는 문자열 검색 기준입니다. 의미 정합성은 첫 읽기 문서를 직접
  읽어 확인합니다.
