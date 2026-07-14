# Recruit ERP v10.37.4 HOME_DEV · COMPLETE_UX

기준 버전: `v10.36.6 HOME_DEV · LIST_UX`

이번 빌드는 Recruit ERP의 업무 화면과 UI/UX를 통합 개선한 로컬 우선 운영 버전입니다.

## 적용 범위

- 홈 대시보드 및 오늘 할 일 우선순위 정리
- 지원자 상태 빠른 변경과 상세 프로필 업무 동선
- 신규/수정 폼 진행률, 형식 검증, 미저장 경고
- 일정관리 월간·주간·목록 보기 및 종류 필터
- 채용 통계 핵심 KPI 재배치
- 지원자 연동 안내문 작성과 최근 문구
- 협력학교 관리 필요 사유 및 중요 학교 표시
- 사원 등록·가져오기·내보내기 동선 분리
- 공통 접근성, 모바일, 토스트, 포커스 및 인쇄 보완

## 데이터 안전 범위

다음 핵심 저장 구조는 변경하지 않았습니다.

- `recruit_erp_applicants_stable`
- `recruit_erp_schools`
- `recruit_erp_employees`
- `recruit_erp_calendar_events`
- 지원자·학교·사원명부 JSON 필드 구조

UI 편의 기능은 별도 키만 사용합니다.

- `recruit_erp_ui_template_history`
- `recruit_erp_ui_school_favorites`

## 운영 안내

현재 회사에서는 브라우저 localStorage가 Master입니다. 적용 전 기존 폴더와 JSON 백업을 별도로 보관하세요.
