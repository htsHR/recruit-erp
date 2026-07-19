-- Recruit ERP v10.46.0 APPLICANT_PROGRESS_HISTORY_PACK
alter table public.applicants add column if not exists "failureReason" text default '';
alter table public.applicants add column if not exists "withdrawalReason" text default '';
alter table public.applicants add column if not exists "lastContactDate" text default '';
alter table public.applicants add column if not exists "nextContactDate" text default '';
alter table public.applicants add column if not exists "progressHistory" jsonb default '[]'::jsonb;
alter table public.applicants add column if not exists "lastChangedBy" text default '';
alter table public.applicants add column if not exists "lastChangedAt" text default '';
