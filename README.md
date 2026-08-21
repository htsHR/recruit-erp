# Recruit ERP

[![ERP 자동 검사](https://github.com/htsHR/recruit-erp/actions/workflows/quality-checks.yml/badge.svg?branch=main)](https://github.com/htsHR/recruit-erp/actions/workflows/quality-checks.yml)

채용 지원자, 일정, 사원명부와 협력학교를 관리하는 웹 ERP입니다. 현재 운영 버전은 **v12.1.0**이며, 외부 계정·원격 데이터베이스 없이 브라우저 안에서만 동작하는 **LOCAL ONLY** 버전입니다.

운영 홈페이지: https://recruit-erp.vercel.app

## v12.0.2 영구 공장 초기화

v12.0.2를 처음 여는 브라우저에서는 승인된 Recruit ERP 저장영역을 한 번만 영구 초기화합니다.

- 명세에 고정된 Recruit ERP localStorage 키 41개
- 폐기 대상 프로젝트의 브라우저 인증 접두키
- IndexedDB `recruit-erp-storage-v10-61`
- 해당 DB의 `datasets`, `snapshots`, `snapshotMeta` 자료

초기화가 모두 성공하고 검증된 뒤에만 `recruit_erp_data_epoch=v12.0.2-reset-1`을 기록하고 업무 화면을 엽니다. 삭제가 막히거나 검증에 실패하면 epoch를 기록하지 않고 업무 화면을 차단합니다. 다른 웹앱의 localStorage 키는 삭제하지 않습니다.

초기화 뒤 새로 입력한 자료는 다음 접속에도 유지됩니다. v12.0.2 epoch가 있는 브라우저에서는 공장 초기화를 반복하지 않습니다.

## LOCAL ONLY 저장

- 지원자·사원·학교·일정·입사대기·안내문 등 업무 자료는 현재 브라우저에만 저장됩니다.
- 업무 저장은 localStorage를 사용하고, IndexedDB 안전 복사와 최대 5개 안전 스냅샷을 보조 계층으로 사용합니다.
- 원격 로그인, 계정 세션 복원, 원격 읽기·쓰기·삭제·동기화, 공용폴더 자동 연결을 실행하지 않습니다.
- 기존 원격 설정·migration·인증·동기화 클라이언트와 브라우저 Bridge 연결 코드는 배포 자산에서 제거했습니다.
- Content Security Policy의 네트워크 연결 대상은 같은 출처(`'self'`)만 허용합니다.
- 중요한 대량 변경 전에는 백업센터에서 암호화 백업을 직접 내려받으세요.

기존 회사 PC의 Bridge 실행파일과 공용폴더 실파일 삭제는 Production 배포 뒤 OWNER가 직접 수행합니다. 웹앱은 더 이상 해당 파일에 연결하거나 변경하지 않습니다.

## 자료를 안전하게 다루는 규칙

- 실제 지원자·사원 정보는 테스트에 사용하지 않습니다.
- 업데이트 검사는 개인정보 없는 가상 자료만 사용합니다.
- JSON Import 전에는 변경 미리보기를 확인합니다.
- CSV/XLSX 내보내기의 `=`, `+`, `-`, `@` 시작값은 일반 텍스트로 방어합니다.
- 자리를 비울 때는 개인정보 화면 잠금을 사용합니다.
- 출처가 불분명하거나 구조·ID 검사에 실패한 JSON 파일은 가져오지 않습니다.
- 브라우저 삭제, 기기 교체, 시크릿 모드 종료 시 자료를 복원할 수 없으므로 암호화 백업을 별도로 보관합니다.

## 자동 검사

Pull Request와 `main` 변경에서는 다음을 검사합니다.

- v12.0.2 공장 초기화의 정확한 키 범위, 인증 접두키, IndexedDB 삭제와 fail-closed 처리
- 초기화 1회 실행과 이후 신규 자료 유지
- 원격 인증·데이터·동기화·Bridge 네트워크 요청 0건
- 지원자·사원·학교·일정 LOCAL ONLY 저장·새로고침·삭제
- 저장 실패 원상복구, 권한 보호, 변경 이력, 암호화 백업
- CSV/XLSX 수식 주입 방어와 Import 안전 검사
- 전체 JavaScript 문법과 버전 일치
- Playwright 기반 화면·라우팅·역할별 UI 검사
- 지원자 9열 목록, 13개 허용 필드 빠른 수정, 미저장 이탈 보호
- 지원구분 명시값 유지와 자동평가·지원자 담당자 UI 제거
- Vercel 보안 헤더와 Production 응답

### 로컬 테스트

Node.js 20 이상과 Chrome 또는 Edge에서 실행합니다.

```text
npm ci
npm run check
npm run test:ui-layout
```

로컬 UI 스크린샷은 기본적으로 `artifacts/ui-v12.1.0`에 저장됩니다. 실제 개인정보가 포함된 화면·로그·trace·artifact는 만들지 않습니다.

자세한 변경 내역은 `CHANGELOG_v12.1.0.md`를 확인하세요.
