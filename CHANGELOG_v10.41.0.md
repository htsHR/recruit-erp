# Recruit ERP v10.41.0 SCHOOL_MANAGEMENT_CORE

- 기준: v10.40.30 EXCEL_PASTE_UX_AUDIT_AND_POLISH
- 학교별 다중 담당자 관리 및 주 담당자 지정
- 전화/이메일/방문/추천요청/설명회/협약/기타 활동 이력 누적
- 다음 연락 예정일과 최근 연락일 자동 갱신
- 메모 이력 누적 및 중요 표시
- 학교 상세에 관계관리 요약 카드 추가
- 최근 관리일 계산에 활동/메모 이력 포함
- 기존 school ID, applicants/employees schoolId, notes 및 기존 관리이력 필드 유지
- 새 구조는 contacts / activities / memoHistory 배열이며 기존 JSON은 빈 배열로 안전 정규화
- 회사망 Supabase 쓰기는 환경상 미검증; localStorage/JSON 보존 중심
