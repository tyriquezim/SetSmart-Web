import { kgTo, type WeightUnit } from '@setsmart/core'

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'All'

export const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
]

const RANGE_DAYS: Record<RangeKey, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, All: Infinity }

/** Earliest timestamp included in a range (relative to now). */
export function rangeStart(range: RangeKey, now: number): number {
  const days = RANGE_DAYS[range]
  return Number.isFinite(days) ? now - days * 86_400_000 : -Infinity
}

/** Body weight shown to 0.1 precision in the user's unit (finer than plate rounding). */
export function formatBodyWeight(unit: WeightUnit, kg: number): string {
  return `${kgTo(unit, kg).toFixed(1)} ${unit}`
}

export function formatSignedWeight(unit: WeightUnit, kgDelta: number): string {
  const v = kgTo(unit, kgDelta)
  const sign = v > 0.05 ? '+' : v < -0.05 ? '−' : '±'
  return `${sign}${Math.abs(v).toFixed(1)} ${unit}`
}
