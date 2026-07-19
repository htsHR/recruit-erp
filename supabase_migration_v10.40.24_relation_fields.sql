-- Recruit ERP v10.40.24 · 사원-지원자 양방향 연결 필드
-- Supabase SQL Editor에서 1회 실행

alter table public.applicants
  add column if not exists "employeeId" text;

create index if not exists applicants_employee_id_idx
  on public.applicants ("employeeId");

-- employees."applicantId"는 v10.40.13 마이그레이션에 포함되어 있습니다.
