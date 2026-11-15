import { currentSet, workoutReducer, type WorkoutAction, type WorkoutState } from '@setsmart/core'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUser } from '../auth/context'
import { playTick, restOverAlert } from './alarm'
import { ActiveWorkoutContext } from './context'

const STORAGE_KEY = 'setsmart.activeWorkout.v1'
/** If the app was closed for longer than this past the end of rest, don't sound the alarm on reopen. */
const STALE_ALARM_MS = 60_000

interface Stored {
  userId: string
  workout: WorkoutState
}

function load(userId: string): WorkoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    return stored.userId === userId && stored.workout?.version === 1 ? stored.workout : null
  } catch {
    return null
  }
}

function persist(userId: string, workout: WorkoutState | null): void {
  try {
    if (workout) localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, workout } satisfies Stored))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage full/unavailable: the workout still works, it just won't survive a reload.
  }
}

/**
 * Holds the in-progress workout above the router so the rest timer and alarm
 * keep working while the user browses other pages, and persists it to
 * localStorage so a reload or closed tab doesn't lose progress.
 */
export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const [workout, setWorkout] = useState<WorkoutState | null>(() => load(user.id))

  const update = useCallback(
    (next: WorkoutState | null) => {
      persist(user.id, next)
      setWorkout(next)
    },
    [user.id],
  )

  const dispatch = useCallback(
    (action: WorkoutAction) =>
      setWorkout((prev) => {
        if (!prev) return prev
        const next = workoutReducer(prev, action)
        if (next !== prev) persist(user.id, next)
        return next
      }),
    [user.id],
  )

  // Rest timer: schedule countdown pips and the end-of-rest alarm from the absolute end time.
  const restEndsAt = workout?.phase.kind === 'rest' ? workout.phase.endsAt : null
  const nextUpLabel = useMemo(() => {
    const cur = workout && currentSet(workout)
    return cur ? `${cur.exercise.name} · Set ${cur.setNumber} of ${cur.totalSets}` : ''
  }, [workout])

  useEffect(() => {
    if (restEndsAt == null) return
    const remaining = restEndsAt - Date.now()
    const timers = [3, 2, 1]
      .map((s) => remaining - s * 1000)
      .filter((ms) => ms > 0)
      .map((ms) => window.setTimeout(playTick, ms))
    timers.push(
      window.setTimeout(() => {
        // Skip a stale alarm if the app was closed long past the end of rest.
        if (Date.now() - restEndsAt < STALE_ALARM_MS) restOverAlert(nextUpLabel)
        dispatch({ type: 'endRest' })
      }, Math.max(0, remaining)),
    )
    return () => timers.forEach(clearTimeout)
  }, [restEndsAt, nextUpLabel, dispatch])

  const api = useMemo(
    () => ({ workout, dispatch, start: (w: WorkoutState) => update(w), discard: () => update(null) }),
    [workout, dispatch, update],
  )

  return <ActiveWorkoutContext.Provider value={api}>{children}</ActiveWorkoutContext.Provider>
}
