import {
  addDays,
  kjTo,
  searchOpenFoodFacts,
  searchUsda,
  todayIsoDate,
  type AmountUnit,
  type EnergyUnit,
  type FoodData,
  type Meal,
} from '@setsmart/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/** Starting amount when logging a food: what was logged last time, else 1 serving, else 100 g/ml. */
export function defaultAmount(food: FoodData, last?: { amount: number | null; unit: AmountUnit | null }) {
  if (last?.amount != null && last.unit && (last.unit !== 'serving' || food.servingSize)) {
    return { amount: last.amount, unit: last.unit }
  }
  return food.servingSize ? { amount: 1, unit: 'serving' as const } : { amount: 100, unit: food.baseUnit }
}

export const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

export const energyLabel = (unit: EnergyUnit) => (unit === 'kj' ? 'kJ' : 'kcal')

/** Energy as a bare rounded number in the user's unit, e.g. "1,480". */
export function energyNumber(unit: EnergyUnit, kj: number): string {
  return Math.round(kjTo(unit, kj)).toLocaleString()
}

/** Macro grams for display: one decimal under 10 g, whole numbers above. */
export function grams(g: number): string {
  return g < 10 ? String(Math.round(g * 10) / 10) : Math.round(g).toLocaleString()
}

/** "Today", "Yesterday", "Tomorrow" or e.g. "Sat 14 Nov". */
export function dayLabel(isoDate: string, today = todayIsoDate()): string {
  if (isoDate === today) return 'Today'
  if (isoDate === addDays(today, -1)) return 'Yesterday'
  if (isoDate === addDays(today, 1)) return 'Tomorrow'
  return new Date(isoDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export const isIsoDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
export const isMeal = (s: string | null): s is Meal => s === 'breakfast' || s === 'lunch' || s === 'dinner' || s === 'snack'

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const searchOptions = { staleTime: 10 * 60_000, gcTime: 30 * 60_000, retry: 1 }

/** Open Food Facts search for packaged products; idle under 2 characters. */
export function useOffSearch(query: string) {
  const q = query.trim()
  return useQuery<FoodData[]>({
    queryKey: ['search', 'off', q.toLowerCase()],
    queryFn: ({ signal }) => searchOpenFoodFacts(q, { signal }),
    enabled: q.length >= 2,
    ...searchOptions,
  })
}

/** USDA search for generic foods; idle under 2 characters. Rate limits aren't retried. */
export function useUsdaSearch(query: string) {
  const q = query.trim()
  return useQuery<FoodData[]>({
    queryKey: ['search', 'usda', q.toLowerCase()],
    queryFn: ({ signal }) => searchUsda(q, USDA_API_KEY, { signal }),
    enabled: q.length >= 2,
    ...searchOptions,
    retry: (count, err) => err.name !== 'RateLimitError' && count < 1,
  })
}

/** Plain-language source name for result lists. */
export function sourceLabel(source: FoodData['source']): string {
  return source === 'off' ? 'Open Food Facts' : source === 'usda' ? 'USDA' : 'My food'
}
