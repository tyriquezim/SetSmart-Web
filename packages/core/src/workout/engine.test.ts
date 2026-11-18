import { describe, expect, it } from 'vitest'
import {
  canPostpone,
  cardioElapsedMs,
  createWorkout,
  currentExercise,
  currentSet,
  restRemainingMs,
  toLogPayload,
  workoutReducer,
  workoutPRs,
  workoutTotals,
  type WorkoutAction,
  type WorkoutState,
} from './engine'

const T0 = Date.UTC(2026, 10, 15, 8, 0, 0)

function make(): WorkoutState {
  return createWorkout({
    id: 'w1',
    routineId: 'r1',
    name: 'Push day',
    now: T0,
    exercises: [
      { exerciseId: 'bench', name: 'Bench', restSeconds: 120, sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }] },
      { exerciseId: 'ohp', name: 'OHP', restSeconds: 90, sets: [{ reps: 10, weightKg: 40 }] },
      { exerciseId: 'dips', name: 'Dips', restSeconds: 0, sets: [{ reps: 12, weightKg: null }, { reps: 12, weightKg: null }] },
    ],
  })
}

const run = (s: WorkoutState, ...actions: WorkoutAction[]) => actions.reduce(workoutReducer, s)
const log = (reps: number, weightKg: number | null, now = T0): WorkoutAction => ({ type: 'logSet', reps, weightKg, now })

describe('workout engine', () => {
  it('starts on set 1 of the first exercise', () => {
    const s = make()
    const cur = currentSet(s)!
    expect(s.phase.kind).toBe('set')
    expect(cur.exercise.name).toBe('Bench')
    expect(cur.setNumber).toBe(1)
    expect(cur.totalSets).toBe(2)
    expect(cur.target).toEqual({ reps: 8, weightKg: 60 })
  })

  it('logging a set starts rest with an absolute end time', () => {
    const s = run(make(), log(8, 60, T0))
    expect(s.phase).toEqual({ kind: 'rest', startedAt: T0, endsAt: T0 + 120_000 })
    expect(restRemainingMs(s, T0 + 30_000)).toBe(90_000)
    expect(restRemainingMs(s, T0 + 999_999)).toBe(0)
    // During rest, the next set is still the same exercise, set 2
    expect(currentSet(s)!.setNumber).toBe(2)
  })

  it('records target vs actual reps', () => {
    const s = run(make(), log(6, 62.5))
    expect(s.exercises[0].logged[0]).toMatchObject({ reps: 6, weightKg: 62.5, targetReps: 8, targetWeightKg: 60 })
  })

  it('advances to the next exercise after the last set', () => {
    const s = run(make(), log(8, 60), { type: 'endRest' }, log(8, 60))
    expect(s.exercises[0].status).toBe('done')
    expect(s.phase.kind).toBe('rest')
    expect(currentSet(s)!.exercise.name).toBe('OHP')
  })

  it('adjusts and skips rest', () => {
    let s = run(make(), log(8, 60, T0))
    s = workoutReducer(s, { type: 'adjustRest', deltaSeconds: 15, now: T0 })
    expect(s.phase.kind === 'rest' && s.phase.endsAt).toBe(T0 + 135_000)
    s = workoutReducer(s, { type: 'adjustRest', deltaSeconds: -500, now: T0 + 10_000 })
    expect(restRemainingMs(s, T0 + 10_000)).toBe(0)
    s = workoutReducer(s, { type: 'endRest' })
    expect(s.phase.kind).toBe('set')
  })

  it('skips rest entirely when rest is 0', () => {
    const s = run(make(), { type: 'postpone', to: 'end' }, { type: 'postpone', to: 'end' }, log(12, null))
    expect(currentSet(s)!.exercise.name).toBe('Dips')
    expect(s.phase.kind).toBe('set')
  })

  it('ignores logSet during rest', () => {
    const s = run(make(), log(8, 60))
    expect(workoutReducer(s, log(8, 60))).toBe(s)
  })

  describe('postpone', () => {
    it('moves the current exercise after the next one', () => {
      const s = run(make(), { type: 'postpone', to: 'next' })
      expect(s.queue).toEqual([1, 0, 2])
      expect(currentSet(s)!.exercise.name).toBe('OHP')
    })

    it('can be repeated to push it back further', () => {
      let s = run(make(), { type: 'postpone', to: 'next' })
      // do OHP, then Bench is up; postpone Bench again behind Dips
      s = run(s, log(10, 40), { type: 'endRest' })
      expect(currentSet(s)!.exercise.name).toBe('Bench')
      s = workoutReducer(s, { type: 'postpone', to: 'next' })
      expect(currentSet(s)!.exercise.name).toBe('Dips')
      expect(s.queue).toEqual([2, 0])
    })

    it('can send to the end', () => {
      const s = run(make(), { type: 'postpone', to: 'end' })
      expect(s.queue).toEqual([1, 2, 0])
    })

    it('works during rest to change what is up next', () => {
      const s = run(make(), log(8, 60), log(8, 60, T0) /* ignored */, { type: 'endRest' }, log(8, 60))
      expect(currentSet(s)!.exercise.name).toBe('OHP')
      const p = workoutReducer(s, { type: 'postpone', to: 'next' })
      expect(p.phase.kind).toBe('rest')
      expect(currentSet(p)!.exercise.name).toBe('Dips')
    })

    it('keeps partial progress when postponing mid-exercise', () => {
      let s = run(make(), log(8, 60), { type: 'endRest' }, { type: 'postpone', to: 'next' })
      expect(currentSet(s)!.exercise.name).toBe('OHP')
      s = run(s, log(10, 40), { type: 'endRest' })
      const cur = currentSet(s)!
      expect(cur.exercise.name).toBe('Bench')
      expect(cur.setNumber).toBe(2)
    })

    it('is not possible with one exercise left', () => {
      const s = run(make(), { type: 'skipExercise', now: T0 }, { type: 'skipExercise', now: T0 })
      expect(canPostpone(s)).toBe(false)
      expect(workoutReducer(s, { type: 'postpone', to: 'next' })).toBe(s)
    })
  })

  it('completes after the last exercise and records performed order', () => {
    const end = T0 + 3_600_000
    const s = run(
      make(),
      { type: 'postpone', to: 'next' },
      log(10, 40), { type: 'endRest' },
      log(8, 60), { type: 'endRest' },
      log(8, 60), { type: 'endRest' },
      log(12, null), log(10, null, end),
    )
    expect(s.phase.kind).toBe('complete')
    expect(s.finishedAt).toBe(new Date(end).toISOString())
    expect(s.performedOrder).toEqual([1, 0, 2])
    expect(workoutTotals(s)).toMatchObject({ setsLogged: 5, setsPlanned: 5, volumeKg: 400 + 960, exercisesDone: 3 })

    const payload = toLogPayload(s)
    expect(payload.sets.map((x) => [x.exercise_id, x.exercise_position, x.set_number])).toEqual([
      ['ohp', 0, 1],
      ['bench', 1, 1],
      ['bench', 1, 2],
      ['dips', 2, 1],
      ['dips', 2, 2],
    ])
  })

  it('skipping marks untouched exercises skipped and excludes them from the payload', () => {
    const s = run(make(), { type: 'skipExercise', now: T0 })
    expect(s.exercises[0].status).toBe('skipped')
    expect(toLogPayload(s).sets).toEqual([])
  })

  it('adds an extra set to the current exercise', () => {
    const s = run(make(), { type: 'addSet' })
    expect(currentSet(s)!.totalSets).toBe(3)
  })

  it('edits a logged set', () => {
    const s = run(make(), log(8, 60), { type: 'editLoggedSet', exerciseIndex: 0, setIndex: 0, reps: 7, weightKg: 57.5 })
    expect(s.exercises[0].logged[0]).toMatchObject({ reps: 7, weightKg: 57.5 })
  })

  it('can finish early and reopen', () => {
    let s = run(make(), log(8, 60), { type: 'finish', now: T0 + 1000 })
    expect(s.phase.kind).toBe('complete')
    s = workoutReducer(s, { type: 'reopen' })
    expect(s.phase.kind).toBe('set')
    expect(s.finishedAt).toBeNull()
    expect(currentSet(s)!.setNumber).toBe(2)
  })

  it('drops exercises with no planned sets', () => {
    const s = createWorkout({ id: 'x', routineId: null, name: 'x', now: T0, exercises: [{ exerciseId: 'a', name: 'A', restSeconds: 60, sets: [] }] })
    expect(s.exercises).toEqual([])
    expect(s.phase.kind).toBe('complete')
  })
})

describe('history and PRs', () => {
  const history = { lastSets: [{ reps: 8, weightKg: 57.5 }, { reps: 6, weightKg: 57.5 }], lastPerformedAt: '2026-11-08T08:00:00Z', bestE1rmKg: 72, maxWeightKg: 57.5, maxReps: 8 }
  const withHistory = () =>
    createWorkout({
      id: 'w2', routineId: null, name: 'x', now: T0,
      exercises: [
        { exerciseId: 'bench', name: 'Bench', restSeconds: 0, sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }], history },
        { exerciseId: 'new', name: 'New thing', restSeconds: 0, sets: [{ reps: 5, weightKg: 100 }] },
      ],
    })

  it('exposes last time for the matching set number, clamped to the last set', () => {
    let s = withHistory()
    expect(currentSet(s)!.lastTime).toEqual({ reps: 8, weightKg: 57.5 })
    s = run(s, log(8, 60))
    expect(currentSet(s)!.lastTime).toEqual({ reps: 6, weightKg: 57.5 })
    s = run(s, log(8, 60))
    expect(currentSet(s)!.lastTime).toEqual({ reps: 6, weightKg: 57.5 })
  })

  it('flags PRs only against previous history', () => {
    const s = run(withHistory(), log(8, 60), log(8, 60), log(8, 60), log(5, 100))
    expect(workoutPRs(s)).toEqual([{ exerciseIndex: 0, e1rm: true, weight: true }])
  })

  it('ignores rounding noise from stored weights', () => {
    const s = run(withHistory(), log(1, 57.5 + 0.004))
    expect(workoutPRs(s)).toEqual([])
  })
})

describe('cardio exercises', () => {
  // Bench (1 set, 60 s rest), then a treadmill run with a 20-minute goal, then dips
  function mixed(): WorkoutState {
    return createWorkout({
      id: 'w2',
      routineId: 'r2',
      name: 'Push and run',
      now: T0,
      exercises: [
        { exerciseId: 'bench', name: 'Bench', restSeconds: 60, sets: [{ reps: 8, weightKg: 60 }] },
        { exerciseId: 'tread', name: 'Treadmill Run', restSeconds: 0, sets: [], cardio: { activity: 'run', met: null, targetDurationS: 1200 } },
        { exerciseId: 'dips', name: 'Dips', restSeconds: 0, sets: [{ reps: 12, weightKg: null }] },
      ],
    })
  }
  const MIN = 60_000

  it('keeps cardio exercises even though they have no sets', () => {
    const s = mixed()
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'tread', 'dips'])
    expect(s.exercises[1].cardioLog).toBeNull()
  })

  it('times cardio, excluding pauses, and logs it with the timed duration', () => {
    let s = run(mixed(), log(8, 60, T0), { type: 'endRest' })
    expect(currentSet(s)).toBeNull()
    expect(currentExercise(s)!.exercise.name).toBe('Treadmill Run')
    // Sets can't be logged against cardio
    expect(run(s, log(5, 5))).toBe(s)

    const start = T0 + 2 * MIN
    s = run(s, { type: 'startCardio', now: start })
    expect(s.phase).toMatchObject({ kind: 'cardio', exerciseIndex: 1, runningSince: start, endedAt: null })
    expect(canPostpone(s)).toBe(false)
    expect(cardioElapsedMs(s, start + 5 * MIN)).toBe(5 * MIN)

    s = run(s, { type: 'pauseCardio', now: start + 5 * MIN })
    expect(cardioElapsedMs(s, start + 9 * MIN)).toBe(5 * MIN)
    s = run(s, { type: 'resumeCardio', now: start + 7 * MIN }, { type: 'endCardio', now: start + 25 * MIN })
    expect(s.phase).toMatchObject({ kind: 'cardio', accumulatedMs: 23 * MIN, runningSince: null, endedAt: start + 25 * MIN })

    s = run(s, { type: 'logCardio', durationS: 23 * 60, distanceM: 4000, effort: null, now: start + 26 * MIN })
    expect(s.phase).toEqual({ kind: 'set' })
    expect(s.exercises[1]).toMatchObject({
      status: 'done',
      cardioLog: { startedAt: new Date(start).toISOString(), durationS: 1380, distanceM: 4000, effort: null },
    })
    expect(currentSet(s)!.exercise.name).toBe('Dips')
    expect(workoutTotals(s)).toMatchObject({ cardioLogged: 1, cardioPlanned: 1, cardioSeconds: 1380, setsPlanned: 2 })

    s = run(s, log(12, null, start + 30 * MIN))
    expect(s.phase.kind).toBe('complete')
    const payload = toLogPayload(s)
    expect(payload.sets.map((x) => [x.exercise_id, x.exercise_position])).toEqual([
      ['bench', 0],
      ['dips', 2],
    ])
    expect(payload.cardio).toEqual([
      {
        exercise_id: 'tread',
        exercise_position: 1,
        target_duration_s: 1200,
        started_at: new Date(start).toISOString(),
        duration_s: 1380,
        distance_m: 4000,
        effort: null,
      },
    ])
  })

  it("can't log cardio before the timer is ended", () => {
    let s = run(mixed(), log(8, 60), { type: 'endRest' }, { type: 'startCardio', now: T0 })
    expect(run(s, { type: 'logCardio', durationS: 60, distanceM: null, effort: null, now: T0 })).toBe(s)
    // Resuming after an accidental end keeps going without counting the gap
    s = run(s, { type: 'endCardio', now: T0 + MIN }, { type: 'resumeCardio', now: T0 + 3 * MIN })
    expect(s.phase).toMatchObject({ endedAt: null, accumulatedMs: MIN, runningSince: T0 + 3 * MIN })
  })

  it('only starts the timer on a cardio exercise', () => {
    const s = mixed()
    expect(run(s, { type: 'startCardio', now: T0 })).toBe(s)
  })

  it('cancelling or skipping discards the timer', () => {
    const timing = run(mixed(), log(8, 60), { type: 'endRest' }, { type: 'startCardio', now: T0 })
    expect(run(timing, { type: 'cancelCardio' }).phase).toEqual({ kind: 'set' })
    const skipped = run(timing, { type: 'skipExercise', now: T0 })
    expect(skipped.phase).toEqual({ kind: 'set' })
    expect(skipped.exercises[1].status).toBe('skipped')
    expect(currentSet(skipped)!.exercise.name).toBe('Dips')
    expect(toLogPayload(skipped).cardio).toEqual([])
  })

  it('treats workouts saved before cardio existed as weights only', () => {
    const s = make()
    expect(toLogPayload(s).cardio).toEqual([])
    expect(workoutTotals(s)).toMatchObject({ cardioPlanned: 0, cardioLogged: 0 })
  })
})
