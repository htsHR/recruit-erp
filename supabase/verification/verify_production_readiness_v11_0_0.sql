-- Recruit ERP v11.0.0 production-readiness read-only verification.
-- Run after the approved migration. This file does not change database state.

select t.tablename,t.rowsecurity,count(p.policyname)::integer as policy_count
from pg_tables t
left join pg_policies p
  on p.schemaname=t.schemaname and p.tablename=t.tablename
where t.schemaname='public'
  and t.tablename in (
    'allowed_users','app_settings','applicants','employees','schools',
    'applicant_snapshots','user_roles','audit_logs'
  )
group by t.tablename,t.rowsecurity
order by t.tablename;

select policyname,tablename,cmd,roles,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('allowed_users','app_settings')
order by tablename,policyname;

select n.nspname as schema_name,p.proname,p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('public',p.oid,'EXECUTE') as public_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in (
  'can_write_operational_data','is_admin_user','is_allowed_user','set_app_settings_updated_at'
)) or (n.nspname='private' and p.proname in (
  'erp_legacy_is_allowed_user','erp_legacy_is_admin','erp_set_app_settings_updated_at'
))
order by n.nspname,p.proname;

select tg.tgname,pg_get_triggerdef(tg.oid,true) as definition
from pg_trigger tg
join pg_class c on c.oid=tg.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='app_settings' and not tg.tgisinternal;

select indexname,indexdef
from pg_indexes
where schemaname='public' and indexname='app_settings_updated_by_idx';

select 'auth_users' as item,count(*)::bigint as total
from auth.users
union all
select 'user_roles',count(*)::bigint from public.user_roles
union all
select 'role_'||role::text,count(*)::bigint from public.user_roles group by role
order by item;
