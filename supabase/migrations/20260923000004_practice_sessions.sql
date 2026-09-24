-- Practice session progress (scores only; no media). Free-tier caps enforced in app + triggers.

create table public.practice_sessions (
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

create index practice_sessions_user_started_idx
  on public.practice_sessions (user_id, started_at desc);

create table public.session_hands (
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

create index session_hands_session_idx on public.session_hands (session_id);

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

create trigger practice_sessions_set_user
  before insert on public.practice_sessions
  for each row execute function public.set_practice_session_user_id();

create policy "Users read own practice sessions"
  on public.practice_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own practice sessions"
  on public.practice_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own practice session samples"
  on public.practice_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own practice sessions"
  on public.practice_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users read own session hands"
  on public.session_hands
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users insert own session hands"
  on public.session_hands
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users delete own session hands"
  on public.session_hands
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.practice_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

revoke all on table public.practice_sessions from anon, authenticated;
grant select, insert, update, delete on table public.practice_sessions to authenticated;

revoke all on table public.session_hands from anon, authenticated;
grant select, insert, delete on table public.session_hands to authenticated;
