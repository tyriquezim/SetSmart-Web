/**
 * Workout player engine: a pure reducer with no UI or platform dependencies,
 * shared by the web app and (later) the React Native app.
 *
 * Model:
 * - `exercises` is the fixed list from the routine; indices never change.
 * - `queue` holds indices of exercises still to do; `queue[0]` is the current
 *   (or, during rest, the upcoming) exercise. Postponing reorders the queue.
 * - Time is passed in via actions (`now`, epoch ms) so the reducer stays pure
 *   and the rest timer survives tab switches/reloads: it stores an absolute
 *   `endsAt`, not a countdown.
 * - Cardio exercises have no sets. They are timed instead: the 'cardio' phase
 *   holds the timer (also as absolute times, so it survives reloads), and once
 *   the timer is ended the user adds a distance or effort and logs it.
 */
import { estimateOneRepMax } from '../progress/stats'
import type { CardioActivity, CardioEffort, ExerciseHistory, PlannedSet, Routine } from '../types'

export interface LoggedSet {
  reps: number
  weightKg: number | null
  targetReps: number | null
  targetWeightKg: number | null
  completedAt: string
}

export type ExerciseStatus = 'pending' | 'done' | 'skipped'

/** What a cardio exercise is, and its goal. */
export interface CardioPlan {
  activity: CardioActivity
  /** MET value for an 'other' exercise */
  met: number | null
  /** Goal duration in seconds, or null for no goal */
  targetDurationS: number | null
}

export interface LoggedCardioEntry {
  /** When the timer was first started */
  startedAt: string
  /** Timed length in seconds, excluding pauses */
  durationS: number
  distanceM: number | null
  effort: CardioEffort | null
  completedAt: string
}

export interface WorkoutExercise {
  exerciseId: string
  name: string
  restSeconds: number
  sets: PlannedSet[]
  logged: LoggedSet[]
  status: ExerciseStatus
  /** Previous performance, if known when the workout started. */
  history?: ExerciseHistory
  /** Set for cardio exercises, which are timed instead of logged as sets (sets is empty). */
  cardio?: CardioPlan
  /** The logged cardio, once the timer has been ended and saved */
  cardioLog?: LoggedCardioEntry | null
}

export type WorkoutPhase =
  | { kind: 'set' }
  | { kind: 'rest'; startedAt: number; endsAt: number }
  /**
   * Timing the current (cardio) exercise. Elapsed time is `accumulatedMs` plus
   * `now - runningSince` while running; `runningSince` is null while paused.
   * `endedAt` is set once the user ends it, and then the log form is shown.
   */
  | {
      kind: 'cardio'
      exerciseIndex: number
      startedAt: number
      accumulatedMs: number
      runningSince: number | null
      endedAt: number | null
    }
  | { kind: 'complete' }

export interface WorkoutState {
  version: 1
  id: string
  routineId: string | null
  name: string
  startedAt: string
  finishedAt: string | null
  exercises: WorkoutExercise[]
  queue: number[]
  /** Exercise indices in the order they were first performed. */
  performedOrder: number[]
  phase: WorkoutPhase
}

export type WorkoutAction =
  | { type: 'logSet'; reps: number; weightKg: number | null; now: number }
  | { type: 'endRest' }
  | { type: 'adjustRest'; deltaSeconds: number; now: number }
  | { type: 'postpone'; to: 'next' | 'end' }
  | { type: 'skipExercise'; now: number }
  | { type: 'addSet' }
  | { type: 'editLoggedSet'; exerciseIndex: number; setIndex: number; reps: number; weightKg: number | null }
  | { type: 'finish'; now: number }
  | { type: 'reopen' }
  | { type: 'startCardio'; now: number }
  | { type: 'pauseCardio'; now: number }
  | { type: 'resumeCardio'; now: number }
  | { type: 'endCardio'; now: number }
  /** Discard the timer and go back to the start screen */
  | { type: 'cancelCardio' }
  | { type: 'logCardio'; durationS: number; distanceM: number | null; effort: CardioEffort | null; now: number }

export interface CreateWorkoutInput {
  id: string
  routineId: string | null
  name: string
  exercises: Array<{
    exerciseId: string
    name: string
    restSeconds: number
    sets: PlannedSet[]
    history?: ExerciseHistory
    cardio?: CardioPlan
  }>
  now: number
}

export const isCardio = (e: WorkoutExercise): boolean => e.cardio != null

export function createWorkout(input: CreateWorkoutInput): WorkoutState {
  const exercises: WorkoutExercise[] = input.exercises
    .filter((e) => e.cardio != null || e.sets.length > 0)
    .map((e) =>
      e.cardio
        ? { ...e, sets: [], logged: [], status: 'pending' as const, cardio: { ...e.cardio }, cardioLog: null }
        : { ...e, sets: e.sets.map((s) => ({ ...s })), logged: [], status: 'pending' as const },
    )
  return {
    version: 1,
    id: input.id,
    routineId: input.routineId,
    name: input.name,
    startedAt: new Date(input.now).toISOString(),
    finishedAt: null,
    exercises,
    queue: exercises.map((_, i) => i),
    performedOrder: [],
    phase: exercises.length > 0 ? { kind: 'set' } : { kind: 'complete' },
  }
}

export function createWorkoutFromRoutine(
  routine: Routine,
  id: string,
  now: number,
  history: Record<string, ExerciseHistory> = {},
): WorkoutState {
  return createWorkout({
    id,
    routineId: routine.id,
    name: routine.name,
    now,
    exercises: routine.exercises.map((re) => ({
      exerciseId: re.exerciseId,
      name: re.exercise.name,
      restSeconds: re.restSeconds,
      sets: re.sets,
      history: history[re.exerciseId],
      cardio:
        re.exercise.kind === 'cardio' && re.exercise.cardioActivity
          ? { activity: re.exercise.cardioActivity, met: re.exercise.cardioMet, targetDurationS: re.targetDurationS }
          : undefined,
    })),
  })
}

function complete(state: WorkoutState, now: number): WorkoutState {
  return { ...state, phase: { kind: 'complete' }, finishedAt: new Date(now).toISOString() }
}

function replaceExercise(state: WorkoutState, index: number, ex: WorkoutExercise): WorkoutExercise[] {
  return state.exercises.map((e, i) => (i === index ? ex : e))
}

/** The current exercise is cardio and its timer hasn't been started. */
function atCardioStart(state: WorkoutState): boolean {
  return state.phase.kind === 'set' && state.queue.length > 0 && isCardio(state.exercises[state.queue[0]])
}

/** Milliseconds timed so far in the cardio phase (0 in any other phase). */
export function cardioElapsedMs(state: WorkoutState, now: number): number {
  const p = state.phase
  if (p.kind !== 'cardio') return 0
  return p.accumulatedMs + (p.runningSince != null ? Math.max(0, now - p.runningSince) : 0)
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'logSet': {
      if (state.phase.kind !== 'set' || state.queue.length === 0) return state
      const index = state.queue[0]
      const ex = state.exercises[index]
      if (isCardio(ex)) return state
      const target = ex.sets[ex.logged.length] ?? ex.sets[ex.sets.length - 1]
      const logged: LoggedSet = {
        reps: Math.max(0, Math.round(action.reps)),
        weightKg: action.weightKg == null ? null : Math.max(0, action.weightKg),
        targetReps: target?.reps ?? null,
        targetWeightKg: target?.weightKg ?? null,
        completedAt: new Date(action.now).toISOString(),
      }
      const updated: WorkoutExercise = { ...ex, logged: [...ex.logged, logged] }
      const exerciseDone = updated.logged.length >= updated.sets.length
      if (exerciseDone) updated.status = 'done'

      const next: WorkoutState = {
        ...state,
        exercises: replaceExercise(state, index, updated),
        performedOrder: state.performedOrder.includes(index)
          ? state.performedOrder
          : [...state.performedOrder, index],
        queue: exerciseDone ? state.queue.slice(1) : state.queue,
      }
      if (next.queue.length === 0) return complete(next, action.now)
      if (ex.restSeconds <= 0) return { ...next, phase: { kind: 'set' } }
      return {
        ...next,
        phase: { kind: 'rest', startedAt: action.now, endsAt: action.now + ex.restSeconds * 1000 },
      }
    }

    case 'endRest':
      return state.phase.kind === 'rest' ? { ...state, phase: { kind: 'set' } } : state

    case 'adjustRest': {
      if (state.phase.kind !== 'rest') return state
      const endsAt = Math.max(action.now, state.phase.endsAt + action.deltaSeconds * 1000)
      return { ...state, phase: { ...state.phase, endsAt } }
    }

    case 'postpone': {
      if (!canPostpone(state)) return state
      const [current, ...rest] = state.queue
      const queue =
        action.to === 'next' ? [rest[0], current, ...rest.slice(1)] : [...rest, current]
      return { ...state, queue }
    }

    case 'skipExercise': {
      if (state.phase.kind === 'complete' || state.queue.length === 0) return state
      const index = state.queue[0]
      const ex = state.exercises[index]
      const next: WorkoutState = {
        ...state,
        exercises: replaceExercise(state, index, {
          ...ex,
          status: ex.logged.length > 0 ? 'done' : 'skipped',
        }),
        queue: state.queue.slice(1),
        // Skipping cardio mid-timer discards the timer.
        phase: state.phase.kind === 'cardio' ? { kind: 'set' } : state.phase,
      }
      return next.queue.length === 0 ? complete(next, action.now) : next
    }

    case 'addSet': {
      if (state.phase.kind === 'complete' || state.queue.length === 0) return state
      const index = state.queue[0]
      const ex = state.exercises[index]
      if (isCardio(ex)) return state
      const last = ex.sets[ex.sets.length - 1] ?? { reps: 10, weightKg: null }
      return {
        ...state,
        exercises: replaceExercise(state, index, { ...ex, sets: [...ex.sets, { ...last }] }),
      }
    }

    case 'editLoggedSet': {
      const ex = state.exercises[action.exerciseIndex]
      if (!ex || !ex.logged[action.setIndex]) return state
      const logged = ex.logged.map((s, i) =>
        i === action.setIndex
          ? { ...s, reps: Math.max(0, Math.round(action.reps)), weightKg: action.weightKg }
          : s,
      )
      return { ...state, exercises: replaceExercise(state, action.exerciseIndex, { ...ex, logged }) }
    }

    case 'finish':
      return state.phase.kind === 'complete' ? state : complete(state, action.now)

    case 'reopen':
      if (state.phase.kind !== 'complete' || state.queue.length === 0) return state
      return { ...state, phase: { kind: 'set' }, finishedAt: null }

    case 'startCardio':
      if (!atCardioStart(state)) return state
      return {
        ...state,
        phase: {
          kind: 'cardio',
          exerciseIndex: state.queue[0],
          startedAt: action.now,
          accumulatedMs: 0,
          runningSince: action.now,
          endedAt: null,
        },
      }

    case 'pauseCardio': {
      const p = state.phase
      if (p.kind !== 'cardio' || p.runningSince == null) return state
      return { ...state, phase: { ...p, accumulatedMs: cardioElapsedMs(state, action.now), runningSince: null } }
    }

    case 'resumeCardio': {
      // Also undoes an accidental "End": the time in between isn't counted.
      const p = state.phase
      if (p.kind !== 'cardio' || p.runningSince != null) return state
      return { ...state, phase: { ...p, runningSince: action.now, endedAt: null } }
    }

    case 'endCardio': {
      const p = state.phase
      if (p.kind !== 'cardio' || p.endedAt != null) return state
      return {
        ...state,
        phase: { ...p, accumulatedMs: cardioElapsedMs(state, action.now), runningSince: null, endedAt: action.now },
      }
    }

    case 'cancelCardio':
      return state.phase.kind === 'cardio' ? { ...state, phase: { kind: 'set' } } : state

    case 'logCardio': {
      const p = state.phase
      if (p.kind !== 'cardio' || p.endedAt == null) return state
      const index = p.exerciseIndex
      const ex = state.exercises[index]
      const cardioLog: LoggedCardioEntry = {
        startedAt: new Date(p.startedAt).toISOString(),
        durationS: Math.min(86_400, Math.max(1, Math.round(action.durationS))),
        distanceM: action.distanceM != null && action.distanceM > 0 ? action.distanceM : null,
        effort: action.effort,
        completedAt: new Date(action.now).toISOString(),
      }
      const next: WorkoutState = {
        ...state,
        exercises: replaceExercise(state, index, { ...ex, cardioLog, status: 'done' }),
        performedOrder: state.performedOrder.includes(index) ? state.performedOrder : [...state.performedOrder, index],
        queue: state.queue.filter((i) => i !== index),
        phase: { kind: 'set' },
      }
      return next.queue.length === 0 ? complete(next, action.now) : next
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export interface CurrentSetInfo {
  exerciseIndex: number
  exercise: WorkoutExercise
  /** 1-based set number about to be performed */
  setNumber: number
  totalSets: number
  target: PlannedSet
  /** Most recent logged set for this exercise, useful for prefilling inputs. */
  previous: LoggedSet | null
  /** The same set number from the last session this exercise was done (or its last set). */
  lastTime: PlannedSet | null
}

/** The exercise being done now (or, during rest, the one up next). */
export function currentExercise(state: WorkoutState): { exerciseIndex: number; exercise: WorkoutExercise } | null {
  if (state.phase.kind === 'complete' || state.queue.length === 0) return null
  return { exerciseIndex: state.queue[0], exercise: state.exercises[state.queue[0]] }
}

/** The set that will be performed next (current set, or the one after rest). Null when the current exercise is cardio. */
export function currentSet(state: WorkoutState): CurrentSetInfo | null {
  const cur = currentExercise(state)
  if (!cur || isCardio(cur.exercise)) return null
  const { exerciseIndex, exercise } = cur
  const i = Math.min(exercise.logged.length, exercise.sets.length - 1)
  return {
    exerciseIndex,
    exercise,
    setNumber: exercise.logged.length + 1,
    totalSets: exercise.sets.length,
    target: exercise.sets[i],
    previous: exercise.logged[exercise.logged.length - 1] ?? null,
    lastTime: lastTimeFor(exercise, exercise.logged.length),
  }
}

function lastTimeFor(exercise: WorkoutExercise, setIndex: number): PlannedSet | null {
  const last = exercise.history?.lastSets
  if (!last || last.length === 0) return null
  return last[Math.min(setIndex, last.length - 1)]
}

/** Stored weights are rounded (numeric(7,3)); ignore differences smaller than this. */
const PR_TOLERANCE_KG = 0.01

export interface ExercisePRs {
  exerciseIndex: number
  /** New best estimated 1RM vs. all previous sessions */
  e1rm: boolean
  /** New heaviest weight lifted */
  weight: boolean
}

/**
 * Personal records set in this workout. Only exercises with previous history
 * count (a first attempt isn't a record yet).
 */
export function workoutPRs(state: WorkoutState): ExercisePRs[] {
  return state.exercises.flatMap((ex, exerciseIndex) => {
    const h = ex.history
    if (!h || ex.logged.length === 0) return []
    let bestE1rm = 0
    let maxWeight = 0
    for (const s of ex.logged) {
      bestE1rm = Math.max(bestE1rm, estimateOneRepMax(s.weightKg, s.reps) ?? 0)
      if (s.reps > 0) maxWeight = Math.max(maxWeight, s.weightKg ?? 0)
    }
    const e1rm = h.bestE1rmKg != null && bestE1rm > h.bestE1rmKg + PR_TOLERANCE_KG
    const weight = h.maxWeightKg != null && maxWeight > h.maxWeightKg + PR_TOLERANCE_KG
    return e1rm || weight ? [{ exerciseIndex, e1rm, weight }] : []
  })
}

/** Whether the current exercise can be swapped with the next. Not while a cardio timer is going. */
export function canPostpone(state: WorkoutState): boolean {
  return state.phase.kind !== 'complete' && state.phase.kind !== 'cardio' && state.queue.length >= 2
}

export function restRemainingMs(state: WorkoutState, now: number): number {
  return state.phase.kind === 'rest' ? Math.max(0, state.phase.endsAt - now) : 0
}

export interface WorkoutTotals {
  setsLogged: number
  setsPlanned: number
  volumeKg: number
  exercisesDone: number
  /** Cardio exercises logged, and planned */
  cardioLogged: number
  cardioPlanned: number
  /** Seconds of cardio logged */
  cardioSeconds: number
}

export function workoutTotals(state: WorkoutState): WorkoutTotals {
  let setsLogged = 0
  let setsPlanned = 0
  let volumeKg = 0
  let exercisesDone = 0
  let cardioLogged = 0
  let cardioPlanned = 0
  let cardioSeconds = 0
  for (const ex of state.exercises) {
    setsLogged += ex.logged.length
    setsPlanned += ex.sets.length
    if (ex.status === 'done') exercisesDone++
    for (const s of ex.logged) volumeKg += s.reps * (s.weightKg ?? 0)
    if (isCardio(ex)) {
      cardioPlanned++
      if (ex.cardioLog) {
        cardioLogged++
        cardioSeconds += ex.cardioLog.durationS
      }
    }
  }
  return { setsLogged, setsPlanned, volumeKg, exercisesDone, cardioLogged, cardioPlanned, cardioSeconds }
}

/** Payload for the `log_workout` RPC. */
export interface LogWorkoutPayload {
  id: string
  routine_id: string | null
  name: string
  started_at: string
  finished_at: string
  notes: string | null
  sets: Array<{
    exercise_id: string
    exercise_position: number
    set_number: number
    target_reps: number | null
    target_weight_kg: number | null
    reps: number
    weight_kg: number | null
    completed_at: string
  }>
  cardio: Array<{
    exercise_id: string
    exercise_position: number
    target_duration_s: number | null
    started_at: string
    duration_s: number
    distance_m: number | null
    effort: CardioEffort | null
  }>
}

export function toLogPayload(state: WorkoutState, notes: string | null = null): LogWorkoutPayload {
  return {
    id: state.id,
    routine_id: state.routineId,
    name: state.name,
    started_at: state.startedAt,
    finished_at: state.finishedAt ?? new Date().toISOString(),
    notes,
    sets: state.performedOrder.flatMap((exIndex, position) =>
      state.exercises[exIndex].logged.map((s, i) => ({
        exercise_id: state.exercises[exIndex].exerciseId,
        exercise_position: position,
        set_number: i + 1,
        target_reps: s.targetReps,
        target_weight_kg: s.targetWeightKg,
        reps: s.reps,
        weight_kg: s.weightKg,
        completed_at: s.completedAt,
      })),
    ),
    cardio: state.performedOrder.flatMap((exIndex, position) => {
      const e = state.exercises[exIndex]
      if (!e.cardio || !e.cardioLog) return []
      return [
        {
          exercise_id: e.exerciseId,
          exercise_position: position,
          target_duration_s: e.cardio.targetDurationS,
          started_at: e.cardioLog.startedAt,
          duration_s: e.cardioLog.durationS,
          distance_m: e.cardioLog.distanceM,
          effort: e.cardioLog.effort,
        },
      ]
    }),
  }
}
