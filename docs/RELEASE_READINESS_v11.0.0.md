# Recruit ERP v11.0.0 릴리스 준비 점검표

v11은 자동검사 통과만으로 운영 준비 완료가 되지 않습니다. 코드·배포 자동검사와 사람의 운영 훈련을 모두 확인합니다.

## 자동 통과 조건

- JavaScript 문법 검사와 모든 `*.test.js` 통과
- Playwright 5개 뷰포트와 1366×768 125% 확대 통과
- 관리자·채용담당자·조회전용 화면 회귀 통과
- 암호화 백업, 잘못된 비밀번호, 변조, 안전 복원, 저장 실패 원상복구 통과
- 삭제 대기·재시도·재등장 방지 검사 통과
- 개인정보 내보내기·감사로그 마스킹 검사 통과
- 지원자 5,000명·사원 1,000명·학교 500개 가상 성능 검사 통과
- GitHub Actions 성공과 UI artifact 한글 표시 확인
- Vercel Preview Ready와 빈 상태 화면 확인

## Supabase 점검

1. `supabase/migrations/20260803124545_production_readiness_security_hardening_v11_0_0.sql`을 승인된 배포 절차로 적용합니다.
2. 적용 직후 `supabase/verification/verify_production_readiness_v11_0_0.sql`의 읽기 전용 쿼리로 정책·함수 권한·트리거·인덱스를 확인합니다.
3. `applicants`, `employees`, `schools`, `applicant_snapshots`, `user_roles`, `audit_logs`에 RLS가 켜져 있는지 확인합니다.
4. 공개 `SECURITY DEFINER` 함수의 `anon`·`authenticated` 직접 실행 경고가 사라졌는지 [Security Advisor](https://supabase.com/docs/guides/database/database-linter)에서 확인합니다.
5. `app_settings`와 `allowed_users`의 RLS 성능 경고가 사라졌는지 확인합니다.
6. Supabase Auth의 [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security)를 켭니다. 이 설정은 저장소 코드나 SQL migration으로 대신하지 않으며, 활성화 확인 전에는 READY로 판정하지 않습니다.
7. 관리자·채용담당자·조회전용 실제 테스트 계정으로 허용·차단 작업을 확인합니다. 현재 운영 프로젝트는 admin 1명뿐이므로 recruiter·viewer 계정은 사용자 승인 후에만 만듭니다.

운영 사전검증에서 기존 `private.erp_prepare_audit_log()`의 `current_role` 변수명이 PostgreSQL `CURRENT_ROLE` 특수 식별자와 충돌해 admin·recruiter 감사로그 삽입을 거부하는 문제가 확인됐습니다. v11 migration은 같은 private 함수를 `resolved_app_role` 변수로 안전하게 교체합니다. 적용 후 admin·recruiter 본인 작업 기록 허용, viewer 기록 차단, 감사로그 원문 개인정보 미저장을 다시 확인해야 합니다.

새 테이블이나 개인정보 행을 검사 목적으로 만들지 않습니다. SQL 결과에는 표·정책·함수 이름과 건수만 사용합니다.

## Rollback 제한

`supabase/rollback/rollback_production_readiness_v11_0_0.sql`은 migration의 자동 후속 작업이 아닙니다. 장애가 확인되고 관리자 승인이 있을 때만 이전 레거시 정책·트리거·공개 함수 실행 권한을 복원하는 비상 절차로 사용합니다. 실행 전 현재 DB 백업과 영향 범위를 확인하고, 실행 후에는 검증 SQL과 역할별 회귀검사를 다시 수행합니다.

확인된 감사로그 역할 변수 수정은 rollback 후에도 의도적으로 유지합니다. 이 수정까지 되돌리면 admin·recruiter 감사로그가 다시 차단되므로, 레거시 정책·공개 RPC 복원 범위에 포함하지 않습니다.

## 운영자 모의훈련

- 가상 자료 암호화 백업을 만들고 빈 브라우저에서 복원
- PC A 오프라인 삭제 후 재연결, PC B에서 재등장하지 않는지 확인
- 일반 내보내기와 민감 내보내기 역할 차단 확인
- 변경 이력에 민감정보 원문이 남지 않는지 확인
- 저장 실패·동기화 충돌·브라우저 손실·배포 장애 복구 순서 연습
- 운영자 설명서와 장애 연락 순서 인수인계

## 병합·배포 중단 조건

- 자동검사 또는 UI 검사 실패
- Vercel Preview 또는 Production이 Ready가 아님
- RLS가 꺼진 공개 표가 있음
- Supabase Security Advisor의 공개 함수 실행 경고가 남음
- 실제 개인정보가 테스트, 로그, artifact, PR에 포함됨
- 복원·삭제 재등장 방지·역할별 차단 모의훈련이 미완료

하나라도 해당하면 강제로 병합·태그·운영 승격하지 않습니다.

## 완료 기록

운영 준비 화면의 `점검 결과 저장`은 항목 ID, 통과 상태, 시각, 역할, 검증 출처, 운영 환경과 가상 성능 건수만 JSON으로 저장합니다. 이름·연락처·주소·주민등록번호·메모·원본 업무 자료는 포함하지 않습니다.

이 JSON은 사용자가 수정 가능한 참고용 점검 결과이며 전자서명된 증명서가 아닙니다. `verificationSource`가 `local`이면 다른 항목을 모두 채워도 `overall`은 `ready`가 되지 않습니다.
