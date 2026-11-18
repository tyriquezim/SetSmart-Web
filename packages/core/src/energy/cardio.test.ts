import { describe, expect, it } from 'vitest'
import type { BodyWeightEntry, CardioSession } from '../types'
import { averageSpeedKmh, cardioMet, cardioName, CARDIO_ACTIVITIES, CARDIO_ACTIVITY_ORDER } from './cardio'
import { estimateCardioEnergy, estimateDayEnergy, netActivityKcal } from './estimates'

const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString()

const session = (over: Partial<CardioSession>): CardioSession => ({
  id: 'c1',
  activity: 'run',
  customName: null,
  startedAt: local(2026, 11, 18, 7),
  durationS: 50 * 60,
  distanceM: null,
  effort: null,
  met: null,
  notes: null,
  ...over,
})

const weights: BodyWeightEntry[] = [{ id: 'w', measuredOn: '2026-11-01', weightKg: 80, bodyFatPct: null, note: null }]
// Mifflin, male, 80 kg, 180 cm, 30 years in 2026 -> 1780 kcal/day
const profile = { heightCm: 180, birthYear: 1996, sex: 'male' as const, dailyActivity: 'sitting' as const, workoutEffort: 'moderate' as const }

describe('cardioMet', () => {
  it('picks the running row nearest the average speed', () => {
    // 10 km in 50 min = 12 km/h = 7.46 mph -> "Running, 7.5 mph" (12080), 11.8 METs
    const m = cardioMet(session({ distanceM: 10_000 }))
    expect(m?.met).toBe(11.8)
    expect(m?.source.kind === 'speed' && m.source.row.code).toBe('12080')
    expect(m?.source.kind === 'speed' && m.source.speedKmh).toBeCloseTo(12)
  })

  it('clamps speeds outside the table to the nearest end', () => {
    // 4 km in 50 min = 4.8 km/h, slower than the slowest running row
    expect(cardioMet(session({ distanceM: 4_000 }))?.met).toBe(6.5)
    // 30 km/h = 18.6 mph is inside "16-19 mph" (01050); 36 km/h = 22.4 mph -> ">20 mph" (01060)
    expect(cardioMet(session({ activity: 'cycle', distanceM: 30_000, durationS: 3600 }))?.met).toBe(12)
    expect(cardioMet(session({ activity: 'cycle', distanceM: 36_000, durationS: 3600 }))?.met).toBe(16.8)
  })

  it('uses speed rows for walks and rides', () => {
    // 5 km in 60 min = 3.1 mph -> 17190, 3.8 METs
    expect(cardioMet(session({ activity: 'walk', distanceM: 5_000, durationS: 3600 }))?.met).toBe(3.8)
    // 25 km/h = 15.5 mph -> nearest 14-15.9 mph (01040), 10 METs
    expect(cardioMet(session({ activity: 'cycle', distanceM: 25_000, durationS: 3600 }))?.met).toBe(10)
  })

  it('uses the chosen effort without a distance, or the moderate row if none was chosen', () => {
    expect(cardioMet(session({ effort: 'light' }))).toMatchObject({ met: 7.5, source: { kind: 'effort', defaulted: false } })
    expect(cardioMet(session({ activity: 'walk' }))).toMatchObject({ met: 4.8, source: { kind: 'effort', defaulted: true } })
    // Rowing has no light row, so a stray 'light' falls back to moderate
    expect(cardioMet(session({ activity: 'row', effort: 'light' }))?.met).toBe(5)
    expect(cardioMet(session({ activity: 'stairs' }))?.met).toBe(9.3)
  })

  it('ignores distance for activities without speed rows', () => {
    expect(cardioMet(session({ activity: 'swim', distanceM: 1500, effort: 'vigorous' }))?.met).toBe(9.8)
  })

  it("uses the user's MET for 'other', or nothing without one", () => {
    expect(cardioMet(session({ activity: 'other', met: 5.5 }))).toEqual({ met: 5.5, source: { kind: 'custom' } })
    expect(cardioMet(session({ activity: 'other' }))).toBeNull()
  })
})

describe('cardio helpers', () => {
  it('works out average speed', () => {
    expect(averageSpeedKmh({ durationS: 1800, distanceM: 5000 })).toBe(10)
    expect(averageSpeedKmh({ durationS: 1800, distanceM: null })).toBeNull()
  })

  it('names sessions', () => {
    expect(cardioName({ activity: 'indoor_cycle', customName: null })).toBe('Exercise bike')
    expect(cardioName({ activity: 'other', customName: ' Kayaking ' })).toBe('Kayaking')
    expect(cardioName({ activity: 'other', customName: '' })).toBe('Other')
  })

  it('lists every activity once, each with at least one way to get a MET', () => {
    expect(new Set(CARDIO_ACTIVITY_ORDER).size).toBe(Object.keys(CARDIO_ACTIVITIES).length)
    for (const a of CARDIO_ACTIVITY_ORDER.filter((a) => a !== 'other')) expect(CARDIO_ACTIVITIES[a].efforts.length).toBeGreaterThan(0)
  })
})

describe('estimateCardioEnergy', () => {
  it('counts only energy above resting', () => {
    // (11.8 x 3.5 x 80 / 200 - 1780 / 1440) x 50 = (16.52 - 1.2361) x 50 = 764.19
    const r = estimateCardioEnergy({ session: session({ distanceM: 10_000 }), profile, weights })
    expect(r.ok && r.estimate.kcal).toBeCloseTo(764.19, 1)
    expect(r.ok && r.estimate.minutes).toBe(50)
  })

  it('reports what is missing', () => {
    expect(estimateCardioEnergy({ session: session({}), profile, weights: [] })).toEqual({
      ok: false,
      missing: ['weight'],
    })
    expect(estimateCardioEnergy({ session: session({ activity: 'other' }), profile, weights })).toEqual({
      ok: false,
      missing: ['met'],
    })
  })

  it('never goes below zero', () => {
    expect(netActivityKcal({ met: 1, minutes: 30, weightKg: 60, restingKcalPerDay: 2000 })).toBe(0)
  })
})

describe('estimateDayEnergy with cardio', () => {
  it('adds cardio on that local day only', () => {
    const today = session({ distanceM: 10_000 })
    const yesterday = session({ id: 'c2', startedAt: local(2026, 11, 17, 7), distanceM: 10_000 })
    const r = estimateDayEnergy({ day: '2026-11-18', profile, weights, workouts: [], cardio: [today, yesterday] })
    expect(r.ok && r.estimate.cardioKcal).toBeCloseTo(764.19, 1)
    // 1780 resting + 712 everyday (1.4) + 764.19 cardio
    expect(r.ok && r.estimate.totalKcal).toBeCloseTo(1780 + 712 + 764.19, 1)
  })

  it('treats cardio as optional', () => {
    const r = estimateDayEnergy({ day: '2026-11-18', profile, weights, workouts: [] })
    expect(r.ok && r.estimate.cardioKcal).toBe(0)
  })
})
