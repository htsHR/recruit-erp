# Recruit ERP v10.44.0 HOME_DEV

## SCHOOL_DATA_CONTROL_PACK

기준본: v10.43.0 SCHOOL_ANALYTICS_PACK

### 추가 기능

- 학교 화면에 `데이터 관리` 탭 추가
- 중복 학교 후보 점검
- 학교명·별칭 충돌 점검
- 동일·유사 학교의 지역 불일치 점검
- 동일·유사 학교의 학교 구분 불일치 점검
- 학교명이 있으나 schoolId가 없는 지원자·사원 점검
- 존재하지 않는 schoolId를 참조하는 지원자·사원 점검
- 담당자 누락 점검
- 연락처 형식 오류 점검
- 연결 데이터 없이 365일 이상 사용되지 않은 학교 점검
- 병합 후보별 지원자·사원 연결 건수 표시
- 점검 결과 CSV 내보내기

### 안전 조치

- 자동 병합 및 자동 삭제 없음
- 잘못된 schoolId 참조 해제 시 사용자 확인 필수
- 실제 참조 변경 전 전체 ERP 안전백업 생성
- 기존 학교 ID와 applicants.schoolId, employees.schoolId 구조 유지
- 병합 비교는 기존 중복 학교 안전 통합 화면으로 연결
- 미연결 항목은 기존 정확 일치 학교 연결 화면으로 연결

### 수정 파일

- index.html
- js/bindings.js
- js/school-data-control.js
- css/pages-extra.css
