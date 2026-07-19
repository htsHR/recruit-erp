# Recruit ERP v10.41.2 HOME_DEV

## SCHOOL_MANAGEMENT_UI_UNIFICATION

기준본: v10.41.1 HOME_DEV · SCHOOL_MANAGEMENT_UX_REDESIGN

### 1. 학교 상세 화면 통일
- 학교 상세 모달을 학교관리 대시보드와 동일한 블루·화이트 카드형 디자인으로 통일
- 학교 핵심정보 영역을 강조형 헤더로 변경
- 기본정보, 채용성과, 재직성과, 관리이력 카드의 계층과 간격 정리
- 관계관리 현황 카드에 담당자·활동·메모·최근활동 요약 추가

### 2. 학교 관계관리 작업공간 개편
- 활동 이력 / 메모 / 담당자 탭 구조 적용
- 주 담당자, 활동 건수, 중요 메모, 다음 연락 예정 요약 표시
- 활동 기록 입력 영역과 활동 타임라인 분리
- 메모와 담당자를 카드형 목록으로 정리
- 학교 상세 및 기본정보 수정 바로가기 제공

### 3. 중복 학교 통합 화면 통일
- 후보 선택 → 학교 비교 → 통합 확인 단계 표시
- 후보 목록, 비교 영역, 연결 이동 수치 카드의 디자인 통일
- 기준 학교 ID 유지 및 통합 대상 삭제 안내 강조
- 기존 안전백업 및 사용자 확인 절차 유지

### 4. 데이터 보호
- 학교 ID 변경 없음
- applicants.schoolId 변경 구조 없음
- employees.schoolId 변경 구조 없음
- 자동 병합 및 자동 삭제 추가 없음
- 기존 JSON/localStorage 구조 유지

### 5. 변경 파일
- index.html
- js/school-management-core.js
- js/school-merge-manager.js
- css/pages-extra.css

### 6. 정적 점검
- 전체 JavaScript 문법 검사 통과
- HTML 중복 ID 0건
- 학교관리 주요 모달 및 패널 ID 존재 확인

실제 회사망과 운영 데이터 기반 클릭 테스트는 별도 확인이 필요합니다.
