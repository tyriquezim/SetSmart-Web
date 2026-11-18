import { averageSpeedKmh, type CardioActivity, type CardioSession, type WeightUnit } from '@setsmart/core'

/** Distances follow the weight unit: km for kg users, miles for lb users. */
export type DistanceUnit = 'km' | 'mi'
export const M_PER_MI = 1609.344

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

/** "1:05:30" or "45 min" style durations for lists. */
export function formatCardioDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h} h ${m} min`
  return s ? `${m} min ${s} s` : `${m} min`
}

/** The usual way each sport shows speed: pace for running/walking, km/h for cycling, per 100 m / 500 m for swim/row. */
export function formatPace(s: Pick<CardioSession, 'activity' | 'durationS' | 'distanceM'>, unit: DistanceUnit): string | null {
  if (s.distanceM == null || s.distanceM <= 0) return null
  if (s.activity === 'swim') return `${mmss((s.durationS / s.distanceM) * 100)} /100 m`
  if (s.activity === 'row') return `${mmss((s.durationS / s.distanceM) * 500)} /500 m`
  if (s.activity === 'cycle' || s.activity === 'indoor_cycle') {
    return formatSpeed(averageSpeedKmh(s)!, unit)
  }
  return `${mmss(s.durationS / distanceIn(unit, s.distanceM))} /${unit}`
}

/** Speed in the user's unit, e.g. "12.0 km/h" or "7.5 mph". */
export function formatSpeed(kmh: number, unit: DistanceUnit): string {
  return unit === 'mi' ? `${(kmh / 1.609344).toFixed(1)} mph` : `${kmh.toFixed(1)} km/h`
}
