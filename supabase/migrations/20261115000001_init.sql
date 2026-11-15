-- SetSmart schema, phase 1: profiles, exercises, routines, logged workouts.
-- All weights are stored in kilograms; the client converts for display.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  weight_unit  text not null default 'kg'  check (weight_unit in ('kg', 'lb')),
  energy_unit  text not null default 'kj'  check (energy_unit in ('kj', 'kcal')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create a profile row automatically for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Exercises: built-ins have owner_id = null; custom ones belong to a user.
-- Custom exercises are archived rather than deleted so history stays intact.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 100),
  muscle_group text not null,
  equipment    text not null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index exercises_builtin_name_idx on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_custom_name_idx on public.exercises (owner_id, lower(name))
  where owner_id is not null and archived_at is null;

alter table public.exercises enable row level security;

create policy "Read built-in and own exercises" on public.exercises
  for select using (owner_id is null or owner_id = (select auth.uid()));
create policy "Create own exercises" on public.exercises
  for insert with check (owner_id = (select auth.uid()));
create policy "Update own exercises" on public.exercises
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Routines: an ordered list of exercises, each with planned sets and rest.
-- `sets` is a JSON array of { "reps": int, "weight_kg": number | null }.
-- ---------------------------------------------------------------------------
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routines_user_idx on public.routines (user_id);

create table public.routine_exercises (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  position     int  not null,
  rest_seconds int  not null default 90 check (rest_seconds between 0 and 3600),
  sets         jsonb not null default '[]' check (jsonb_typeof(sets) = 'array'),
  notes        text,
  unique (routine_id, position)
);

create index routine_exercises_routine_idx on public.routine_exercises (routine_id);

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

create policy "Own routines" on public.routines
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Read own routine exercises" on public.routine_exercises
  for select using (exists (
    select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())
  ));
create policy "Write own routine exercises" on public.routine_exercises
  for insert with check (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
                where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "Delete own routine exercises" on public.routine_exercises
  for delete using (exists (
    select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())
  ));

-- Save a routine and its exercises atomically. Pass p_routine_id = null to create.
-- p_exercises: [{ exercise_id, rest_seconds, sets: [{reps, weight_kg}], notes }]
create function public.save_routine(
  p_routine_id uuid,
  p_name       text,
  p_notes      text,
  p_exercises  jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_routine_id is null then
    insert into routines (user_id, name, notes)
    values (auth.uid(), p_name, p_notes)
    returning id into v_id;
  else
    update routines
       set name = p_name, notes = p_notes, updated_at = now()
     where id = p_routine_id and user_id = auth.uid()
    returning id into v_id;

    if v_id is null then
      raise exception 'Routine not found' using errcode = 'P0002';
    end if;

    delete from routine_exercises where routine_id = v_id;
  end if;

  insert into routine_exercises (routine_id, exercise_id, position, rest_seconds, sets, notes)
  select v_id,
         (e ->> 'exercise_id')::uuid,
         (t.ord - 1)::int,
         coalesce((e ->> 'rest_seconds')::int, 90),
         coalesce(e -> 'sets', '[]'::jsonb),
         nullif(e ->> 'notes', '')
    from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as t (e, ord);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Logged workouts
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id          uuid primary key,  -- generated client-side so retries are idempotent
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id  uuid references public.routines (id) on delete set null,
  name        text not null,
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);

create table public.workout_sets (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.workout_sessions (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete restrict,
  exercise_position int  not null,  -- order the exercise was actually performed in
  set_number        int  not null,
  target_reps       int,
  target_weight_kg  numeric(7, 3),
  reps              int  not null check (reps >= 0),
  weight_kg         numeric(7, 3) check (weight_kg >= 0),
  completed_at      timestamptz not null
);

create index workout_sets_session_idx on public.workout_sets (session_id);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id, completed_at);

alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

create policy "Own sessions" on public.workout_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own sets" on public.workout_sets
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Log a completed workout and its sets atomically. Safe to retry with the same id.
-- p_workout: { id, routine_id, name, started_at, finished_at, notes,
--              sets: [{ exercise_id, exercise_position, set_number, target_reps,
--                       target_weight_kg, reps, weight_kg, completed_at }] }
create function public.log_workout(p_workout jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p_workout ->> 'id')::uuid;
begin
  insert into workout_sessions (id, user_id, routine_id, name, started_at, finished_at, notes)
  values (
    v_id,
    auth.uid(),
    (p_workout ->> 'routine_id')::uuid,
    p_workout ->> 'name',
    (p_workout ->> 'started_at')::timestamptz,
    (p_workout ->> 'finished_at')::timestamptz,
    nullif(p_workout ->> 'notes', '')
  )
  on conflict (id) do nothing;

  if not found then
    return v_id;  -- already logged by an earlier attempt
  end if;

  insert into workout_sets (
    session_id, user_id, exercise_id, exercise_position, set_number,
    target_reps, target_weight_kg, reps, weight_kg, completed_at
  )
  select v_id,
         auth.uid(),
         (s ->> 'exercise_id')::uuid,
         (s ->> 'exercise_position')::int,
         (s ->> 'set_number')::int,
         (s ->> 'target_reps')::int,
         (s ->> 'target_weight_kg')::numeric,
         (s ->> 'reps')::int,
         (s ->> 'weight_kg')::numeric,
         (s ->> 'completed_at')::timestamptz
    from jsonb_array_elements(coalesce(p_workout -> 'sets', '[]'::jsonb)) as s;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges (Supabase grants these by default; explicit so the migration
-- doesn't depend on project defaults). RLS above still restricts every row.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.save_routine(uuid, text, text, jsonb) to authenticated;
grant execute on function public.log_workout(jsonb) to authenticated;
revoke execute on function public.save_routine(uuid, text, text, jsonb) from anon, public;
revoke execute on function public.log_workout(jsonb) from anon, public;
