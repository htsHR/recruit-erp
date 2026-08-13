# Recruit ERP Bridge

회사 로컬 모드의 ERP와 지원팀 공용폴더를 연결하는 Windows 10/11 x64용 portable 프로그램입니다.

- `127.0.0.1:17840`에만 연결합니다.
- 허용된 ERP Preview Origin 하나만 CORS로 허용합니다.
- 브라우저 요청으로 Windows 경로를 받지 않습니다.
- 실행할 때 지정한 `RecruitERP` 루트와 그 아래 `ERP_DATA`만 접근합니다.
- Node.js, npm, Git, 설치 프로그램, 관리자 권한이 필요하지 않습니다.

## 회사 PC 실행

```text
ERP-Bridge.exe "Z:\RecruitERP"
```

UNC 경로도 사용할 수 있습니다.

```text
ERP-Bridge.exe "\\공용서버\지원팀\RecruitERP"
```

Bridge는 창을 닫거나 `Ctrl+C`를 누르면 종료됩니다.

## 저장 API

- `GET /health`: Bridge 연결과 메모리 전용 세션 토큰 확인
- `POST /shared-folder-test`: 100KB 가상 파일 쓰기·재읽기·hash·삭제 진단
- `GET /storage/status`: master 존재·스키마·revision·저장시각·건수 확인
- `GET /storage/snapshot`: 검증된 master 읽기
- `POST /storage/initialize`: master가 없을 때만 최초 생성
- `PUT /storage/snapshot`: `expectedRevision`이 일치할 때만 갱신

`/health` 이외의 API는 허용 Origin과 `X-ERP-Bridge-Token`을 모두 확인합니다. 토큰은 Bridge 프로세스 메모리에만 있고 종료 시 폐기됩니다.

## 안전 저장

공용 master는 직접 덮어쓰지 않습니다. 기존 master 백업, 임시 파일 쓰기와 flush, 재읽기와 SHA-256·JSON 검사, master 교체, 최종 검증 순으로 저장합니다. exclusive 잠금으로 동시 쓰기를 막고 백업은 최근 20개를 유지합니다.

네트워크 공용폴더에서 rename·delete 시 일시적인 `EBUSY` 또는 `EPERM`이 발생하면 300ms부터 점진적으로 최대 5회 재시도합니다. 마지막 재시도 뒤 파일이 실제로 존재하는지를 최종 기준으로 사용합니다.

## 개발용 빌드

```text
npm run build:bridge:windows
npm run test:bridge-exe
```

생성 파일은 `dist/ERP-Bridge.exe`입니다. portable 검사는 개인정보 없는 약 5MB 가상 snapshot을 저장하고 다시 읽어 hash를 확인합니다.
