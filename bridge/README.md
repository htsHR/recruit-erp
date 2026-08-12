# Recruit ERP Bridge PoC

이 프로그램은 ERP Preview와 회사 PC의 로컬 프로그램이 통신 가능한지만 확인하는 Windows 10/11 x64용 portable 실행파일입니다.

- `127.0.0.1:17840`에만 연결됩니다.
- 지정된 ERP Preview Origin 하나만 CORS로 허용합니다.
- `GET /health` 외의 기능이 없습니다.
- 파일, ERP 데이터, localStorage, Supabase 및 DB에 접근하지 않습니다.

## 회사 PC 실행

`ERP-Bridge-Test.exe`를 더블클릭합니다. Node.js, npm, Git, 관리자 권한 및 설치 프로그램은 필요하지 않습니다.

Bridge는 `127.0.0.1:17840`에서 대기하며, 창을 닫거나 `Ctrl+C`를 누르면 종료됩니다.

## 개발용 빌드

개발 환경에서 `npm run build:bridge:windows`를 실행하면 `dist/ERP-Bridge-Test.exe`가 생성됩니다. 회사 PC에는 이 실행파일 하나만 전달합니다.
