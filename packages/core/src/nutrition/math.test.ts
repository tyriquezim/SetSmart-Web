import { describe, expect, it } from 'vitest'
import {
  addDays,
  dailyTotals,
  describeAmount,
  gramsFor,
  groupByMeal,
  mealForHour,
  nutrientsFor,
  rescaleEntry,
  sumNutrients,
} from './math'

const weetbix = {
  servingSize: 33,
  per100: { energyKj: 1480, proteinG: 12.4, carbsG: 65.9, fatG: 1.3 },
}

describe('gramsFor', () => {
  it('passes grams through and multiplies servings', () => {
    expect(gramsFor(weetbix, 50, 'g')).toBe(50)
    expect(gramsFor(weetbix, 1.5, 'serving')).toBe(49.5)
  })
  it('returns null for servings without a serving size, or non-positive amounts', () => {
    expect(gramsFor({ servingSize: null }, 1, 'serving')).toBeNull()
    expect(gramsFor(weetbix, 0, 'g')).toBeNull()
    expect(gramsFor(weetbix, -2, 'g')).toBeNull()
  })
})

describe('nutrientsFor', () => {
  it('scales per-100 values and rounds to 0.1', () => {
    expect(nutrientsFor(weetbix, 33)).toEqual({ energyKj: 488.4, proteinG: 4.1, carbsG: 21.7, fatG: 0.4 })
  })
  it('treats unknown macros as zero', () => {
    const food = { per100: { energyKj: 200, proteinG: null, carbsG: null, fatG: 5 } }
    expect(nutrientsFor(food, 50)).toEqual({ energyKj: 100, proteinG: 0, carbsG: 0, fatG: 2.5 })
  })
})

describe('sumNutrients / dailyTotals', () => {
  const a = { eatenOn: '2026-11-15', energyKj: 100.15, proteinG: 1, carbsG: 2, fatG: 3 }
  const b = { eatenOn: '2026-11-15', energyKj: 200, proteinG: 0.1, carbsG: 0.2, fatG: 0.3 }
  const c = { eatenOn: '2026-11-16', energyKj: 50, proteinG: 5, carbsG: 0, fatG: 0 }
  it('adds everything up', () => {
    expect(sumNutrients([])).toEqual({ energyKj: 0, proteinG: 0, carbsG: 0, fatG: 0 })
    expect(sumNutrients([a, b])).toEqual({ energyKj: 300.2, proteinG: 1.1, carbsG: 2.2, fatG: 3.3 })
  })
  it('groups totals by day', () => {
    const totals = dailyTotals([a, b, c])
    expect(totals.get('2026-11-15')?.energyKj).toBe(300.2)
    expect(totals.get('2026-11-16')).toEqual({ energyKj: 50, proteinG: 5, carbsG: 0, fatG: 0 })
  })
})

describe('rescaleEntry', () => {
  it('scales the snapshot in proportion to the new amount', () => {
    const entry = { amount: 1, amountUnit: 'serving' as const, grams: 33, energyKj: 488.4, proteinG: 4.1, carbsG: 21.7, fatG: 0.4 }
    expect(rescaleEntry(entry, 2)).toEqual({ amount: 2, grams: 66, energyKj: 976.8, proteinG: 8.2, carbsG: 43.4, fatG: 0.8 })
  })
  it('refuses quick adds and bad amounts', () => {
    const quick = { amount: null, amountUnit: null, grams: null, energyKj: 500, proteinG: 0, carbsG: 0, fatG: 0 }
    expect(rescaleEntry(quick, 2)).toBeNull()
    expect(rescaleEntry({ ...quick, amount: 100, amountUnit: 'g', grams: 100 }, 0)).toBeNull()
  })
})

describe('helpers', () => {
  it('groups entries by meal', () => {
    const g = groupByMeal([{ meal: 'lunch' as const, id: 1 }, { meal: 'snack' as const, id: 2 }, { meal: 'lunch' as const, id: 3 }])
    expect(g.lunch.map((e) => e.id)).toEqual([1, 3])
    expect(g.breakfast).toEqual([])
  })
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
  it('picks a meal from the hour', () => {
    expect(mealForHour(7)).toBe('breakfast')
    expect(mealForHour(12)).toBe('lunch')
    expect(mealForHour(15)).toBe('snack')
    expect(mealForHour(19)).toBe('dinner')
    expect(mealForHour(23)).toBe('snack')
  })
  it('describes amounts', () => {
    expect(describeAmount({ amount: 150, amountUnit: 'g', grams: 150 })).toBe('150 g')
    expect(describeAmount({ amount: 1, amountUnit: 'serving', grams: 33 })).toBe('1 serving (33 g)')
    expect(describeAmount({ amount: 1.5, amountUnit: 'serving', grams: 49.5 })).toBe('1.5 servings (50 g)')
    expect(describeAmount({ amount: null, amountUnit: null, grams: null })).toBeNull()
  })
})
