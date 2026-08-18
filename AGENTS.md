# Recruit ERP — Codex 작업 규칙

이 파일은 `htsHR/recruit-erp` 저장소에서 Codex가 작업할 때 항상 지켜야 하는 공통 운영 규칙입니다.
개별 작업 요구사항은 `codex-tasks/*.md`에 둡니다.

## 작업 기본 규칙
- 작업 전 원격 `main` 최신 커밋을 확인하고 동기화합니다.
- 기능 개발은 `main`에서 직접 하지 않고 `agent/...` 작업 브랜치에서 진행합니다.
- 기존 구현을 먼저 읽고 재사용하며 요청 범위 밖 대규모 리팩터링은 하지 않습니다.
- 저장소는 공개 저장소로 간주하고 실제 지원자/사원 개인정보, 실제 주민등록번호, 운영 JSON, 공용폴더 master/backup, 토큰/세션/API key/secret을 Git/GitHub/CI/artifact/log/screenshot에 넣지 않습니다.
- 테스트는 합성 데이터만 사용하고 실제 `ERP_DATA/erp-data.json`이나 backup을 fixture로 사용하지 않습니다.
- `residentNumber`는 공용 shared snapshot에서 제외 상태를 유지합니다.

## 기본 금지
개별 task가 명시적으로 허용하지 않는 한 다음을 변경하지 않습니다.
- Supabase migration
- 운영 DB schema/table/RLS
- 사용자 계정 생성/삭제
- 권한 체계
- ERP Bridge API/port/origin/token/rootPath/lock/revision/backup 정책
- shared-storage 핵심 아키텍처/schemaVersion
- 실제 운영 데이터 일괄 수정

필요해지면 자동 진행하지 말고 중단 후 보고합니다.

## 데이터 안전
- 화면 조회/미리보기만으로 데이터가 변경되면 안 됩니다.
- 실제 변경은 명시적 `적용/저장/확인` 이후에만 합니다.
- 사용자가 직접 입력한 기존 값은 자동화가 임의로 덮어쓰지 않습니다.
- 일괄 변경은 메모리에서 계산·검증 후 저장하며 저장 실패 시 전체 rollback 합니다.

## 공용폴더 저장
회사 로컬 운영 기준은 아래 구조입니다.

`ERP 웹 → 127.0.0.1 ERP Bridge → 지원팀 공용폴더/RecruitERP/ERP_DATA/erp-data.json`

- 공용폴더는 durable master입니다.
- localStorage는 cache/fallback입니다.
- 기능 작업 때문에 Bridge/공용저장 구조를 재설계하지 않습니다.
- revision/writeArmed/backup/lock/origin/token 보호를 약화시키지 않습니다.

## 테스트
- task별 핵심 테스트 + `npm run check`를 우선합니다.
- UI 변경 시 기존 `npm run test:ui-layout`이 있으면 기존 검사만 실행합니다.
- 불필요한 새 테스트 체계를 만들거나 실패 테스트를 우회하지 않습니다.

## 자동 배포
개별 task에 `AUTO_DEPLOY: YES`가 있을 때만 해당 task에 한해 다음을 진행할 수 있습니다.

핵심 테스트 PASS → PR → CI/Preview 확인 → Ready → `main` squash merge → Vercel Production 확인

다음 상황에서는 자동 병합/배포를 중단합니다.
- 핵심 테스트 또는 CI 실패
- 데이터 손상/덮어쓰기 위험
- 개인정보 노출 가능성
- 예상 밖 DB/Supabase 변경 필요
- ERP Bridge 변경 필요
- shared-storage 핵심 구조 변경 필요
- 기존 기능의 명확한 회귀

`AUTO_DEPLOY: YES`는 코드 배포 승인일 뿐 실제 운영 데이터를 자동 수정할 권한은 아닙니다.

## task 문서
사용자가 `codex-tasks/<파일>.md` 실행을 지시하면:
1. 이 `AGENTS.md`를 적용합니다.
2. 지정된 task 문서를 처음부터 끝까지 읽습니다.
3. task 문서의 범위/PASS/중단 조건을 그대로 따릅니다.
4. 개인정보·운영 데이터·DB·Bridge 안전 규칙은 항상 우선합니다.

## 기본 완료 보고
- 최종 판정: PASS / FAIL
- 변경 파일
- 핵심 구현 결과
- 핵심 테스트 결과
- PR URL
- merge commit / Production 상태(자동배포 task인 경우)
- 남은 문제
