import { describe, expect, it } from 'vitest'
import type { BodyWeightEntry } from '../types'
import {
  bodyStatsOn,
  countedWorkoutMinutes,
  estimateDayEnergy,
  estimateWorkoutEnergy,
  missingDetails,
  restingEnergy,
  roundEstimate,
  workoutEnergy,
} from './estimates'

const w = (measuredOn: string, weightKg: number, bodyFatPct: number | null = null): BodyWeightEntry => ({
  id: measuredOn,
  measuredOn,
  weightKg,
  bodyFatPct,
  note: null,
})

const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString()

describe('restingEnergy', () => {
  it('uses Mifflin-St Jeor with the sex constant (published worked values)', () => {
    // 10 x 80 + 6.25 x 180 - 5 x 30 + 5 = 1780
    expect(restingEnergy({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', bodyFatPct: null })).toEqual({
      kcalPerDay: 1780,
      method: 'mifflin',
      fatFreeMassKg: null,
    })
    // 10 x 60 + 6.25 x 165 - 5 x 25 - 161 = 1345.25
    expect(restingEnergy({ weightKg: 60, heightCm: 165, age: 25, sex: 'female', bodyFatPct: null })?.kcalPerDay).toBe(1345.25)
  })

  it('averages the two sex constants when sex is not set', () => {
    const r = restingEnergy({ weightKg: 80, heightCm: 180, age: 30, sex: null, bodyFatPct: null })
    expect(r?.method).toBe('mifflin-average')
    expect(r?.kcalPerDay).toBe(1780 - 5 - 78)
  })

  it('prefers Cunningham from fat-free mass when body fat is known', () => {
    const r = restingEnergy({ weightKg: 80, heightCm: null, age: null, sex: null, bodyFatPct: 15 })
    expect(r?.method).toBe('cunningham')
    expect(r?.fatFreeMassKg).toBeCloseTo(68)
    expect(r?.kcalPerDay).toBeCloseTo(500 + 22 * 68) // 1996
  })

  it('returns null without height or age (and no body fat)', () => {
    expect(restingEnergy({ weightKg: 80, heightCm: null, age: 30, sex: 'male', bodyFatPct: null })).toBeNull()
    expect(restingEnergy({ weightKg: 80, heightCm: 180, age: null, sex: 'male', bodyFatPct: null })).toBeNull()
    expect(restingEnergy({ weightKg: 0, heightCm: 180, age: 30, sex: 'male', bodyFatPct: 15 })).toBeNull()
  })
})

describe('missingDetails', () => {
  it('lists weight, height and birth year as needed', () => {
    expect(missingDetails({ heightCm: null, birthYear: null }, null)).toEqual(['weight', 'height', 'birthYear'])
    expect(missingDetails({ heightCm: 180, birthYear: null }, { bodyFatPct: null })).toEqual(['birthYear'])
    expect(missingDetails({ heightCm: null, birthYear: null }, { bodyFatPct: 20 })).toEqual([])
  })
})

describe('bodyStatsOn', () => {
  const profile = { heightCm: 180, birthYear: 1995, sex: 'male' as const }
  const weights = [w('2026-01-01', 82, 18), w('2026-03-01', 80), w('2026-06-01', 78)]

  it('uses the latest weigh-in on or before the day, and the first one if none is earlier', () => {
    expect(bodyStatsOn('2026-04-15', weights, profile)?.weightKg).toBe(80)
    expect(bodyStatsOn('2025-12-01', weights, profile)?.weightKg).toBe(82)
    expect(bodyStatsOn('2026-06-01', weights, profile)?.weightKg).toBe(78)
  })

  it('ignores body fat readings more than 90 days away', () => {
    expect(bodyStatsOn('2026-03-15', weights, profile)?.bodyFatPct).toBe(18)
    expect(bodyStatsOn('2026-06-15', weights, profile)?.bodyFatPct).toBeNull()
  })

  it('works out age from birth year, and is null without weigh-ins', () => {
    expect(bodyStatsOn('2026-04-15', weights, profile)?.age).toBe(31)
    expect(bodyStatsOn('2026-04-15', [], profile)).toBeNull()
  })
})

describe('workouts', () => {
  it('counts energy above resting only: (MET x 3.5 x kg / 200 - resting/min) x minutes', () => {
    // gross 3.5 x 3.5 x 80 / 200 = 4.9 kcal/min; resting 1780 / 1440 = 1.236 kcal/min
    expect(workoutEnergy({ minutes: 60, effort: 'moderate', weightKg: 80, restingKcalPerDay: 1780 })).toBeCloseTo(
      (4.9 - 1780 / 1440) * 60,
    )
    // vigorous is 6.0 METs
    expect(workoutEnergy({ minutes: 60, effort: 'vigorous', weightKg: 80, restingKcalPerDay: 1780 })).toBeCloseTo(
      (8.4 - 1780 / 1440) * 60,
    )
  })

  it('never goes negative and caps long sessions at 3 hours', () => {
    expect(workoutEnergy({ minutes: 30, effort: 'moderate', weightKg: 10, restingKcalPerDay: 5000 })).toBe(0)
    expect(countedWorkoutMinutes({ startedAt: local(2026, 3, 1, 9), finishedAt: local(2026, 3, 1, 15) })).toBe(180)
    expect(countedWorkoutMinutes({ startedAt: local(2026, 3, 1, 9), finishedAt: local(2026, 3, 1, 8) })).toBe(0)
  })

  it('estimates a single workout from the body stats on its day', () => {
    const est = estimateWorkoutEnergy({
      workout: { startedAt: local(2026, 3, 2, 18), finishedAt: local(2026, 3, 2, 19) },
      profile: { heightCm: 180, birthYear: 1996, sex: 'male', workoutEffort: 'moderate' },
      weights: [w('2026-03-01', 80)],
    })
    expect(est?.kcal).toBeCloseTo((4.9 - 1780 / 1440) * 60)
    expect(est).toMatchObject({ minutes: 60, capped: false, met: 3.5, weightKg: 80, effort: 'moderate' })
    expect(est?.resting.method).toBe('mifflin')
    const long = estimateWorkoutEnergy({
      workout: { startedAt: local(2026, 3, 2, 8), finishedAt: local(2026, 3, 2, 13) },
      profile: { heightCm: 180, birthYear: 1996, sex: 'male', workoutEffort: 'vigorous' },
      weights: [w('2026-03-01', 80)],
    })
    expect(long).toMatchObject({ minutes: 180, capped: true, met: 6 })
    expect(
      estimateWorkoutEnergy({
        workout: { startedAt: local(2026, 3, 2, 18), finishedAt: local(2026, 3, 2, 19) },
        profile: { heightCm: null, birthYear: 1996, sex: 'male', workoutEffort: 'moderate' },
        weights: [w('2026-03-01', 80)],
      }),
    ).toBeNull()
  })
})

describe('estimateDayEnergy', () => {
  const profile = { heightCm: 180, birthYear: 1996, sex: 'male' as const, dailyActivity: 'mixed' as const, workoutEffort: 'moderate' as const }

  it('adds resting, everyday activity (PAL) and only that day’s workouts', () => {
    const r = estimateDayEnergy({
      day: '2026-03-02',
      profile,
      weights: [w('2026-03-01', 80)],
      workouts: [
        { startedAt: local(2026, 3, 2, 18), finishedAt: local(2026, 3, 2, 19) },
        { startedAt: local(2026, 3, 3, 18), finishedAt: local(2026, 3, 3, 19) }, // next day: ignored
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const e = r.estimate
    expect(e.restingKcal).toBe(1780)
    expect(e.everydayKcal).toBeCloseTo(1780 * 0.55)
    expect(e.workoutKcal).toBeCloseTo((4.9 - 1780 / 1440) * 60)
    expect(e.totalKcal).toBeCloseTo(1780 * 1.55 + e.workoutKcal)
    expect(e.activityAssumed).toBe(false)
  })

  it('assumes the lowest activity level until one is chosen', () => {
    const r = estimateDayEnergy({ day: '2026-03-02', profile: { ...profile, dailyActivity: null }, weights: [w('2026-03-01', 80)], workouts: [] })
    expect(r.ok && r.estimate.pal).toBe(1.4)
    expect(r.ok && r.estimate.activityAssumed).toBe(true)
  })

  it('reports what is missing', () => {
    const r = estimateDayEnergy({ day: '2026-03-02', profile: { ...profile, heightCm: null }, weights: [], workouts: [] })
    expect(r).toEqual({ ok: false, missing: ['weight', 'height'] })
  })
})

describe('roundEstimate', () => {
  it('rounds to 10 kcal or 50 kJ', () => {
    expect(roundEstimate(1783, 'kcal')).toBe(1780)
    expect(roundEstimate(1783, 'kj')).toBe(7450) // 7460.07 -> 7450
  })
})
