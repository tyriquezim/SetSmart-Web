-- SetSmart phase 2: body weight log and per-exercise progress stats.

-- ---------------------------------------------------------------------------
-- Body weight: at most one entry per user per day (re-logging a day updates it).
-- ---------------------------------------------------------------------------
create table public.body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg   numeric(6, 2) not null check (weight_kg > 0 and weight_kg < 1000),
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table public.body_weights enable row level security;

create policy "Own body weights" on public.body_weights
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.body_weights to authenticated;

-- ---------------------------------------------------------------------------
-- One row per (session, exercise) with the numbers progress charts need.
-- security_invoker makes the view run with the caller's RLS, so users only
-- ever see their own rows.
-- Estimated 1RM uses the Epley formula, only from sets of 1-12 reps where it
-- is reasonably accurate.
-- ---------------------------------------------------------------------------
create view public.exercise_session_stats
with (security_invoker = on) as
select
  s.user_id,
  s.exercise_id,
  s.session_id,
  ws.started_at,
  count(*)::int                                                     as set_count,
  max(s.reps)                                                       as max_reps,
  max(s.weight_kg)                                                  as max_weight_kg,
  max(case when s.weight_kg > 0 and s.reps = 1 then s.weight_kg
           when s.weight_kg > 0 and s.reps between 2 and 12
           then s.weight_kg * (1 + s.reps / 30.0) end)              as best_e1rm_kg,
  sum(s.reps * coalesce(s.weight_kg, 0))                            as volume_kg,
  sum(s.reps)::int                                                  as total_reps
from public.workout_sets s
join public.workout_sessions ws on ws.id = s.session_id
group by s.user_id, s.exercise_id, s.session_id, ws.started_at;

grant select on public.exercise_session_stats to authenticated;
