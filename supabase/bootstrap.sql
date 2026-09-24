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

-- Practice session progress (see migrations/20260923000004_practice_sessions.sql)
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('photo', 'video', 'live')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s double precision not null default 0,
  frames_seen integer not null default 0,
  frames_kept integer not null default 0,
  scoring_version text not null default 'unknown',
  note text,
  samples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint practice_sessions_samples_is_array check (jsonb_typeof(samples) = 'array')
);

create index if not exists practice_sessions_user_started_idx
  on public.practice_sessions (user_id, started_at desc);

create table if not exists public.session_hands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  hand text not null check (hand in ('Left', 'Right')),
  frames_kept integer not null default 0,
  mean_composite double precision,
  p10_composite double precision,
  mean_scores jsonb not null default '{}'::jsonb,
  frac_warning jsonb not null default '{}'::jsonb,
  frac_critical jsonb not null default '{}'::jsonb,
  primary_issue text,
  tip_problem text,
  tip_fix text,
  unique (session_id, hand)
);

create index if not exists session_hands_session_idx on public.session_hands (session_id);

alter table public.practice_sessions enable row level security;
alter table public.session_hands enable row level security;

create or replace function public.set_practice_session_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from auth.uid() then
    new.user_id := auth.uid();
  end if;
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.practice_sessions where user_id = auth.uid()) >= 400 then
    raise exception 'session limit reached (400). Delete an older session to save a new one.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists practice_sessions_set_user on public.practice_sessions;
create trigger practice_sessions_set_user
  before insert on public.practice_sessions
  for each row execute function public.set_practice_session_user_id();

drop policy if exists "Users read own practice sessions" on public.practice_sessions;
create policy "Users read own practice sessions"
  on public.practice_sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own practice sessions" on public.practice_sessions;
create policy "Users insert own practice sessions"
  on public.practice_sessions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own practice session samples" on public.practice_sessions;
create policy "Users update own practice session samples"
  on public.practice_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own practice sessions" on public.practice_sessions;
create policy "Users delete own practice sessions"
  on public.practice_sessions for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users read own session hands" on public.session_hands;
create policy "Users read own session hands"
  on public.session_hands for select to authenticated
  using (
    exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert own session hands" on public.session_hands;
create policy "Users insert own session hands"
  on public.session_hands for insert to authenticated
  with check (
    exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users delete own session hands" on public.session_hands;
create policy "Users delete own session hands"
  on public.session_hands for delete to authenticated
  using (
    exists (
      select 1 from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

revoke all on table public.practice_sessions from anon, authenticated;
grant select, insert, update, delete on table public.practice_sessions to authenticated;

revoke all on table public.session_hands from anon, authenticated;
grant select, insert, delete on table public.session_hands to authenticated;
