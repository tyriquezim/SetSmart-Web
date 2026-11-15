import type { AmountUnit, FoodData, FoodLogEntry, Meal, Nutrients } from '../types'

export const ZERO_NUTRIENTS: Nutrients = { energyKj: 0, proteinG: 0, carbsG: 0, fatG: 0 }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Round for storage: energy and macros to 0.1. */
export function roundNutrients(n: Nutrients): Nutrients {
  return { energyKj: round1(n.energyKj), proteinG: round1(n.proteinG), carbsG: round1(n.carbsG), fatG: round1(n.fatG) }
}

/**
 * Grams (or ml) for an amount the user typed. Returns null when the amount
 * can't be converted (e.g. servings for a food with no serving size).
 */
export function gramsFor(food: Pick<FoodData, 'servingSize'>, amount: number, unit: AmountUnit): number | null {
  if (!(amount > 0)) return null
  if (unit === 'serving') return food.servingSize ? amount * food.servingSize : null
  return amount
}

/** Nutrients in `grams` of a food. Unknown macros count as 0. */
export function nutrientsFor(food: Pick<FoodData, 'per100'>, grams: number): Nutrients {
  const f = grams / 100
  const p = food.per100
  return roundNutrients({
    energyKj: p.energyKj * f,
    proteinG: (p.proteinG ?? 0) * f,
    carbsG: (p.carbsG ?? 0) * f,
    fatG: (p.fatG ?? 0) * f,
  })
}

export function sumNutrients(items: ReadonlyArray<Nutrients>): Nutrients {
  const total = items.reduce(
    (acc, n) => ({
      energyKj: acc.energyKj + n.energyKj,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
    }),
    ZERO_NUTRIENTS,
  )
  return roundNutrients(total)
}

/**
 * Change the amount of a logged entry, scaling its snapshot nutrients in
 * proportion. Works without the original food (which may have been edited
 * or deleted since). Returns null for quick adds, which have no amount.
 */
export function rescaleEntry(
  entry: Pick<FoodLogEntry, 'amount' | 'amountUnit' | 'grams' | keyof Nutrients>,
  newAmount: number,
): Pick<FoodLogEntry, 'amount' | 'grams' | keyof Nutrients> | null {
  if (entry.amount == null || entry.grams == null || !(newAmount > 0)) return null
  const ratio = newAmount / entry.amount
  return {
    amount: newAmount,
    grams: round1(entry.grams * ratio),
    ...roundNutrients({
      energyKj: entry.energyKj * ratio,
      proteinG: entry.proteinG * ratio,
      carbsG: entry.carbsG * ratio,
      fatG: entry.fatG * ratio,
    }),
  }
}

export function groupByMeal<T extends { meal: Meal }>(entries: ReadonlyArray<T>): Record<Meal, T[]> {
  const out: Record<Meal, T[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
  for (const e of entries) out[e.meal].push(e)
  return out
}

/** Total nutrients per day, keyed by YYYY-MM-DD. */
export function dailyTotals(entries: ReadonlyArray<Pick<FoodLogEntry, 'eatenOn' | keyof Nutrients>>): Map<string, Nutrients> {
  const byDay = new Map<string, Nutrients[]>()
  for (const e of entries) {
    const list = byDay.get(e.eatenOn)
    if (list) list.push(e)
    else byDay.set(e.eatenOn, [e])
  }
  return new Map([...byDay].map(([day, list]) => [day, sumNutrients(list)]))
}

/** A sensible default meal for the time of day, for new log entries. */
export function mealForHour(hour: number): Meal {
  if (hour < 10) return 'breakfast'
  if (hour < 14) return 'lunch'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'snack'
}

/** Shift a YYYY-MM-DD date by whole days (calendar arithmetic, DST-safe). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** "1 serving (33 g)", "150 g", "1.5 servings (2 biscuits)" … */
export function describeAmount(
  e: Pick<FoodLogEntry, 'amount' | 'amountUnit' | 'grams'>,
  baseUnit: 'g' | 'ml' = 'g',
): string | null {
  if (e.amount == null || e.amountUnit == null) return null
  const n = Number.isInteger(e.amount) ? String(e.amount) : String(Math.round(e.amount * 100) / 100)
  if (e.amountUnit !== 'serving') return `${n} ${e.amountUnit}`
  const servings = `${n} ${e.amount === 1 ? 'serving' : 'servings'}`
  return e.grams != null ? `${servings} (${Math.round(e.grams)} ${baseUnit})` : servings
}
