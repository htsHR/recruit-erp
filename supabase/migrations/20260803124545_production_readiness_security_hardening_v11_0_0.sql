-- Recruit ERP v11.0.0 production-readiness security hardening.
--
-- This migration keeps the legacy app_settings/allowed_users behavior while
-- moving policy helper functions out of the exposed public schema. It also
-- prevents direct RPC execution of the retired public SECURITY DEFINER
-- functions reported by Supabase Security Advisor.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- The v10.58 audit trigger used `current_role` as a PL/pgSQL variable name.
-- PostgreSQL also treats CURRENT_ROLE as a special identifier, so authenticated
-- admin/recruiter inserts could be rejected as if they had no audit permission.
-- Replace the function in place; the existing private trigger remains attached.
create or replace function private.erp_prepare_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_app_role text;
  resolved_email text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select ur.role, ur.email
    into resolved_app_role, resolved_email
    from public.user_roles ur
   where ur.user_id = auth.uid();
  if resolved_app_role not in ('admin','recruiter') then
    raise exception 'audit write permission denied';
  end if;
  new.actor_user_id := auth.uid();
  new.actor_role := resolved_app_role;
  new.actor_label := case
    when position('@' in coalesce(resolved_email,'')) > 1
      then left(resolved_email,1) || '***@' || split_part(resolved_email,'@',2)
    else '로그인 사용자'
  end;
  new.before_values := private.erp_audit_scrub_json(new.before_values);
  new.after_values := private.erp_audit_scrub_json(new.after_values);
  new.metadata := private.erp_audit_scrub_json(new.metadata);
  new.entity_label := case
    when new.entity_type in ('applicant','employee','schedule','user')
      then left(coalesce(new.entity_label,'기록'),1) || '***'
    else left(coalesce(new.entity_label,'기록'),80)
  end;
  new.reason := left(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(new.reason,''),'[0-9]{6}[ -]?[1-4][0-9]{6}','[주민등록번호 숨김]','g'),
        '01[016789][ .-]?[0-9]{3,4}[ .-]?[0-9]{4}','[전화번호 숨김]','g'
      ),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[이메일 숨김]','g'
    ),
    300
  );
  new.source := 'cloud';
  new.created_at := now();
  return new;
end
$$;

revoke all on function private.erp_prepare_audit_log() from public, anon, authenticated;

create or replace function private.erp_legacy_is_allowed_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.allowed_users au
    where au.user_id = uid
  )
$$;

create or replace function private.erp_legacy_is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.allowed_users au
    where au.user_id = uid
      and au.role = 'admin'
  )
$$;

revoke all on function private.erp_legacy_is_allowed_user(uuid) from public, anon, authenticated;
revoke all on function private.erp_legacy_is_admin(uuid) from public, anon, authenticated;
grant execute on function private.erp_legacy_is_allowed_user(uuid) to authenticated;
grant execute on function private.erp_legacy_is_admin(uuid) to authenticated;

drop policy if exists allowed_users_select on public.allowed_users;
create policy allowed_users_select
on public.allowed_users for select to authenticated
using ((select private.erp_legacy_is_admin((select auth.uid()))));

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select
on public.app_settings for select to authenticated
using ((select private.erp_legacy_is_allowed_user((select auth.uid()))));

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update
on public.app_settings for update to authenticated
using ((select private.erp_legacy_is_admin((select auth.uid()))))
with check ((select private.erp_legacy_is_admin((select auth.uid()))));

create or replace function private.erp_set_app_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function private.erp_set_app_settings_updated_at() from public, anon, authenticated;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function private.erp_set_app_settings_updated_at();

-- Retain the public functions temporarily for rollback compatibility, but
-- remove direct Data API/RPC execution from every client role.
revoke all on function public.can_write_operational_data(uuid) from public, anon, authenticated;
revoke all on function public.is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.is_allowed_user(uuid) from public, anon, authenticated;
revoke all on function public.set_app_settings_updated_at() from public, anon, authenticated;

create index if not exists app_settings_updated_by_idx
on public.app_settings(updated_by);

commit;
