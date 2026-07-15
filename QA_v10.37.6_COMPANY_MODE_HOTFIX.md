# QA v10.37.6 COMPANY_MODE_HOTFIX

- 회사 모드 + 비로그인: 지원자 저장 시 localStorage만 변경, Supabase upsert 미호출
- 회사 모드: 학교·사원·삭제·스냅샷 및 클라우드 초기 불러오기 미호출
- 집 모드 + 비로그인: 로그인 화면 표시, 로그인 생략 시 클라우드 요청 미호출
- 집 모드 + 인증 세션: 기존 Supabase 읽기·쓰기 허용
- 기존 localStorage 키와 데이터 JSON 구조 변경 없음
