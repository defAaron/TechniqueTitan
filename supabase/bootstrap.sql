-- One-shot Technique Titan auth schema for the SQL editor.
-- Additive only: does not drop Auth users, tables, or data.
-- Safe to run more than once. Use the project Vercel points at.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  auth_provider text not null default 'email',
  created_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create table if not exists public.app_admins (
  email text primary key check (email = lower(email))
);

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;

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

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and not t.tgisinternal
      and n.nspname = 'auth'
      and c.relname = 'users'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.email = lower(coalesce(
      (select u.email from auth.users u where u.id = auth.uid()),
      auth.jwt() ->> 'email',
      ''
    ))
  );
$$;

grant execute on function public.is_admin() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Admins can read all profiles'
  ) then
    create policy "Admins can read all profiles"
      on public.profiles
      for select
      to authenticated
      using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;

grant select, update on table public.profiles to authenticated;

insert into public.app_admins (email) values
  (lower('aaron.dutta22@gmail.com')),
  (lower('aaronsumit123@gmail.com'))
on conflict (email) do nothing;

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

grant execute on function public.admin_list_signups() to authenticated;
