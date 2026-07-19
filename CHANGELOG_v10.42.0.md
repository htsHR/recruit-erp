# Recruit ERP v10.42.0 HOME_DEV
## SCHOOL_RELATIONSHIP_PACK

기준본: v10.41.2 SCHOOL_MANAGEMENT_UI_UNIFICATION

### 추가 기능
- 학교별 추천 요청 관리
  - 요청일, 대상 학과, 지원근무지, 요청 인원, 추천 인원, 진행상태, 메모
  - 추천 요청 저장 시 활동 이력과 최근 요청 메모 연동
  - 진행중·미회신·회신완료 상태 표시
- 학교별 MOU·협약 관리
  - 상태, 협약 유형, 체결일, 만료일, 담당 부서, 내부 담당자, 메모
  - 기존 mouDate와 호환
  - 만료·만료 임박 상태 표시
- 학교별 학과 관리
  - 학과명, 계열, 학제, 교수·조교, 연락처, 우선 채용 직무, 우선 추천 여부
- 관계관리 모달 탭 확장
  - 활동 / 추천 요청 / MOU / 학과 / 담당자 / 메모
- 학교 상세 화면 관계관리 요약 확장

### 데이터 구조
기존 학교 ID는 변경하지 않고 다음 필드만 추가합니다.
- recommendationRequests
- departments
- mouInfo

기존 contacts, activities, memoHistory, mouDate도 그대로 유지합니다.

### Supabase
- `supabase_migration_v10.42.0_school_relationship_pack.sql` 추가
- 확장 컬럼이 없을 때는 로컬 전체 데이터를 보존하고, Supabase에는 기존 필드만 재저장하도록 보호

### 수정 파일
- index.html
- js/schools.js
- js/school-management-core.js
- js/school-merge-manager.js
- css/pages-extra.css
- supabase_migration_v10.42.0_school_relationship_pack.sql
