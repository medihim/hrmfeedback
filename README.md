# 한상훈 KPI Review Page - GitHub Clean Initial Version

이 패키지는 GitHub Pages 기본 Branch 배포 방식으로 사용하기 위한 초기형 정적 HTML 구성입니다.

## 업로드 구조

저장소 최상위에 아래 파일이 바로 위치해야 합니다.

```
index.html
404.html
.nojekyll
README.md
```

`.github/workflows` 폴더는 포함하지 않았습니다. GitHub Actions 배포를 사용하지 않고, GitHub Pages의 기본 Branch 배포를 사용합니다.

## GitHub Pages 설정

Settings → Pages에서 아래처럼 설정합니다.

- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

## 접속 비밀번호

- PW: 3370

## 제출 연동

HTML 내부 `SUBMIT_ENDPOINT`에는 아래 Apps Script URL이 연결되어 있습니다.

```
https://script.google.com/a/macros/castingn.com/s/AKfycbzrbwMuAh-osgna_G1cRjAAwb0HOS55InJYO8TQePyOK53hx0sKhnuShF1wSJB6P1M/exec
```

Apps Script에는 `doGet`, `doPost`가 포함되어 있어야 하며, 수신자는 다음입니다.

- ksbae@castingn.com
- jaykim@medihim.com
- snyong@medihim.com

