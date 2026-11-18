import type { LogWorkoutPayload } from '../workout/engine'
import type { WorkoutTimes } from '../energy/estimates'
import type { CardioActivity, CardioEffort, LoggedCardio, WorkoutSessionDetail, WorkoutSessionSummary } from '../types'
import { unwrap, type Client } from './client'

interface SessionRow {
  id: string
  routine_id: string | null
  name: string
  started_at: string
  finished_at: string
  notes: string | null
}

interface SetRow {
  exercise_id: string
  exercise_position: number
  set_number: number
  target_reps: number | null
  target_weight_kg: number | string | null
  reps: number
  weight_kg: number | string | null
  completed_at: string
  exercise?: { name: string } | null
}

interface CardioRow {
  exercise_id: string
  exercise_position: number
  target_duration_s: number | null
  started_at: string
  duration_s: number
  distance_m: number | string | null
  effort: CardioEffort | null
  exercise?: { name: string; cardio_activity: CardioActivity | null; cardio_met: number | string | null } | null
}

// `*` keeps supabase-js from inferring (and mis-typing) the embedded rows; they're typed by hand as CardioRow.
const CARDIO_SELECT = 'workout_cardio(*, exercise:exercises(name, cardio_activity, cardio_met))'

// Postgres numeric comes back as a string or number depending on size; normalise.
const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

const toCardio = (c: CardioRow): LoggedCardio => ({
  exerciseId: c.exercise_id,
  exerciseName: c.exercise?.name ?? 'Unknown exercise',
  exercisePosition: c.exercise_position,
  targetDurationS: c.target_duration_s,
  startedAt: c.started_at,
  durationS: c.duration_s,
  distanceM: num(c.distance_m),
  effort: c.effort,
  activity: c.exercise?.cardio_activity ?? 'other',
  met: num(c.exercise?.cardio_met ?? null),
})

const cardioList = (rows: CardioRow[] | undefined): LoggedCardio[] =>
  (rows ?? []).map(toCardio).sort((a, b) => a.exercisePosition - b.exercisePosition)

function summarise(r: SessionRow, sets: Array<Pick<SetRow, 'reps' | 'weight_kg'>>, cardio: CardioRow[] | undefined): WorkoutSessionSummary {
  return {
    id: r.id,
    routineId: r.routine_id,
    name: r.name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    setCount: sets.length,
    volumeKg: sets.reduce((sum, s) => sum + s.reps * (num(s.weight_kg) ?? 0), 0),
    cardio: cardioList(cardio),
  }
}

export async function logWorkout(db: Client, payload: LogWorkoutPayload): Promise<string> {
  return unwrap<string>(await db.rpc('log_workout', { p_workout: payload }))
}

export async function listWorkoutSessions(
  db: Client,
  { limit = 20, before }: { limit?: number; before?: string } = {},
): Promise<WorkoutSessionSummary[]> {
  let q = db
    .from('workout_sessions')
    .select(`id, routine_id, name, started_at, finished_at, notes, workout_sets(reps, weight_kg), ${CARDIO_SELECT}`)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('started_at', before)
  const rows = unwrap<Array<SessionRow & { workout_sets: Array<Pick<SetRow, 'reps' | 'weight_kg'>>; workout_cardio: CardioRow[] }>>(await q)
  return rows.map((r) => summarise(r, r.workout_sets, r.workout_cardio))
}

export async function getWorkoutSession(db: Client, id: string): Promise<WorkoutSessionDetail> {
  const r = unwrap<SessionRow & { workout_sets: SetRow[]; workout_cardio: CardioRow[] }>(
    await db
      .from('workout_sessions')
      .select(`*, workout_sets(*, exercise:exercises(name)), ${CARDIO_SELECT}`)
      .eq('id', id)
      .single(),
  )
  const sets = [...r.workout_sets].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
  )
  return {
    ...summarise(r, r.workout_sets, r.workout_cardio),
    notes: r.notes,
    sets: sets.map((s) => ({
      exerciseId: s.exercise_id,
      exerciseName: s.exercise?.name ?? 'Unknown exercise',
      exercisePosition: s.exercise_position,
      setNumber: s.set_number,
      targetReps: s.target_reps,
      targetWeightKg: num(s.target_weight_kg),
      reps: s.reps,
      weightKg: num(s.weight_kg),
      completedAt: s.completed_at,
    })),
  }
}

export async function deleteWorkoutSession(db: Client, id: string): Promise<void> {
  unwrap(await db.from('workout_sessions').delete().eq('id', id))
}

/** Times, set counts and cardio of every workout that started in [fromIso, toIso), for energy estimates. */
export async function listWorkoutTimes(
  db: Client,
  fromIso: string,
  toIso: string,
): Promise<Array<WorkoutTimes & { id: string }>> {
  const rows = unwrap<
    Array<Pick<SessionRow, 'id' | 'started_at' | 'finished_at'> & { workout_sets: Array<{ count: number }>; workout_cardio: CardioRow[] }>
  >(
    await db
      .from('workout_sessions')
      .select(`id, started_at, finished_at, workout_sets(count), ${CARDIO_SELECT}`)
      .gte('started_at', fromIso)
      .lt('started_at', toIso)
      .order('started_at'),
  )
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    setCount: r.workout_sets[0]?.count ?? 0,
    cardio: cardioList(r.workout_cardio),
  }))
}
