import { CARDIO_ACTIVITIES, type Exercise } from '@setsmart/core'

/** "Treadmill" for built-in cardio, "Counts as Run" for custom cardio, "Chest · Barbell" for weights. */
export function exerciseSubtitle(e: Exercise): string {
  if (e.kind !== 'cardio') return `${e.muscleGroup} · ${e.equipment}`
  if (e.ownerId == null) return e.equipment
  return e.cardioActivity ? `Counts as ${CARDIO_ACTIVITIES[e.cardioActivity].label.toLowerCase()}` : 'Cardio'
}
