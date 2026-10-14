-- One row per user, scores only, no images.

create table public.coach_focus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criterion text not null check (criterion in (
    'wrist_height', 'finger_curvature', 'thumb_position',
    'wrist_lateral', 'hand_arch'
  )),
  locked_on date not null,
  locked_until date not null,
  burden jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.coach_focus enable row level security;

create policy coach_focus_own on public.coach_focus
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.coach_focus from anon, authenticated;
grant select, insert, update, delete on table public.coach_focus to authenticated;
