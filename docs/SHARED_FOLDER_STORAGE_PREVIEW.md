# 회사 공용폴더 저장 Preview

## 실행

1. 지원팀 공용폴더에 `RecruitERP` 폴더를 준비합니다.
2. 회사 PC에서 아래처럼 portable Bridge를 실행합니다.

```text
ERP-Bridge.exe "Z:\RecruitERP"
```

3. ERP Preview에 접속합니다.
4. `저장소·속도`에서 공용 저장 상태를 확인합니다.

Bridge는 `127.0.0.1:17840`에만 연결되며 창을 닫거나 `Ctrl+C`로 종료합니다. Node.js, npm, Git, 설치 프로그램, 관리자 권한은 필요하지 않습니다.

## 최초 초기화

공용폴더에 master가 없으면 ERP가 현재 PC의 지원자·입사대기·사원·학교·일정 건수를 보여줍니다. 자동 업로드하지 않으며 관리자가 `현재 데이터로 공용 저장소 시작`을 눌렀을 때만 다음 파일을 만듭니다.

```text
RecruitERP/
└─ ERP_DATA/
   ├─ erp-data.json
   └─ backup/
```

실제 운영데이터 초기화 전에는 회사 PC에서 개인정보 없는 약 5MB 가상 snapshot의 저장·재읽기·hash 검증을 한 번 통과해야 합니다.

## 저장과 충돌

- 공용 master의 `revision`은 정상 저장 때마다 1씩 증가합니다.
- 앱 시작 시 공용 쓰기는 잠긴 상태입니다. 최초 초기화 또는 최신 master 불러오기가 성공해야 메모리 전용 쓰기 승인이 열리며, 그전 변경은 현재 브라우저 cache에만 남습니다.
- 마지막 확인 revision은 개인정보 없는 로컬 메타정보로만 저장합니다. master revision과 같으면 재접속 시 저장 준비 상태가 되고, 다르면 다시 확인해야 합니다. 이 메타정보는 공용 snapshot에 포함하지 않습니다.
- 저장 요청의 `expectedRevision`이 master와 다르면 HTTP 409로 차단합니다.
- 쓰기 전 `.erp-write.lock`을 독점 생성합니다. 활성 잠금은 지우지 않고 저장을 거부하며, 15분이 지난 잠금만 만료 규칙에 따라 복구합니다.
- 기존 master 백업 → 임시 파일 쓰기와 flush → 재읽기와 hash·JSON 검사 → master 교체 → 최종 검증 순서로 저장합니다.
- 백업은 `ERP_DATA/backup`에 최근 20개만 남깁니다. 백업 정리 실패는 master 저장을 취소하지 않지만 화면에 경고합니다.
- 네트워크 폴더의 rename·delete가 `EBUSY` 또는 `EPERM`이면 300ms부터 점진적으로 최대 5회 재시도하고, 마지막에 파일 존재 여부로 성공을 판단합니다.

## 새 PC 복구

새 회사 PC에서 같은 공용폴더를 지정해 Bridge를 실행하고 ERP에 접속하면 정상 master를 감지합니다. 브라우저 cache가 비어 있을 때만 검증된 master를 자동 적용합니다. 기존 cache가 있는 PC에서는 사용자가 확인 버튼을 누르기 전까지 덮어쓰지 않습니다.

## 보안과 제한

- `/health` 이외의 API는 허용 Origin과 실행 때 만든 메모리 전용 토큰을 모두 요구합니다.
- 토큰은 파일, 공용폴더, Git, Vercel, 로그, localStorage에 저장하지 않고 Bridge 종료 때 폐기됩니다.
- 브라우저에서 Windows 경로를 받는 API, 파일·폴더 선택창, 업로드, `FormData`, `sendBeacon`을 사용하지 않습니다.
- snapshot 전송 대상은 `http://127.0.0.1:17840`뿐이며 `credentials: omit`, `cache: no-store`를 사용합니다.
- 로그인 세션, 인증 토큰, API key, 비밀번호, 암호화 key, 임시 cache, UI 일회성 상태는 저장하지 않습니다.
- `residentNumber`를 제거하고 최종 문자열에서 주민등록번호 형태의 값이 발견되면 값 노출 없이 저장을 차단합니다.
- 파일 형식·스키마·안전 트리·데이터셋·행 ID·중복·행 수·깊이·노드 수·문자열 길이 검사가 끝나기 전에는 브라우저 cache를 변경하지 않습니다.
- 이 Preview는 실제 운영데이터로 시험하지 않으며 `main`과 Production에 반영하지 않습니다.
