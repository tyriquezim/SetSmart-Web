import { describe, expect, it } from 'vitest'
import type { ExerciseSessionStat } from '../types'
import {
  bodyWeightTrend,
  changeOver,
  dateToMs,
  estimateOneRepMax,
  personalRecords,
  summariseExercises,
  todayIsoDate,
} from './stats'

const stat = (p: Partial<ExerciseSessionStat> & { sessionId: string; startedAt: string }): ExerciseSessionStat => ({
  exerciseId: 'bench',
  setCount: 3,
  maxReps: 8,
  maxWeightKg: 60,
  bestE1rmKg: 76,
  volumeKg: 1440,
  totalReps: 24,
  ...p,
})

describe('estimateOneRepMax', () => {
  it('uses Epley within 1-12 reps', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.33, 2)
  })
  it('is null when unreliable or unweighted', () => {
    expect(estimateOneRepMax(100, 15)).toBeNull()
    expect(estimateOneRepMax(null, 5)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
    expect(estimateOneRepMax(100, 0)).toBeNull()
  })
})

describe('dates', () => {
  it('round-trips local dates', () => {
    const d = new Date(2026, 0, 5, 23, 30)
    expect(todayIsoDate(d)).toBe('2026-01-05')
    expect(new Date(dateToMs('2026-01-05')).getDate()).toBe(5)
  })
})

describe('bodyWeightTrend', () => {
  const e = (measuredOn: string, weightKg: number) => ({ id: measuredOn, measuredOn, weightKg, bodyFatPct: null, note: null })
  it('averages over a trailing 7-day window', () => {
    const trend = bodyWeightTrend([e('2026-01-01', 80), e('2026-01-03', 82), e('2026-01-07', 84), e('2026-01-08', 86)])
    expect(trend.map((p) => p.v)).toEqual([80, 81, 82, (82 + 84 + 86) / 3])
  })
  it('handles empty input', () => {
    expect(bodyWeightTrend([])).toEqual([])
  })
})

describe('changeOver', () => {
  const day = 86_400_000
  it('compares against the reading at least N days old', () => {
    const pts = [
      { t: 0, v: 90 },
      { t: 10 * day, v: 88 },
      { t: 40 * day, v: 85 },
    ]
    expect(changeOver(pts, 30)).toBe(85 - 88)
    expect(changeOver(pts, 100)).toBeNull()
  })
})

describe('personalRecords', () => {
  it('finds the first session that set each record', () => {
    const recs = personalRecords([
      stat({ sessionId: 'a', startedAt: '2026-01-01T00:00:00Z', bestE1rmKg: 80, maxWeightKg: 70 }),
      stat({ sessionId: 'b', startedAt: '2026-01-08T00:00:00Z', bestE1rmKg: 85, maxWeightKg: 70, volumeKg: 2000 }),
      stat({ sessionId: 'c', startedAt: '2026-01-15T00:00:00Z', bestE1rmKg: 85, maxWeightKg: 72.5 }),
    ])
    expect(recs.e1rm).toMatchObject({ value: 85, sessionId: 'b' })
    expect(recs.maxWeight).toMatchObject({ value: 72.5, sessionId: 'c' })
    expect(recs.volume).toMatchObject({ value: 2000, sessionId: 'b' })
  })
  it('returns null records for no data', () => {
    expect(personalRecords([]).e1rm).toBeNull()
  })
})

describe('summariseExercises', () => {
  it('groups by exercise, newest first, using reps for bodyweight-only moves', () => {
    const out = summariseExercises([
      stat({ sessionId: 'a', startedAt: '2026-01-01T00:00:00Z' }),
      stat({ exerciseId: 'pullup', sessionId: 'a', startedAt: '2026-01-01T00:00:00Z', maxWeightKg: null, bestE1rmKg: null, maxReps: 8 }),
      stat({ exerciseId: 'pullup', sessionId: 'b', startedAt: '2026-01-05T00:00:00Z', maxWeightKg: null, bestE1rmKg: null, maxReps: 10 }),
    ])
    expect(out.map((x) => x.exerciseId)).toEqual(['pullup', 'bench'])
    expect(out[0]).toMatchObject({ primaryMetric: 'maxReps', best: 10, sessions: 2 })
    expect(out[1]).toMatchObject({ primaryMetric: 'e1rm', best: 76, sessions: 1 })
  })
})
