-- Recruit ERP v10.32.0
-- 협력학교 관리상태를 Supabase에도 저장하기 위한 1회 실행 SQL
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS "managementStatus" text DEFAULT '';
