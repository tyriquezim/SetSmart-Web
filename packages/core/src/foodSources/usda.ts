import { KJ_PER_KCAL } from '../units'
import type { FoodData } from '../types'

// USDA FoodData Central: generic whole foods ("Bananas, raw"), per 100 g.
// Needs an API key from https://fdc.nal.usda.gov/api-key-signup ("DEMO_KEY"
// works but is limited to a handful of requests per hour, shared by IP).

const BASE = 'https://api.nal.usda.gov/fdc/v1'

// FoodData Central nutrient ids
const ENERGY_KJ = 1062
const ENERGY_KCAL = 1008
const ENERGY_ATWATER_GENERAL = 2047
const ENERGY_ATWATER_SPECIFIC = 2048
const PROTEIN = 1003
const FAT = 1004
const CARBS = 1005

export interface UsdaFood {
  fdcId: number
  description?: string
  brandOwner?: string
  foodNutrients?: Array<{ nutrientId?: number; unitName?: string; value?: number }>
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

/** Convert a FoodData Central search hit to FoodData; null if it has no energy value. */
export function parseUsdaFood(f: UsdaFood): FoodData | null {
  const name = f.description?.trim()
  if (!name) return null
  const byId = new Map<number, number>()
  for (const n of f.foodNutrients ?? []) {
    if (n.nutrientId != null && typeof n.value === 'number' && n.value >= 0) byId.set(n.nutrientId, n.value)
  }
  const kcal = byId.get(ENERGY_KCAL) ?? byId.get(ENERGY_ATWATER_SPECIFIC) ?? byId.get(ENERGY_ATWATER_GENERAL)
  const energyKj = byId.get(ENERGY_KJ) ?? (kcal != null ? kcal * KJ_PER_KCAL : null)
  if (energyKj == null) return null
  return {
    source: 'usda',
    sourceId: String(f.fdcId),
    name,
    brand: f.brandOwner?.trim() || null,
    barcode: null,
    baseUnit: 'g',
    per100: {
      energyKj: Math.round(energyKj * 10) / 10,
      proteinG: byId.get(PROTEIN) ?? null,
      carbsG: byId.get(CARBS) ?? null,
      fatG: byId.get(FAT) ?? null,
    },
    servingSize: null,
    servingLabel: null,
  }
}

/** Search generic foods (Foundation and SR Legacy data, which are per 100 g). */
export async function searchUsda(
  query: string,
  apiKey: string,
  opts: { signal?: AbortSignal; pageSize?: number } = {},
): Promise<FoodData[]> {
  const params = new URLSearchParams({
    query,
    dataType: 'Foundation,SR Legacy',
    pageSize: String(opts.pageSize ?? 15),
    api_key: apiKey,
  })
  const res = await fetch(`${BASE}/foods/search?${params}`, { signal: opts.signal })
  if (res.status === 429) throw new RateLimitError('USDA search limit reached — try again later.')
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`)
  const body = (await res.json()) as { foods?: UsdaFood[] }
  return (body.foods ?? []).map(parseUsdaFood).filter((f): f is FoodData => f !== null)
}
