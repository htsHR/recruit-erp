# Recruit ERP v10.36.5 HOME_DEV — UI_LAYOUT QA

## 기준 및 범위
- 기준 파일: v10.36.4 HOME_DEV
- 결과 버전: v10.36.5 HOME_DEV · UI_LAYOUT
- 수정 범위: HTML 화면 구조, CSS 레이아웃, 홈 KPI 표시 구성
- 제외 범위: Supabase 설정·저장·조회 로직, localStorage 저장 구조, JSON 형식, 학교·사원 데이터 구조

## 보존 확인
- 지원자 저장키: `recruit_erp_applicants_stable` 유지
- 협력학교 저장키: `recruit_erp_schools` 유지
- 사원명부 저장키: `recruit_erp_employees` 유지
- 일정 저장키와 기존 필드명 유지
- `supabase_config.js` 변경 없음

## 렌더링 검증
- 데스크톱: 1600 × 1000
- 모바일: 390 × 844
- 샘플 지원자 8명으로 홈·지원자 목록·신규 등록 화면 확인
- 홈 KPI 4개 정상 렌더링
- 지원자 목록 데스크톱 테이블 정상 렌더링
- 모바일 지원자 카드형 목록 정상 렌더링
- 신규 지원자 등록 폼 반응형 정상 렌더링
- 테스트 중 JavaScript page error / console error 0건

## 주요 UX 변경
- 홈 정보 우선순위 재구성
- 중복 KPI와 업무 카드 축소
- 공통 카드·버튼·여백·타이포그래피 정돈
- 지원자 검색·필터 영역 가독성 개선
- 지원자 테이블 행 구분과 상태 표시 개선
- 모바일 지원자 목록 카드형 전환
- 신규 등록 폼 섹션과 입력 간격 정돈
- 동작하지 않는 상단 알림·도움말 아이콘 숨김
