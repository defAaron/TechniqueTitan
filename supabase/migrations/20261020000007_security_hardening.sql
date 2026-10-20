-- Lock security-definer entry points and re-assert client table grants.
--
-- New functions are executable by PUBLIC, and Supabase also grants EXECUTE to
-- anon directly. Revoking PUBLIC alone leaves that anon grant in place.
-- admin_list_signups() is unchanged: it still refuses callers unless is_admin(),
-- and is_admin() still matches app_admins to auth.users.email for auth.uid().
-- Trigger functions are not Data API RPCs. PostgreSQL checks EXECUTE when a
-- trigger is created, not when it fires, so the owner keeps EXECUTE and API
-- roles lose it.

grant execute on function public.handle_new_user() to postgres;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.set_practice_session_user_id() to postgres;
revoke all on function public.set_practice_session_user_id() from public, anon, authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to postgres, authenticated;

revoke all on function public.admin_list_signups() from public, anon;
grant execute on function public.admin_list_signups() to postgres, authenticated;

-- Client roles. service_role is not revoked (it bypasses RLS and is not a client key).
revoke all on table public.profiles from anon, authenticated;
grant select, update, insert on table public.profiles to authenticated;

revoke all on table public.app_admins from anon, authenticated;

revoke all on table public.practice_sessions from anon, authenticated;
grant select, insert, update, delete on table public.practice_sessions to authenticated;

revoke all on table public.session_hands from anon, authenticated;
grant select, insert, delete on table public.session_hands to authenticated;

revoke all on table public.coach_focus from anon, authenticated;
grant select, insert, update, delete on table public.coach_focus to authenticated;
