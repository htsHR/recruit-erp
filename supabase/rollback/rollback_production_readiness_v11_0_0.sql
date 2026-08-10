-- Recruit ERP v11.0.0 production-readiness rollback.
-- DO NOT run automatically. Use only after an incident is confirmed and an
-- administrator approves restoring the exact pre-v11 legacy behavior.

begin;

-- The audit trigger role-variable correction is intentionally retained.
-- Reverting it would restore the confirmed admin/recruiter audit-write denial
-- and is not required to restore the pre-v11 legacy policies or public RPCs.

drop policy if exists allowed_users_select on public.allowed_users;
create policy allowed_users_select
on public.allowed_users for select to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select
on public.app_settings for select to authenticated
using (public.is_allowed_user(auth.uid()));

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update
on public.app_settings for update to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_app_settings_updated_at();

-- Exact privileges observed before the v11 migration candidate.
revoke all on function public.can_write_operational_data(uuid) from public, anon, authenticated;
revoke all on function public.is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.is_allowed_user(uuid) from public, anon, authenticated;
grant execute on function public.can_write_operational_data(uuid) to authenticated;
grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_allowed_user(uuid) to authenticated;

revoke all on function public.set_app_settings_updated_at() from public, anon, authenticated;
grant execute on function public.set_app_settings_updated_at() to public;

drop function if exists private.erp_set_app_settings_updated_at();
drop function if exists private.erp_legacy_is_admin(uuid);
drop function if exists private.erp_legacy_is_allowed_user(uuid);
drop index if exists public.app_settings_updated_by_idx;

commit;
