-- Recruit ERP v10.40.13
-- 사원명부 확장정보를 Supabase employees 테이블에 저장하기 위한 1회 실행 SQL
-- 기존 컬럼과 데이터는 삭제하거나 변경하지 않습니다.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS "gender" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "team" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "groupName" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "product" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "part" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "rank" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "position" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "promotionDate" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "recruitType" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "recruitChannel" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "education" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "major" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "leaveStartDate" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "returnDate" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "applicantId" text DEFAULT '';
