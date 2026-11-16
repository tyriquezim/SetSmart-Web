import type { LogWorkoutPayload } from '../workout/engine'
import type { WorkoutSessionDetail, WorkoutSessionSummary } from '../types'
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

// Postgres numeric comes back as a string or number depending on size; normalise.
const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

function summarise(r: SessionRow, sets: Array<Pick<SetRow, 'reps' | 'weight_kg'>>): WorkoutSessionSummary {
  return {
    id: r.id,
    routineId: r.routine_id,
    name: r.name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    setCount: sets.length,
    volumeKg: sets.reduce((sum, s) => sum + s.reps * (num(s.weight_kg) ?? 0), 0),
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
    .select('id, routine_id, name, started_at, finished_at, notes, workout_sets(reps, weight_kg)')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('started_at', before)
  const rows = unwrap<Array<SessionRow & { workout_sets: Array<Pick<SetRow, 'reps' | 'weight_kg'>> }>>(await q)
  return rows.map((r) => summarise(r, r.workout_sets))
}

export async function getWorkoutSession(db: Client, id: string): Promise<WorkoutSessionDetail> {
  const r = unwrap<SessionRow & { workout_sets: SetRow[] }>(
    await db
      .from('workout_sessions')
      .select('*, workout_sets(*, exercise:exercises(name))')
      .eq('id', id)
      .single(),
  )
  const sets = [...r.workout_sets].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
  )
  return {
    ...summarise(r, r.workout_sets),
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

/** Start and finish times of every workout that started in [fromIso, toIso). */
export async function listWorkoutTimes(
  db: Client,
  fromIso: string,
  toIso: string,
): Promise<Array<{ id: string; startedAt: string; finishedAt: string }>> {
  const rows = unwrap<Array<Pick<SessionRow, 'id' | 'started_at' | 'finished_at'>>>(
    await db
      .from('workout_sessions')
      .select('id, started_at, finished_at')
      .gte('started_at', fromIso)
      .lt('started_at', toIso)
      .order('started_at'),
  )
  return rows.map((r) => ({ id: r.id, startedAt: r.started_at, finishedAt: r.finished_at }))
}
