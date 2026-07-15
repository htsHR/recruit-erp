# v10.39.1 CSS_JS_CONSOLIDATION

- 통교체용 전체 파일로 재구성
- 기존에 실제 적용되던 CSS 13개를 `app.css` 1개로 통합
- 기능 확장 JS 5개를 `features.js` 1개로 통합
- 핵심 로직 `app.js`와 Supabase 설정은 별도 유지
- 과거 applicant-ui 보정 파일과 중복 CSS/JS 제거
- 데이터 저장키, JSON 구조, Supabase 테이블·동기화 방식 변경 없음
- 데이터 점검센터 CSS 누락을 통합 번들에 포함

최종 주요 구성: `index.html`, `app.css`, `app.js`, `features.js`, `supabase_config.js`
