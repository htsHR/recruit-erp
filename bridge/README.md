# Recruit ERP Bridge

회사 로컬 모드 ERP와 지원팀 공용폴더를 연결하는 Windows 10/11 x64 portable 프로그램입니다.

- `127.0.0.1:17840`에서만 대기합니다.
- Preview 실행파일은 Preview Origin 하나만, Production 실행파일은 `https://recruit-erp.vercel.app` 하나만 허용합니다.
- 브라우저 요청으로 Windows 경로를 받지 않습니다.
- 설정된 `RecruitERP` 루트와 그 아래 `ERP_DATA`만 접근합니다.
- Node.js, npm, Git, 설치 프로그램, 관리자 권한이 필요하지 않습니다.

## 설정파일과 더블클릭 실행

`ERP-Bridge.exe`와 같은 폴더에 `bridge-config.json`을 둡니다.

```json
{
  "rootPath": "Z:\\RecruitERP",
  "autoStart": false
}
```

UNC 경로도 사용할 수 있습니다.

```json
{
  "rootPath": "\\\\공용서버\\지원팀\\RecruitERP",
  "autoStart": false
}
```

이후에는 EXE를 더블클릭하면 됩니다. 설정파일은 `rootPath`와 `autoStart`만 허용하며 토큰·인증정보·개인정보를 저장하지 않습니다.

## 현재 사용자 Windows 자동시작

최초 설정 때 `autoStart`를 `true`로 바꾸고 Bridge를 한 번 실행하면 현재 사용자 시작프로그램에 실행 항목을 등록합니다. 관리자 권한은 사용하지 않습니다. Windows 로그인 직후 공용폴더가 아직 준비되지 않아도 Bridge는 종료하지 않고 10초 간격으로 연결을 다시 확인합니다.

정상 운영 흐름은 다음과 같습니다.

```text
Windows 로그인 → Bridge 자동 시작 → ERP 접속 → 공용 master 자동 연결
```

## 빌드 결과

- `dist/ERP-Bridge-Preview.exe`: Preview Origin 전용
- `dist/ERP-Bridge.exe`: `https://recruit-erp.vercel.app` 전용
- `dist/bridge-config.json`: 회사 PC에서 경로만 1회 설정하는 파일

```text
npm run build:bridge:windows
npm run test:bridge-exe
```

portable 검사는 두 EXE를 인자 없이 실행해 설정파일을 읽는지, 각 Origin만 허용하는지, 현재 사용자 자동시작 등록이 관리자 권한 없이 가능한지 확인합니다. Production 배포나 main 병합을 수행하는 명령은 포함하지 않습니다.

## 저장 안전성

`/health` 이외의 API는 허용 Origin과 메모리 전용 토큰을 모두 확인합니다. 공용 master는 기존 파일 백업, 임시 파일 쓰기와 flush, 재읽기와 SHA-256·JSON 검증, master 교체, 최종 검증 순서로 저장합니다. exclusive 잠금으로 동시 쓰기를 막고 백업은 최근 20개만 유지합니다.
