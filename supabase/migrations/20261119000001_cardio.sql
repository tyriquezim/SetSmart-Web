-- SetSmart: cardio sessions (runs, rides, swims and so on), logged after the fact.
-- Energy is estimated in the app from these fields; nothing derived is stored, so
-- changes to the method apply to every past session too.

create table public.cardio_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity    text not null check (activity in (
                'run', 'walk', 'hike', 'cycle', 'indoor_cycle', 'row', 'elliptical', 'stairs', 'swim', 'hiit', 'other'
              )),
  -- Only for activity = 'other', e.g. "Kayaking"
  custom_name text check (char_length(custom_name) <= 60),
  started_at  timestamptz not null,
  duration_s  int not null check (duration_s between 60 and 86400),
  distance_m  numeric(9, 1) check (distance_m > 0 and distance_m < 1000000),
  -- How hard it felt; used when the speed can't be worked out from a distance
  effort      text check (effort in ('light', 'moderate', 'vigorous')),
  -- Only for activity = 'other': a MET value the user looked up in the Compendium
  met         numeric(3, 1) check (met between 1 and 25),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now()
);

create index cardio_sessions_user_started_idx on public.cardio_sessions (user_id, started_at desc);

alter table public.cardio_sessions enable row level security;

create policy "Own cardio sessions" on public.cardio_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
