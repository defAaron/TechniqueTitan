-- Technique Titan auth schema (dedicated project only).
-- Do not apply this to other Supabase apps (e.g. a calendar/accounts project).
--
-- After your first signup, unlock /admin with:
--   insert into public.app_admins (email) values ('you@example.com');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  auth_provider text not null default 'email',
  created_at timestamptz not null default now()
);

create index profiles_created_at_idx on public.profiles (created_at desc);

create table public.app_admins (
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
  insert into public.profiles (id, email, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

revoke all on table public.app_admins from anon, authenticated;
