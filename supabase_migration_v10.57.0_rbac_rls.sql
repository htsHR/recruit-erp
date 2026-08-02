-- Recruit ERP v10.57.0 USER PERMISSIONS + RLS
-- Supabase SQL Editor에서 한 번 실행합니다.
--
-- 역할
--   admin     : 모든 조회·수정·삭제·백업·권한 설정
--   recruiter : 지원자 등록·수정, 면접/일정 관리, 일반 내보내기
--   viewer    : 조회만 가능
--
-- 최초 설치 시 가장 먼저 생성된 기존 Auth 계정 1개를 관리자로 지정합니다.
-- 설치 후 ERP의 "사용자 권한" 화면에서 계정과 역할을 반드시 확인하세요.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'erp_app_role') then
    create type public.erp_app_role as enum ('admin', 'recruiter', 'viewer');
  end if;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role public.erp_app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles(role);
alter table public.user_roles enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.erp_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ur.role::text from public.user_roles ur where ur.user_id = (select auth.uid())),
    'viewer'
  )
$$;

revoke all on function private.erp_current_role() from public, anon;
grant execute on function private.erp_current_role() to authenticated;

create or replace function private.erp_touch_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function private.erp_prevent_last_admin_loss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception '마지막 관리자 계정의 권한은 제거할 수 없습니다.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists erp_touch_user_role on public.user_roles;
create trigger erp_touch_user_role
before update on public.user_roles
for each row execute function private.erp_touch_user_role();

drop trigger if exists erp_prevent_last_admin_loss on public.user_roles;
create trigger erp_prevent_last_admin_loss
before update or delete on public.user_roles
for each row execute function private.erp_prevent_last_admin_loss();

create or replace function private.erp_handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles(user_id,email,display_name,role)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'name',''),
    'viewer'
  )
  on conflict (user_id) do update set email = excluded.email;
  return new;
end
$$;

drop trigger if exists erp_auth_user_created on auth.users;
create trigger erp_auth_user_created
after insert or update of email on auth.users
for each row execute function private.erp_handle_auth_user();

insert into public.user_roles(user_id,email,display_name,role,created_at,updated_at)
select
  u.id,
  coalesce(u.email,''),
  coalesce(u.raw_user_meta_data->>'name',''),
  'viewer',
  coalesce(u.created_at,now()),
  now()
from auth.users u
on conflict (user_id) do update set email = excluded.email;

do $$
declare first_user uuid;
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    select u.id into first_user from auth.users u order by u.created_at asc nulls last, u.id asc limit 1;
    if first_user is not null then
      update public.user_roles set role = 'admin' where user_id = first_user;
    end if;
  end if;
end
$$;

revoke all on public.user_roles from anon;
revoke all on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;
grant update(role,display_name) on public.user_roles to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies where schemaname='public' and tablename='user_roles'
  loop
    execute format('drop policy if exists %I on public.user_roles', policy_row.policyname);
  end loop;
end
$$;

create policy erp_user_roles_select
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.erp_current_role()) = 'admin'
);

create policy erp_user_roles_admin_update
on public.user_roles for update to authenticated
using ((select private.erp_current_role()) = 'admin')
with check ((select private.erp_current_role()) = 'admin');

-- 기존의 넓은 허용 정책은 permissive 정책끼리 OR 처리되므로 모두 제거한 뒤
-- v10.57.0 정책만 다시 만듭니다.
do $$
declare table_name text;
declare policy_row record;
begin
  foreach table_name in array array['applicants','employees','schools','applicant_snapshots']
  loop
    if to_regclass('public.'||table_name) is not null then
      execute format('alter table public.%I enable row level security',table_name);
      for policy_row in
        select policyname from pg_policies where schemaname='public' and tablename=table_name
      loop
        execute format('drop policy if exists %I on public.%I',policy_row.policyname,table_name);
      end loop;
      execute format('revoke all on public.%I from anon',table_name);
      execute format('revoke all on public.%I from authenticated',table_name);
    end if;
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.applicants') is not null then
    grant select,insert,update,delete on public.applicants to authenticated;
    create policy erp_applicants_read on public.applicants for select to authenticated
      using ((select private.erp_current_role()) in ('admin','recruiter','viewer'));
    create policy erp_applicants_insert on public.applicants for insert to authenticated
      with check ((select private.erp_current_role()) in ('admin','recruiter'));
    create policy erp_applicants_update on public.applicants for update to authenticated
      using ((select private.erp_current_role()) in ('admin','recruiter'))
      with check ((select private.erp_current_role()) in ('admin','recruiter'));
    create policy erp_applicants_delete on public.applicants for delete to authenticated
      using ((select private.erp_current_role()) = 'admin');
  end if;
end
$$;

do $$
begin
  if to_regclass('public.employees') is not null then
    grant select,insert,update,delete on public.employees to authenticated;
    create policy erp_employees_read on public.employees for select to authenticated
      using ((select private.erp_current_role()) in ('admin','recruiter','viewer'));
    create policy erp_employees_admin_insert on public.employees for insert to authenticated
      with check ((select private.erp_current_role()) = 'admin');
    create policy erp_employees_admin_update on public.employees for update to authenticated
      using ((select private.erp_current_role()) = 'admin')
      with check ((select private.erp_current_role()) = 'admin');
    create policy erp_employees_admin_delete on public.employees for delete to authenticated
      using ((select private.erp_current_role()) = 'admin');
  end if;
end
$$;

do $$
begin
  if to_regclass('public.schools') is not null then
    grant select,insert,update,delete on public.schools to authenticated;
    create policy erp_schools_read on public.schools for select to authenticated
      using ((select private.erp_current_role()) in ('admin','recruiter','viewer'));
    create policy erp_schools_admin_insert on public.schools for insert to authenticated
      with check ((select private.erp_current_role()) = 'admin');
    create policy erp_schools_admin_update on public.schools for update to authenticated
      using ((select private.erp_current_role()) = 'admin')
      with check ((select private.erp_current_role()) = 'admin');
    create policy erp_schools_admin_delete on public.schools for delete to authenticated
      using ((select private.erp_current_role()) = 'admin');
  end if;
end
$$;

do $$
begin
  if to_regclass('public.applicant_snapshots') is not null then
    grant select,insert,delete on public.applicant_snapshots to authenticated;
    create policy erp_snapshots_admin_read on public.applicant_snapshots for select to authenticated
      using ((select private.erp_current_role()) = 'admin');
    create policy erp_snapshots_admin_insert on public.applicant_snapshots for insert to authenticated
      with check ((select private.erp_current_role()) = 'admin');
    create policy erp_snapshots_admin_delete on public.applicant_snapshots for delete to authenticated
      using ((select private.erp_current_role()) = 'admin');
  end if;
end
$$;

commit;

-- 설치 확인용(실행 결과에서 admin 계정이 1개 이상인지 확인)
select email, role, created_at from public.user_roles order by created_at;
