-- SetSmart: cardio becomes a kind of exercise.
--
-- Cardio exercises (runs, treadmill, rowing machine and so on) live in the exercise
-- library next to the weights exercises, go into routines with a goal duration, and
-- are timed live during a workout. This replaces the separate cardio_sessions table,
-- which is dropped (there were no real users yet, so nothing is migrated).
--
-- Energy is still estimated in the app from the stored fields; nothing derived is stored.

-- ---------------------------------------------------------------------------
-- Exercises: a kind, and for cardio, which Compendium activity it counts as
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column kind text not null default 'weights' check (kind in ('weights', 'cardio')),
  -- Picks the Compendium MET rows used for energy estimates
  add column cardio_activity text check (cardio_activity in (
    'run', 'walk', 'hike', 'cycle', 'indoor_cycle', 'row', 'elliptical', 'stairs', 'swim', 'hiit', 'other'
  )),
  -- Only for cardio_activity = 'other': a MET value the user looked up in the Compendium
  add column cardio_met numeric(3, 1) check (cardio_met between 1 and 25),
  add constraint exercises_kind_activity_check check ((kind = 'cardio') = (cardio_activity is not null)),
  add constraint exercises_met_only_other_check check (cardio_met is null or cardio_activity = 'other');

-- Built-in cardio exercises. Safe to re-run.
insert into public.exercises (name, muscle_group, equipment, kind, cardio_activity) values
  ('Outdoor Run', 'Cardio', 'Outdoors', 'cardio', 'run'),
  ('Treadmill Run', 'Cardio', 'Treadmill', 'cardio', 'run'),
  ('Outdoor Walk', 'Cardio', 'Outdoors', 'cardio', 'walk'),
  ('Treadmill Walk', 'Cardio', 'Treadmill', 'cardio', 'walk'),
  ('Hike', 'Cardio', 'Outdoors', 'cardio', 'hike'),
  ('Outdoor Ride', 'Cardio', 'Bike', 'cardio', 'cycle'),
  ('Exercise Bike', 'Cardio', 'Machine', 'cardio', 'indoor_cycle'),
  ('Rowing Machine', 'Cardio', 'Machine', 'cardio', 'row'),
  ('Elliptical', 'Cardio', 'Machine', 'cardio', 'elliptical'),
  ('Stair Climber', 'Cardio', 'Machine', 'cardio', 'stairs'),
  ('Swim', 'Cardio', 'Pool', 'cardio', 'swim'),
  ('HIIT', 'Cardio', 'Bodyweight', 'cardio', 'hiit')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Routines: cardio exercises have a goal duration instead of sets
-- ---------------------------------------------------------------------------
alter table public.routine_exercises
  add column target_duration_s int check (target_duration_s between 60 and 86400);

-- p_exercises: [{ exercise_id, rest_seconds, sets: [{reps, weight_kg}], target_duration_s, notes }]
create or replace function public.save_routine(
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

  insert into routine_exercises (routine_id, exercise_id, position, rest_seconds, sets, target_duration_s, notes)
  select v_id,
         (e ->> 'exercise_id')::uuid,
         (t.ord - 1)::int,
         coalesce((e ->> 'rest_seconds')::int, 90),
         coalesce(e -> 'sets', '[]'::jsonb),
         (e ->> 'target_duration_s')::int,
         nullif(e ->> 'notes', '')
    from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as t (e, ord);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Logged cardio: one row per cardio exercise done in a workout
-- ---------------------------------------------------------------------------
create table public.workout_cardio (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.workout_sessions (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete restrict,
  exercise_position int  not null,  -- shares the numbering with workout_sets
  target_duration_s int,
  -- When the timer was first started; duration_s is the timed length, excluding pauses
  started_at        timestamptz not null,
  duration_s        int not null check (duration_s between 1 and 86400),
  -- Entered by the user after the timer ends (directly, or worked out from a pace)
  distance_m        numeric(9, 1) check (distance_m > 0 and distance_m < 1000000),
  -- How hard it felt; used when the speed can't be worked out from a distance
  effort            text check (effort in ('light', 'moderate', 'vigorous'))
);

create index workout_cardio_session_idx on public.workout_cardio (session_id);

alter table public.workout_cardio enable row level security;

create policy "Own cardio" on public.workout_cardio
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.workout_cardio to authenticated;

-- Log a completed workout, its sets and its cardio atomically. Safe to retry with the same id.
-- p_workout: { id, routine_id, name, started_at, finished_at, notes,
--              sets: [{ exercise_id, exercise_position, set_number, target_reps,
--                       target_weight_kg, reps, weight_kg, completed_at }],
--              cardio: [{ exercise_id, exercise_position, target_duration_s,
--                         started_at, duration_s, distance_m, effort }] }
create or replace function public.log_workout(p_workout jsonb)
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

  insert into workout_cardio (
    session_id, user_id, exercise_id, exercise_position, target_duration_s,
    started_at, duration_s, distance_m, effort
  )
  select v_id,
         auth.uid(),
         (c ->> 'exercise_id')::uuid,
         (c ->> 'exercise_position')::int,
         (c ->> 'target_duration_s')::int,
         (c ->> 'started_at')::timestamptz,
         (c ->> 'duration_s')::int,
         (c ->> 'distance_m')::numeric,
         c ->> 'effort'
    from jsonb_array_elements(coalesce(p_workout -> 'cardio', '[]'::jsonb)) as c;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion: include logged cardio, and drop the old cardio table
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.workout_cardio where user_id = v_uid;
  delete from public.workout_sets where user_id = v_uid;
  delete from public.workout_sessions where user_id = v_uid;
  delete from public.routine_exercises
    where routine_id in (select id from public.routines where user_id = v_uid);
  delete from public.routines where user_id = v_uid;
  delete from public.food_logs where user_id = v_uid;
  delete from public.foods where user_id = v_uid;
  delete from public.nutrition_targets where user_id = v_uid;
  delete from public.body_weights where user_id = v_uid;
  delete from public.exercises where owner_id = v_uid;
  delete from public.profiles where id = v_uid;
  -- Also removes their sessions, refresh tokens and identities (cascades inside auth).
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

drop table public.cardio_sessions;
