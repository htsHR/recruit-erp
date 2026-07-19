# Recruit ERP v10.40.23 HOME_DEV · EMPLOYEE_RELATION_LINKS

## 통합 기능
- EMPLOYEE_SCHOOL_LINK: 사원 출신학교와 협력학교 후보 비교·선택 연결·해제
- EMPLOYEE_APPLICANT_LINK: 사원과 지원자 기록 후보 비교·양방향 연결·해제

## 안전 원칙
- 자동 연결 및 자동 덮어쓰기 없음
- 선택한 항목만 반영
- 학교명, 지원자 원본, 사원 원본 필드는 변경하지 않고 연결 ID만 관리
- 반영·해제 직전 전체 ERP JSON 안전백업
- 기존 연결 충돌 시 선행 연결 해제 요구

## 학교 연결
- 정확 일치, 별칭 일치, 유사 후보, 잘못된 ID, 후보 없음 분류
- 학교 구분을 고등학교 / 전문대 / 대학교 / 기타로 표시
- 재직·휴직·퇴직·누적 입사·평균 근속 집계
- normalizeEmployee의 신규 자동 schoolId 부여 제거

## 지원자 연결
- 기존 연결, 이름+입사일, 생년, 연락처(기존 값이 있을 때만), 학교 기준 후보 점수
- 입사완료 지원자 누락, 입사일 불일치, 근무지/조직 불일치, 다중 연결 충돌, 퇴직 후 재지원 표시
- employee.applicantId와 applicant.employeeId 양방향 반영

## 데이터 영향
- 기존 JSON 구조와 localStorage 키 유지
- 기존 Supabase 마이그레이션 외 추가 SQL 없음
- 지원자 employeeId는 기존 정책대로 로컬 연결값 유지
