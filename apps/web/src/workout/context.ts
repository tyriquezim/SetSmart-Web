import type { WorkoutAction, WorkoutState } from '@gymbro/core'
import { createContext, useContext } from 'react'

export interface ActiveWorkoutApi {
  workout: WorkoutState | null
  dispatch: (action: WorkoutAction) => void
  start: (workout: WorkoutState) => void
  discard: () => void
}

export const ActiveWorkoutContext = createContext<ActiveWorkoutApi | null>(null)

export function useActiveWorkout(): ActiveWorkoutApi {
  const api = useContext(ActiveWorkoutContext)
  if (!api) throw new Error('useActiveWorkout must be used within ActiveWorkoutProvider')
  return api
}
