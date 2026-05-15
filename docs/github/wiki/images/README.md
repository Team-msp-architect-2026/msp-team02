# Wiki 이미지

이 폴더는 GitHub Wiki에 사용할 공개 이미지, 다이어그램, 스크린샷의 staging
위치입니다.

## 현재 포함된 이미지

| File | 용도 | 공개 기준 |
|---|---|---|
| `architecture/cloud-migration-overview.png` | cloud migration overview | 내부 drawio export에서 프로젝트명과 공개 경계에 맞게 정리한 공개용 이미지 |
| `architecture/cloud-migration-detail.png` | cloud migration detail | 내부 drawio export에서 비공개 식별자와 원문 데이터 관련 경계를 제거한 공개용 이미지 |
| `screens/home-hero.png` | public home first viewport | sample/demo data only |
| `screens/home-scroll.png` | public home scrolled overview | sample/demo data only |
| `screens/before-contract-part-time.png` | Before contract review example | sample/demo data only |
| `screens/before-contract-accessibility.png` | Before contract review accessibility example | sample/demo data only |
| `screens/after-consult-dismissal.png` | After legal consultation example | sample/demo data only |
| `screens/after-consult-foreign-worker.png` | After foreign worker consultation example | sample/demo data only |
| `screens/history-records.png` | 로그인 사용자용 사건 기록 화면 예시 | sample/demo data only |
| `screens/scn001-before-progress.png` | 계약서 검토 진행 화면 | sample/demo data only |
| `screens/scn001-before-scroll.png` | 계약서 검토 스크롤 결과 | sample/demo data only |
| `screens/scn001-before-foreign-worker-result.png` | 외국인 근로자 계약서 검토 결과 | sample/demo data only |
| `screens/scn001-after-entry.png` | AI 법률 상담 입력 화면 | sample/demo data only |
| `screens/scn001-result.png` | 답변 결과 화면 | sample/demo data only |
| `screens/scn001-draft.png` | 초안 화면 | sample/demo data only |
| `screens/scn001-consult-draft.png` | 법률 상담에서 초안 생성 화면 | sample/demo data only |

Wiki page embeds should use constrained widths and link to the original PNG.
Tall screenshots are kept as original files so reviewers can open full-resolution
evidence without crowding the default page view.
ASCII file names are preferred for embedded wiki images because GitHub Wiki's
rendered image route is more reliable with URL-safe paths.

이미지를 추가하기 전에 다음 항목을 제거합니다.

- 실제 사용자/사건 사실관계
- credential values and email values
- 인증 제공자 subject 식별자와 데이터베이스 계정 식별자
- cloud identity emails
- 비공개 클라우드 리소스 식별자
- 서버 직접 실행 URL
- cloud secret values or names that reveal private architecture

권장 공개 assets:

- high-level architecture diagram
- 샘플 데이터만 보이는 Before/After/History 사용자 화면 스크린샷
- 데모 흐름 다이어그램
- 비공개 식별자를 제거한 클라우드 전환 상태 다이어그램
