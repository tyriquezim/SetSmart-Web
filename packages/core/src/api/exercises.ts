import type { CardioActivity, Exercise, ExerciseKind } from '../types'
import { unwrap, type Client } from './client'

export interface ExerciseRow {
  id: string
  owner_id: string | null
  name: string
  kind: ExerciseKind
  muscle_group: string
  equipment: string
  cardio_activity: CardioActivity | null
  cardio_met: number | string | null
  archived_at: string | null
}

export const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  // Rows from before cardio existed have no kind
  kind: r.kind ?? 'weights',
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  cardioActivity: r.cardio_activity ?? null,
  cardioMet: r.cardio_met == null ? null : Number(r.cardio_met),
  archivedAt: r.archived_at,
})

/** Built-in + the user's own (non-archived) exercises, sorted by name. */
export async function listExercises(db: Client): Promise<Exercise[]> {
  const rows = unwrap<ExerciseRow[]>(
    await db.from('exercises').select('*').is('archived_at', null).order('name'),
  )
  return rows.map(toExercise)
}

/** A weights exercise needs a muscle group and equipment; a cardio one needs an activity. */
export type ExerciseInput =
  | { kind: 'weights'; name: string; muscleGroup: string; equipment: string }
  | { kind: 'cardio'; name: string; cardioActivity: CardioActivity; cardioMet: number | null }

/** Custom cardio exercises are filed under "Cardio" with equipment "Other". */
function toRow(input: ExerciseInput) {
  return input.kind === 'cardio'
    ? {
        name: input.name.trim(),
        kind: 'cardio' as const,
        muscle_group: 'Cardio',
        equipment: 'Other',
        cardio_activity: input.cardioActivity,
        cardio_met: input.cardioActivity === 'other' ? input.cardioMet : null,
      }
    : {
        name: input.name.trim(),
        kind: 'weights' as const,
        muscle_group: input.muscleGroup,
        equipment: input.equipment,
        cardio_activity: null,
        cardio_met: null,
      }
}

export async function createExercise(db: Client, userId: string, input: ExerciseInput): Promise<Exercise> {
  const row = unwrap<ExerciseRow>(
    await db
      .from('exercises')
      .insert({ owner_id: userId, ...toRow(input) })
      .select('*')
      .single(),
  )
  return toExercise(row)
}

export async function updateExercise(db: Client, id: string, input: ExerciseInput): Promise<Exercise> {
  const row = unwrap<ExerciseRow>(
    await db
      .from('exercises')
      .update(toRow(input))
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
