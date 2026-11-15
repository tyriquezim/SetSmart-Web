import { createWorkoutFromRoutine, getExerciseHistory, getRoutine, type ExerciseHistory } from '@gymbro/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { keys } from '../hooks/data'
import { newId } from '../lib/id'
import { supabase } from '../lib/supabase'
import { unlockAudio } from './alarm'
import { useActiveWorkout } from './context'

/**
 * Start a routine. If another workout is in progress, `pendingReplace` is set
 * so the caller can ask before discarding it.
 */
export function useStartWorkout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { workout, start } = useActiveWorkout()
  const [startingId, setStartingId] = useState<string | null>(null)
  const [pendingReplace, setPendingReplace] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  async function run(routineId: string) {
    setStartingId(routineId)
    setError(null)
    try {
      const routine = await qc.fetchQuery({ queryKey: keys.routine(routineId), queryFn: () => getRoutine(supabase, routineId) })
      if (!routine.exercises.some((e) => e.sets.length > 0)) throw new Error('Add at least one exercise with a set to this routine first.')
      // History powers "last time" hints and PR badges; never block a workout on it.
      let history: Record<string, ExerciseHistory> = {}
      try {
        history = await getExerciseHistory(supabase, routine.exercises.map((e) => e.exerciseId))
      } catch {
        // offline or failed: start without hints
      }
      start(createWorkoutFromRoutine(routine, newId(), Date.now(), history))
      navigate('/workout')
    } catch (e) {
      setError(e)
    } finally {
      setStartingId(null)
    }
  }

  return {
    startingId,
    error,
    pendingReplace,
    activeWorkoutName: workout?.name ?? null,
    /** Call from a click handler (unlocks audio for the rest alarm). */
    startRoutine(routineId: string) {
      unlockAudio()
      if (workout) setPendingReplace(routineId)
      else void run(routineId)
    },
    confirmReplace() {
      if (pendingReplace) void run(pendingReplace)
      setPendingReplace(null)
    },
    cancelReplace: () => setPendingReplace(null),
  }
}
