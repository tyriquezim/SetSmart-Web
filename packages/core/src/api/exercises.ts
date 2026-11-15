import type { Exercise } from '../types'
import { unwrap, type Client } from './client'

export interface ExerciseRow {
  id: string
  owner_id: string | null
  name: string
  muscle_group: string
  equipment: string
  archived_at: string | null
}

export const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  archivedAt: r.archived_at,
})

/** Built-in + the user's own (non-archived) exercises, sorted by name. */
export async function listExercises(db: Client): Promise<Exercise[]> {
  const rows = unwrap<ExerciseRow[]>(
    await db.from('exercises').select('*').is('archived_at', null).order('name'),
  )
  return rows.map(toExercise)
}

export interface ExerciseInput {
  name: string
  muscleGroup: string
  equipment: string
}

export async function createExercise(db: Client, userId: string, input: ExerciseInput): Promise<Exercise> {
  const row = unwrap<ExerciseRow>(
    await db
      .from('exercises')
      .insert({ owner_id: userId, name: input.name.trim(), muscle_group: input.muscleGroup, equipment: input.equipment })
      .select('*')
      .single(),
  )
  return toExercise(row)
}

export async function updateExercise(db: Client, id: string, input: ExerciseInput): Promise<Exercise> {
  const row = unwrap<ExerciseRow>(
    await db
      .from('exercises')
      .update({ name: input.name.trim(), muscle_group: input.muscleGroup, equipment: input.equipment })
      .eq('id', id)
      .select('*')
      .single(),
  )
  return toExercise(row)
}

/** Custom exercises are archived (hidden) rather than deleted so workout history keeps working. */
export async function archiveExercise(db: Client, id: string): Promise<void> {
  unwrap(await db.from('exercises').update({ archived_at: new Date().toISOString() }).eq('id', id))
}
