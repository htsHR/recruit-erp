# Recruit ERP v10.40.24 · RELATION_LINK_REGRESSION_GUARD

## 핵심
- 학교 정확·유사 후보, 잘못된 schoolId, 연결·해제 회귀검증
- 지원자 강한·약한 후보, 양방향 연결, 한쪽 연결, 중복 연결, 퇴직 후 재지원 검증
- 연결 완료 / 미연결 / 확인 필요 필터 정리
- 후보 근거를 점수·근거 칩·문제 칩으로 분리
- 선택 수 고정 표시 및 연결/해제 버튼 위험도 구분
- 모바일 비교 카드 레이아웃 정돈
- 연결·해제 직전 전체 JSON 안전백업 유지
- Supabase applicants.employeeId 저장 지원 및 구형 스키마 안전 대체
- 전체 JSON 백업·복원 후 schoolId / applicantId / employeeId 유지

## SQL
- `supabase_migration_v10.40.24_relation_fields.sql`을 집에서 1회 실행하면 지원자 employeeId도 Supabase에 저장됩니다.
- 미실행 상태에서는 로컬·JSON 연결은 유지되고, Supabase는 기존 컬럼으로 안전 저장됩니다.

## 비변경
- 지원자·사원·학교 원본 정보
- localStorage 키
- 지원자 목록 및 공용 목록 레이아웃
