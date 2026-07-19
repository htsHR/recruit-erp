-- Recruit ERP v10.42.0 SCHOOL_RELATIONSHIP_PACK
-- Supabase SQL Editor에서 1회 실행
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS "memoHistory" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "contacts" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "activities" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "recommendationRequests" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "departments" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "mouInfo" jsonb DEFAULT '{}'::jsonb;
