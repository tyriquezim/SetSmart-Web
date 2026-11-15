import { describe, expect, it } from 'vitest'
import {
  canPostpone,
  createWorkout,
  currentSet,
  restRemainingMs,
  toLogPayload,
  workoutReducer,
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
    expect(workoutTotals(s)).toEqual({ setsLogged: 5, setsPlanned: 5, volumeKg: 400 + 960, exercisesDone: 3 })

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
