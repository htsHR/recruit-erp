# Recruit ERP Bridge 공용폴더 PoC

이 프로그램은 ERP Preview에서 회사 지원팀 공용폴더의 읽기/쓰기가 가능한지만 확인하는 Windows 10/11 x64용 portable 실행파일입니다.

- `127.0.0.1:17840`에만 연결됩니다.
- 지정된 ERP Preview Origin 하나만 CORS로 허용합니다.
- `GET /health`와 `POST /shared-folder-test`만 제공합니다.
- 브라우저 요청으로 Windows 경로를 받지 않습니다.
- 실행할 때 지정한 `RecruitERP_TEST` 폴더 하나만 접근합니다.
- 실제 ERP 데이터, 개인정보, localStorage, Supabase 및 DB에는 접근하지 않습니다.

## 회사 PC 실행

1. 지원팀 공용폴더에 `RecruitERP_TEST` 폴더를 미리 만듭니다.
2. 명령 프롬프트에서 실행파일과 폴더 경로를 함께 실행합니다.

```text
ERP-Bridge-Test.exe "Z:\지원팀\RecruitERP_TEST"
```

UNC 경로도 사용할 수 있습니다.

```text
ERP-Bridge-Test.exe "\\공용서버\지원팀\RecruitERP_TEST"
```

Node.js, npm, Git, 관리자 권한 및 설치 프로그램은 필요하지 않습니다. Bridge는 `127.0.0.1:17840`에서 대기하며, 창을 닫거나 `Ctrl+C`를 누르면 종료됩니다.

## 테스트 동작

`POST /shared-folder-test`는 고유 이름의 테스트 파일을 독점 생성하고 약 100KB의 가상 문자열을 기록합니다. 다시 읽어 크기와 SHA-256을 검증한 뒤 파일을 삭제하고, 실제로 삭제됐는지 확인합니다. 기존 파일은 열거나 변경하지 않습니다.

오류 응답에는 단계 코드만 포함하고 실제 공용폴더 경로나 Windows 오류 원문은 포함하지 않습니다. 원본 Windows 오류는 외부로 전송하지 않고 Bridge 실행 창에서만 확인할 수 있습니다.

## 개발용 빌드

개발 환경에서 `npm run build:bridge:windows`를 실행하면 `dist/ERP-Bridge-Test.exe`가 생성됩니다. 회사 PC에는 이 실행파일 하나만 전달합니다.
