# 한상훈 KPI Review - v8 castingn-only

## 구성
- index.html: GitHub Pages 업로드용 HTML
- 404.html: GitHub Pages 오류 페이지
- Code.gs: Google Apps Script 교체용 코드

## 핵심 변경
- 수신자를 castingn.com 주소로만 고정
  - ksbae@castingn.com
  - jaykim@castingn.com
  - snyong@castingn.com
- doGet 접속 시 버전과 수신자 목록 확인 가능
- 메일발송로그에 스크립트 버전 기록

## 배포 체크
1. Apps Script Code.gs 전체 교체
2. authorizeOnce 실행
3. testEmailOnly 실행 후 castingn.com 수신 확인
4. 배포 관리 → 새 버전 배포
5. /exec URL 직접 접속해 version: v8-castingn-only-20260720 확인
6. GitHub Pages에서 제출 테스트
