# Recruit ERP v10.40.7 — INTEGRATED_STABILITY

기준: v10.40.4 HOME_DEV

## 통합된 업데이트
- v10.40.5 MULTI_ROW_PASTE: 엑셀 여러 행 분석·선택 등록·중복/주의 확인·등록 취소
- v10.40.6 APPLICANT_UI_FINAL: 지원자 목록 핵심 열 중심 정돈, 고정 열 너비, 관리 버튼 안정화
- v10.40.7 MODULE_STABILITY: 이벤트 null 방어, 전체 모듈 문법·참조·브라우저 회귀 검사

## 데이터 안전
- 지원자 JSON 구조 및 localStorage 키 변경 없음
- Supabase 저장 로직 변경 없음
- 여러 행 등록은 선택·확인 후 한 번만 저장
- 등록 직후 이번 작업 실행 취소 지원
- 오류 행은 선택 및 등록 불가

## 운영 원칙
- 회사/집 운영 모드 유지
- 기존 모듈 직접 수정, 버전별 보정 CSS/JS 추가 없음
- 통교체용 전체 ZIP 제공
