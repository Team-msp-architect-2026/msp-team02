# 데모 영상

이 폴더는 public mirror README와 GitHub Wiki에서 연결할 데모 영상을 둡니다.

## 공개 문서 연결 대상

- `lmr_demo_web.mp4`

README와 Wiki의 대표 영상 링크는 YouTube 시연 영상입니다.

```text
https://youtu.be/fFEPP3KtHMs
```

GitHub README/Wiki는 YouTube iframe player를 허용하지 않으므로, 공개 문서에서는
YouTube thumbnail image를 크게 보여 주고 클릭 시 YouTube 영상으로 이동하도록
연결합니다.

`lmr_demo_web.mp4`는 web-optimized MP4 백업 파일입니다. GitHub의 repo file viewer는
MP4를 바로 재생하지 않고 다운로드 화면을 보일 수 있으므로, 공개 문서의 첫 확인
자료는 YouTube 링크를 기준으로 안내합니다.

## 로컬 원본

- `lmr_demo.mp4`

`lmr_demo.mp4`는 로컬 원본 영상입니다. 현재 파일 크기가 GitHub 일반 파일 업로드
제한을 넘을 수 있으므로 일반 git commit 대상에서 제외합니다. 원본이 필요하면
로컬 작업 디렉터리에서만 보관하고, public mirror에는 web-optimized copy를 사용합니다.

## 공개 전 확인

영상에는 다음 항목이 포함되지 않아야 합니다.

- 실제 사용자/사건 원문
- 인증 토큰 또는 이메일 값
- 서버 직접 실행 URL
- 클라우드 리소스 식별자
- 비밀값, credential, 내부 runbook
