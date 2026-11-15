import type { EnergyUnit, WeightUnit } from './types'

export const LB_PER_KG = 2.2046226218
export const KJ_PER_KCAL = 4.184

/** Convert a stored kilogram value to the user's display unit. */
export function kgTo(unit: WeightUnit, kg: number): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG
}

/** Convert a value entered in the user's unit back to kilograms for storage. */
export function toKg(unit: WeightUnit, value: number): number {
  return unit === 'kg' ? value : value / LB_PER_KG
}

/** Round to a sensible precision for display (0.25 kg / 0.5 lb steps keep plates readable). */
export function roundWeight(unit: WeightUnit, value: number): number {
  const step = unit === 'kg' ? 0.25 : 0.5
  return Math.round(value / step) * step
}

export function displayWeight(unit: WeightUnit, kg: number | null): number | null {
  return kg == null ? null : roundWeight(unit, kgTo(unit, kg))
}

export function formatWeight(unit: WeightUnit, kg: number | null): string {
  const v = displayWeight(unit, kg)
  if (v == null) return '—'
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, '')} ${unit}`
}

/** Default +/- step for weight steppers in the given unit. */
export function weightStep(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 5
}

export function kjTo(unit: EnergyUnit, kj: number): number {
  return unit === 'kj' ? kj : kj / KJ_PER_KCAL
}

export function toKj(unit: EnergyUnit, value: number): number {
  return unit === 'kj' ? value : value * KJ_PER_KCAL
}

export function formatEnergy(unit: EnergyUnit, kj: number): string {
  return `${Math.round(kjTo(unit, kj)).toLocaleString()} ${unit === 'kj' ? 'kJ' : 'kcal'}`
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/**
 * Value to show in an editable weight input: converted to the user's unit and
 * rounded to 2 decimals (not to plate steps, so typed values round-trip exactly).
 */
export function weightInputValue(unit: WeightUnit, kg: number | null): number | null {
  return kg == null ? null : Math.round(kgTo(unit, kg) * 100) / 100
}
