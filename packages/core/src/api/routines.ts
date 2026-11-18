import type { PlannedSet, Routine, RoutineInput, RoutineSummary } from '../types'
import { unwrap, type Client } from './client'
import { toExercise, type ExerciseRow } from './exercises'

interface SetJson {
  reps: number
  weight_kg: number | null
}

interface RoutineRow {
  id: string
  name: string
  notes: string | null
  updated_at: string
}

interface RoutineExerciseRow {
  exercise_id: string
  position: number
  rest_seconds: number
  sets: SetJson[]
  target_duration_s: number | null
  notes: string | null
  exercise: ExerciseRow
}

const toSet = (s: SetJson): PlannedSet => ({ reps: s.reps, weightKg: s.weight_kg })
const fromSet = (s: PlannedSet): SetJson => ({ reps: s.reps, weight_kg: s.weightKg })

export async function listRoutines(db: Client): Promise<RoutineSummary[]> {
  const rows = unwrap<Array<RoutineRow & { routine_exercises: Array<{ count: number }> }>>(
    await db
      .from('routines')
      .select('id, name, notes, updated_at, routine_exercises(count)')
      .order('updated_at', { ascending: false }),
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    updatedAt: r.updated_at,
    exerciseCount: r.routine_exercises[0]?.count ?? 0,
  }))
}

export async function getRoutine(db: Client, id: string): Promise<Routine> {
  const r = unwrap<RoutineRow & { routine_exercises: RoutineExerciseRow[] }>(
    await db
      .from('routines')
      .select(
        'id, name, notes, updated_at, routine_exercises(exercise_id, position, rest_seconds, sets, target_duration_s, notes, exercise:exercises(*))',
      )
      .eq('id', id)
      .order('position', { referencedTable: 'routine_exercises' })
      .single(),
  )
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    updatedAt: r.updated_at,
    exercises: r.routine_exercises.map((re) => ({
      exerciseId: re.exercise_id,
      exercise: toExercise(re.exercise),
      restSeconds: re.rest_seconds,
      sets: re.sets.map(toSet),
      targetDurationS: re.target_duration_s ?? null,
      notes: re.notes,
    })),
  }
}

/** Create (id = null) or replace a routine and its exercises atomically. Returns the id. */
export async function saveRoutine(db: Client, input: RoutineInput): Promise<string> {
  return unwrap<string>(
    await db.rpc('save_routine', {
      p_routine_id: input.id,
      p_name: input.name.trim(),
      p_notes: input.notes?.trim() || null,
      p_exercises: input.exercises.map((e) => ({
        exercise_id: e.exerciseId,
        rest_seconds: e.restSeconds,
        sets: e.sets.map(fromSet),
        target_duration_s: e.targetDurationS,
        notes: e.notes,
      })),
    }),
  )
}

export async function deleteRoutine(db: Client, id: string): Promise<void> {
  unwrap(await db.from('routines').delete().eq('id', id))
}
