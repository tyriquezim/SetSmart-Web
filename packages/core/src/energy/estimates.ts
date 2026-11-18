// Estimated energy expenditure from published equations.
//
// Everything here is an ESTIMATE from population equations, not a measurement.
// The equations and their sources are listed in ENERGY_METHODS so the app can
// show users exactly how each number was worked out.
//
// Units: kcal internally (every source equation is published in kcal); convert
// to kJ for display with KJ_PER_KCAL.

import { KJ_PER_KCAL } from '../units'
import { todayIsoDate } from '../progress/stats'
import type { BodyWeightEntry, CardioSession, DailyActivity, Profile, Sex, WorkoutEffort } from '../types'
import { cardioMet, type CardioMet } from './cardio'

// ---- Constants from the literature -------------------------------------------

/**
 * Physical activity level (PAL = total daily energy / BMR) for everyday life
 * outside logged workouts. Points chosen within the FAO/WHO/UNU (2004) ranges:
 * "sedentary or light activity" 1.40-1.69 and "active or moderately active"
 * 1.70-1.99. The PAL also covers digesting food (thermic effect of food).
 */
export const DAILY_ACTIVITY_PAL: Record<DailyActivity, number> = {
  sitting: 1.4,
  mixed: 1.55,
  active: 1.75,
}

/**
 * MET values for weight training, 2024 Adult Compendium of Physical Activities
 * (Herrmann et al., 2024): code 02054 "Resistance (weight) training, multiple
 * exercises, 8-15 reps at varied resistance" = 3.5; code 02050 "Resistance (weight
 * lifting - free weight, nautilus or universal-type), power lifting or body
 * building, vigorous effort" = 6.0.
 */
export const WORKOUT_MET: Record<WorkoutEffort, number> = {
  moderate: 3.5,
  vigorous: 6.0,
}

/** Sessions longer than this are counted as this long (forgotten timers would otherwise inflate the estimate). */
export const MAX_WORKOUT_MINUTES = 180

/** A body fat reading is used only if it was taken within this many days of the day being estimated. */
export const BODY_FAT_MAX_AGE_DAYS = 90

/** kcal per minute = MET x 3.5 mL O2/kg/min x body mass / 200 (standard ACSM conversion). */
const KCAL_PER_MET_KG_MIN = 3.5 / 200

// ---- Resting energy ------------------------------------------------------------

export interface BodyStats {
  weightKg: number
  heightCm: number | null
  /** Whole years */
  age: number | null
  sex: Sex | null
  bodyFatPct: number | null
}

/**
 * - cunningham: 500 + 22 x fat-free mass (needs a body fat reading)
 * - mifflin: Mifflin-St Jeor with the sex-specific constant
 * - mifflin-average: Mifflin-St Jeor with the average of the two constants, used when sex isn't set
 */
export type RestingMethod = 'cunningham' | 'mifflin' | 'mifflin-average'

export interface RestingEstimate {
  kcalPerDay: number
  method: RestingMethod
  /** Fat-free mass used, when the method needs it */
  fatFreeMassKg: number | null
}

/** Mifflin-St Jeor constants: +5 for men, -161 for women. */
const MIFFLIN_SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161 }
const MIFFLIN_AVERAGE_CONSTANT = (5 + -161) / 2

/**
 * Resting energy expenditure per day.
 *
 * With a body fat reading we use Cunningham (1980), which works from fat-free
 * mass and so reflects muscle; it performed best in recreational athletes
 * (ten Haaf & Weijs, 2014). Otherwise Mifflin-St Jeor (1990), the equation most
 * often within 10% of measured values in healthy adults (Frankenfield et al., 2005).
 * Returns null if there isn't enough information for either.
 */
export function restingEnergy(s: BodyStats): RestingEstimate | null {
  if (!(s.weightKg > 0)) return null
  if (s.bodyFatPct != null && s.bodyFatPct > 0 && s.bodyFatPct < 100) {
    const ffm = s.weightKg * (1 - s.bodyFatPct / 100)
    return { kcalPerDay: 500 + 22 * ffm, method: 'cunningham', fatFreeMassKg: ffm }
  }
  if (s.heightCm == null || s.age == null) return null
  const base = 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age
  const kcalPerDay = base + (s.sex ? MIFFLIN_SEX_CONSTANT[s.sex] : MIFFLIN_AVERAGE_CONSTANT)
  return { kcalPerDay: Math.max(0, kcalPerDay), method: s.sex ? 'mifflin' : 'mifflin-average', fatFreeMassKg: null }
}

export type MissingDetail = 'weight' | 'height' | 'birthYear'

/** What the user still needs to enter before a resting estimate is possible. */
export function missingDetails(
  profile: Pick<Profile, 'heightCm' | 'birthYear'>,
  stats: Pick<BodyStats, 'bodyFatPct'> | null,
): MissingDetail[] {
  if (!stats) return ['weight', ...(profile.heightCm == null ? (['height'] as const) : []), ...(profile.birthYear == null ? (['birthYear'] as const) : [])]
  if (stats.bodyFatPct != null) return []
  const missing: MissingDetail[] = []
  if (profile.heightCm == null) missing.push('height')
  if (profile.birthYear == null) missing.push('birthYear')
  return missing
}

// ---- Body stats on a given day -------------------------------------------------

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000
}

/** The entry nearest in time to `day`, preferring the latest one on or before it. */
function nearest<T extends { measuredOn: string }>(entries: T[], day: string): T | null {
  let before: T | null = null
  let after: T | null = null
  for (const e of entries) {
    if (e.measuredOn <= day) {
      if (!before || e.measuredOn > before.measuredOn) before = e
    } else if (!after || e.measuredOn < after.measuredOn) after = e
  }
  return before ?? after
}

/**
 * The body measurements that apply on a day (YYYY-MM-DD): the latest weigh-in on
 * or before it (or the first one after, if there's nothing earlier), and a body fat
 * reading only if one was taken within BODY_FAT_MAX_AGE_DAYS. Null without any weigh-in.
 */
export function bodyStatsOn(
  day: string,
  weights: BodyWeightEntry[],
  profile: Pick<Profile, 'heightCm' | 'birthYear' | 'sex'>,
): BodyStats | null {
  const w = nearest(weights, day)
  if (!w) return null
  const fat = nearest(
    weights.filter((e) => e.bodyFatPct != null),
    day,
  )
  return {
    weightKg: w.weightKg,
    heightCm: profile.heightCm,
    age: profile.birthYear != null ? Number(day.slice(0, 4)) - profile.birthYear : null,
    sex: profile.sex,
    bodyFatPct: fat && daysBetween(fat.measuredOn, day) <= BODY_FAT_MAX_AGE_DAYS ? fat.bodyFatPct : null,
  }
}

// ---- Workouts ------------------------------------------------------------------

export interface WorkoutTimes {
  startedAt: string
  finishedAt: string
}

/** Minutes counted for a workout: its logged length, capped at MAX_WORKOUT_MINUTES. */
export function countedWorkoutMinutes(w: WorkoutTimes): number {
  const minutes = (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60_000
  return Math.min(MAX_WORKOUT_MINUTES, Math.max(0, minutes))
}

/**
 * Extra energy burned by a workout ABOVE resting, in kcal, so it can be added to
 * the daily resting figure without counting rest twice:
 *   (MET x 3.5 x kg / 200 - resting kcal per minute) x minutes.
 * MET values for a whole weights session already allow for rest between sets.
 */
export function workoutEnergy({
  minutes,
  effort,
  weightKg,
  restingKcalPerDay,
}: {
  minutes: number
  effort: WorkoutEffort
  weightKg: number
  restingKcalPerDay: number
}): number {
  return netActivityKcal({ met: WORKOUT_MET[effort], minutes: Math.min(MAX_WORKOUT_MINUTES, minutes), weightKg, restingKcalPerDay })
}

/**
 * Energy above resting for any activity with a MET value:
 *   max(0, MET x 3.5 x kg / 200 - resting kcal per minute) x minutes.
 */
export function netActivityKcal({
  met,
  minutes,
  weightKg,
  restingKcalPerDay,
}: {
  met: number
  minutes: number
  weightKg: number
  restingKcalPerDay: number
}): number {
  const gross = met * KCAL_PER_MET_KG_MIN * weightKg
  const resting = restingKcalPerDay / 1440
  return Math.max(0, gross - resting) * Math.max(0, minutes)
}

/** The local day (YYYY-MM-DD) a session started on. */
const startDay = (startedAt: string) => todayIsoDate(new Date(startedAt))

// ---- Whole day ---------------------------------------------------------------

export interface DayEnergyEstimate {
  resting: RestingEstimate
  /** Resting energy for the whole day */
  restingKcal: number
  /** Everyday movement and digesting food: resting x (PAL - 1) */
  everydayKcal: number
  /** Logged weights workouts, above resting */
  workoutKcal: number
  /** Logged cardio, above resting */
  cardioKcal: number
  totalKcal: number
  pal: number
  /** True when the user hasn't chosen an everyday activity level, so the lowest one is assumed */
  activityAssumed: boolean
  stats: BodyStats
}

export type DayEnergyResult = { ok: true; estimate: DayEnergyEstimate } | { ok: false; missing: MissingDetail[] }

/** Estimated total energy burned on a day, split into resting, everyday activity and workouts. */
export function estimateDayEnergy({
  day,
  profile,
  weights,
  workouts,
  cardio = [],
}: {
  day: string
  profile: Pick<Profile, 'heightCm' | 'birthYear' | 'sex' | 'dailyActivity' | 'workoutEffort'>
  weights: BodyWeightEntry[]
  /** Workouts and cardio are counted on the local day they started */
  workouts: WorkoutTimes[]
  cardio?: CardioSession[]
}): DayEnergyResult {
  const stats = bodyStatsOn(day, weights, profile)
  const resting = stats && restingEnergy(stats)
  if (!stats || !resting) return { ok: false, missing: missingDetails(profile, stats) }

  const pal = DAILY_ACTIVITY_PAL[profile.dailyActivity ?? 'sitting']
  const workoutKcal = workouts
    .filter((w) => startDay(w.startedAt) === day)
    .reduce(
      (sum, w) =>
        sum +
        workoutEnergy({
          minutes: countedWorkoutMinutes(w),
          effort: profile.workoutEffort,
          weightKg: stats.weightKg,
          restingKcalPerDay: resting.kcalPerDay,
        }),
      0,
    )
  const cardioKcal = cardio
    .filter((c) => startDay(c.startedAt) === day)
    .reduce((sum, c) => {
      const m = cardioMet(c)
      return m ? sum + netActivityKcal({ met: m.met, minutes: c.durationS / 60, weightKg: stats.weightKg, restingKcalPerDay: resting.kcalPerDay }) : sum
    }, 0)
  const restingKcal = resting.kcalPerDay
  const everydayKcal = restingKcal * (pal - 1)
  return {
    ok: true,
    estimate: {
      resting,
      restingKcal,
      everydayKcal,
      workoutKcal,
      cardioKcal,
      totalKcal: restingKcal + everydayKcal + workoutKcal + cardioKcal,
      pal,
      activityAssumed: profile.dailyActivity == null,
      stats,
    },
  }
}

export interface WorkoutEnergyEstimate {
  kcal: number
  /** Minutes counted (capped at MAX_WORKOUT_MINUTES) */
  minutes: number
  /** True when the logged length was longer than the cap */
  capped: boolean
  effort: WorkoutEffort
  met: number
  weightKg: number
  resting: RestingEstimate
}

/** Estimated energy for a single workout (above resting), or null without enough body details. */
export function estimateWorkoutEnergy({
  workout,
  profile,
  weights,
}: {
  workout: WorkoutTimes
  profile: Pick<Profile, 'heightCm' | 'birthYear' | 'sex' | 'workoutEffort'>
  weights: BodyWeightEntry[]
}): WorkoutEnergyEstimate | null {
  const stats = bodyStatsOn(startDay(workout.startedAt), weights, profile)
  const resting = stats && restingEnergy(stats)
  if (!stats || !resting) return null
  const minutes = countedWorkoutMinutes(workout)
  const kcal = workoutEnergy({
    minutes,
    effort: profile.workoutEffort,
    weightKg: stats.weightKg,
    restingKcalPerDay: resting.kcalPerDay,
  })
  const logged = (Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 60_000
  return {
    kcal,
    minutes,
    capped: logged > MAX_WORKOUT_MINUTES,
    effort: profile.workoutEffort,
    met: WORKOUT_MET[profile.workoutEffort],
    weightKg: stats.weightKg,
    resting,
  }
}

export interface CardioEnergyEstimate extends CardioMet {
  kcal: number
  minutes: number
  weightKg: number
  resting: RestingEstimate
}

export type CardioEnergyResult =
  | { ok: true; estimate: CardioEnergyEstimate }
  /** 'met' means an 'other' session without a MET value */
  | { ok: false; missing: Array<MissingDetail | 'met'> }

/** Estimated energy for one cardio session, above resting. */
export function estimateCardioEnergy({
  session,
  profile,
  weights,
}: {
  session: Pick<CardioSession, 'activity' | 'startedAt' | 'durationS' | 'distanceM' | 'effort' | 'met'>
  profile: Pick<Profile, 'heightCm' | 'birthYear' | 'sex'>
  weights: BodyWeightEntry[]
}): CardioEnergyResult {
  const stats = bodyStatsOn(startDay(session.startedAt), weights, profile)
  const resting = stats && restingEnergy(stats)
  const m = cardioMet(session)
  if (!stats || !resting || !m) {
    const missing: Array<MissingDetail | 'met'> = !stats || !resting ? missingDetails(profile, stats) : []
    if (!m) missing.push('met')
    return { ok: false, missing }
  }
  const minutes = session.durationS / 60
  return {
    ok: true,
    estimate: {
      ...m,
      kcal: netActivityKcal({ met: m.met, minutes, weightKg: stats.weightKg, restingKcalPerDay: resting.kcalPerDay }),
      minutes,
      weightKg: stats.weightKg,
      resting,
    },
  }
}

/** Round an estimate so it doesn't look more precise than it is: 10 kcal or 50 kJ steps. */
export function roundEstimate(kcal: number, unit: 'kj' | 'kcal'): number {
  return unit === 'kcal' ? Math.round(kcal / 10) * 10 : Math.round((kcal * KJ_PER_KCAL) / 50) * 50
}

// ---- Sources -----------------------------------------------------------------

export interface EnergySource {
  id: string
  citation: string
  url: string
}

export const ENERGY_SOURCES: EnergySource[] = [
  {
    id: 'mifflin',
    citation:
      'Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
    url: 'https://doi.org/10.1093/ajcn/51.2.241',
  },
  {
    id: 'frankenfield',
    citation:
      'Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc. 2005;105(5):775-789.',
    url: 'https://doi.org/10.1016/j.jada.2005.02.005',
  },
  {
    id: 'cunningham',
    citation:
      'Cunningham JJ. A reanalysis of the factors influencing basal metabolic rate in normal adults. Am J Clin Nutr. 1980;33(11):2372-2374.',
    url: 'https://doi.org/10.1093/ajcn/33.11.2372',
  },
  {
    id: 'tenhaaf',
    citation:
      'ten Haaf T, Weijs PJM. Resting energy expenditure prediction in recreational athletes of 18-35 years: confirmation of Cunningham equation and an improved weight-based alternative. PLoS One. 2014;9(10):e108460.',
    url: 'https://doi.org/10.1371/journal.pone.0108460',
  },
  {
    id: 'compendium',
    citation:
      'Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. J Sport Health Sci. 2024;13(1):6-12.',
    url: 'https://doi.org/10.1016/j.jshs.2023.10.010',
  },
  {
    id: 'fao',
    citation:
      'FAO/WHO/UNU. Human energy requirements: report of a joint FAO/WHO/UNU expert consultation. FAO Food and Nutrition Technical Report Series 1. Rome; 2004.',
    url: 'https://www.fao.org/4/y5686e/y5686e00.htm',
  },
]
