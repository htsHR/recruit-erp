# v12.0.2 — Full Factory Reset Permanent

## 영구 초기화

- 첫 화면 전에 승인된 Recruit ERP localStorage 키 41개와 폐기 대상 프로젝트 인증 접두키만 삭제합니다.
- IndexedDB `recruit-erp-storage-v10-61` 삭제를 완료하고 검증한 뒤 data epoch를 기록합니다.
- 삭제가 막히거나 실패하면 업무 자료를 읽지 않고 화면을 fail-closed 상태로 유지합니다.
- 다른 웹앱 localStorage와 v12.0.2 초기화 뒤 새로 저장한 업무 자료는 보존합니다.

## LOCAL ONLY 영구 전환

- 원격 인증·DB·동기화·삭제 재시도·RLS 관련 런타임 파일과 SQL migration을 제거했습니다.
- 지원자·사원·학교·일정·입사대기·백업·변경 이력은 브라우저 저장만 사용합니다.
- 브라우저의 공용폴더 Bridge 연결과 공용 master 자동 저장을 제거했습니다.
- Vercel CSP `connect-src`는 `'self'`만 허용합니다.
- Vercel의 원격 프로젝트 연결 설정은 코드 배포 뒤 제거하고, Production 독립 동작 확인 뒤 승인된 정확한 프로젝트만 영구 삭제합니다.

## 운영 후 OWNER 수동 작업

- 회사 PC Bridge 실행파일과 공용폴더 실파일 정리
- 프로젝트 삭제 뒤 GitHub에 남은 OAuth 승인 연결 해제

## 검증

- 실제 개인정보나 운영 데이터를 사용하지 않습니다.
- 초기화 범위·IDB·fail-closed·LOCAL ONLY CRUD·라우팅·화면·보안 헤더·Production 독립 실행을 자동 확인합니다.
