# Recruit ERP v10.46.2 HOME_DEV
## PRINT_SCOPE_FIX

기준 버전: v10.46.1 DAILY_WORKFLOW_IMPROVEMENT

## 수정 내용
- 학교 보고서의 전역 인쇄 CSS가 면접 명단표까지 숨기던 충돌 수정
- 학교 보고서 인쇄 규칙을 `body.school-report-printing` 상태로 한정
- 면접 명단표 인쇄 시작 시 남아 있는 학교 보고서 인쇄 상태 제거
- 학교 보고서 인쇄 시작 시 면접 명단표 인쇄 상태 제거
- 인쇄 종료 후 학교 보고서 인쇄 상태 자동 해제
- 캐시 무효화를 위해 모든 CSS·JS 버전 쿼리를 v10.46.2로 갱신

## 데이터 영향
- 지원자·학교·사원 데이터 변경 없음
- localStorage 키 변경 없음
- Supabase 마이그레이션 없음
- 기존 기능 및 화면 구조 변경 없음
