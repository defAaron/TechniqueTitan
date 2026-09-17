-- Admin signup list should follow auth.users (Google OAuth included).
-- profiles can miss rows if this trigger was applied after the first signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, auth_provider, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    auth_provider = excluded.auth_provider;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, auth_provider, created_at)
select
  u.id,
  u.email,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
  u.created_at
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  auth_provider = excluded.auth_provider;

create or replace function public.admin_list_signups()
returns table (
  id uuid,
  email text,
  auth_provider text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email')::text,
    u.created_at
  from auth.users u
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_signups() from public;
grant execute on function public.admin_list_signups() to authenticated;
