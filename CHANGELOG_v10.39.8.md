# v10.39.8 APPLICANT_ACTION_MENU_FIX

- 지원자 목록의 `⋯` 메뉴 클릭을 캡처 단계 이벤트 위임으로 재연결
- 인라인 onclick 및 features.js 실행 성공 여부와 무관하게 메뉴 동작
- 외부 클릭, ESC, 스크롤, 창 크기 변경 시 메뉴 자동 닫힘
- 수정·복제·삭제 버튼의 기존 함수는 유지
- 데이터 구조, localStorage, Supabase 로직 변경 없음
