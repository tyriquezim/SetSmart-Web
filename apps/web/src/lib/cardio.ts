import { averageSpeedKmh, type CardioActivity, type CardioMetInput, type WeightUnit } from '@setsmart/core'

/** Distances follow the weight unit: km for kg users, miles for lb users. */
export type DistanceUnit = 'km' | 'mi'
export const M_PER_MI = 1609.344
const KM_PER_MI = 1.609344

export const distanceUnitFor = (weightUnit: WeightUnit): DistanceUnit => (weightUnit === 'lb' ? 'mi' : 'km')

/** Metres to the user's unit. */
export const distanceIn = (unit: DistanceUnit, m: number) => (unit === 'mi' ? m / M_PER_MI : m / 1000)
export const distanceToM = (unit: DistanceUnit, value: number) => (unit === 'mi' ? value * M_PER_MI : value * 1000)

/** Swims and rows are usually counted in metres; everything else in km or miles. */
export const usesMetres = (a: CardioActivity) => a === 'swim' || a === 'row'

export function formatDistance(activity: CardioActivity, unit: DistanceUnit, m: number): string {
  if (usesMetres(activity)) return `${Math.round(m).toLocaleString()} m`
  return `${distanceIn(unit, m).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
}

const mmss = (totalSeconds: number) => {
  const s = Math.round(totalSeconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1 h 5 min" or "45 min 30 s" style durations for lists. */
export function formatCardioDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h} h ${m} min`
  if (m === 0) return `${s} s`
  return s ? `${m} min ${s} s` : `${m} min`
}

/** A goal duration, e.g. "20 min" or "1 h 30 min". */
export function formatGoal(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * How each sport usually describes speed: a pace (time per km, mile, 100 m or 500 m)
 * for running, walking, swimming and rowing, or a speed (km/h or mph) for cycling.
 */
export type PaceSpec = { kind: 'pace'; perM: number; label: string } | { kind: 'speed'; label: string }

export function paceSpec(activity: CardioActivity, unit: DistanceUnit): PaceSpec {
  if (activity === 'swim') return { kind: 'pace', perM: 100, label: '/100 m' }
  if (activity === 'row') return { kind: 'pace', perM: 500, label: '/500 m' }
  if (activity === 'cycle' || activity === 'indoor_cycle') return { kind: 'speed', label: unit === 'mi' ? 'mph' : 'km/h' }
  return { kind: 'pace', perM: unit === 'mi' ? M_PER_MI : 1000, label: `/${unit}` }
}

/** The distance covered in `durationS` at a pace (seconds per spec.perM metres) or a speed (km/h or mph). */
export function distanceFromPace(spec: PaceSpec, durationS: number, value: number): number | null {
  if (!(value > 0) || !(durationS > 0)) return null
  if (spec.kind === 'pace') return (durationS / value) * spec.perM
  const kmh = spec.label === 'mph' ? value * KM_PER_MI : value
  return (kmh * durationS) / 3.6
}

/** The usual way each sport shows speed: pace for running/walking, km/h for cycling, per 100 m / 500 m for swim/row. */
export function formatPace(s: Pick<CardioMetInput, 'activity' | 'durationS' | 'distanceM'>, unit: DistanceUnit): string | null {
  if (s.distanceM == null || s.distanceM <= 0 || !(s.durationS > 0)) return null
  const spec = paceSpec(s.activity, unit)
  if (spec.kind === 'speed') return formatSpeed(averageSpeedKmh(s)!, unit)
  return `${mmss((s.durationS / s.distanceM) * spec.perM)} ${spec.label}`
}

/** Speed in the user's unit, e.g. "12.0 km/h" or "7.5 mph". */
export function formatSpeed(kmh: number, unit: DistanceUnit): string {
  return unit === 'mi' ? `${(kmh / KM_PER_MI).toFixed(1)} mph` : `${kmh.toFixed(1)} km/h`
}

/** "32 min · 5.2 km · 6:09 /km" for a piece of logged cardio. */
export function cardioSummary(c: Pick<CardioMetInput, 'activity' | 'durationS' | 'distanceM'>, unit: DistanceUnit): string {
  return [
    formatCardioDuration(c.durationS),
    c.distanceM != null && formatDistance(c.activity, unit, c.distanceM),
    formatPace(c, unit),
  ]
    .filter(Boolean)
    .join(' · ')
}
