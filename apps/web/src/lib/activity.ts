import type { CardioSession, WorkoutSessionSummary } from '@setsmart/core'

export type Activity = { kind: 'workout'; data: WorkoutSessionSummary } | { kind: 'cardio'; data: CardioSession }

/** Weights workouts and cardio sessions in one list, newest first. */
export function mergeActivities(workouts: WorkoutSessionSummary[] | undefined, cardio: CardioSession[] | undefined): Activity[] {
  const all: Activity[] = [
    ...(workouts ?? []).map((data) => ({ kind: 'workout' as const, data })),
    ...(cardio ?? []).map((data) => ({ kind: 'cardio' as const, data })),
  ]
  return all.sort((a, b) => Date.parse(b.data.startedAt) - Date.parse(a.data.startedAt))
}
