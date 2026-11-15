import type { AmountUnit, Food, FoodData } from '../types'
import { unwrap, type Client } from './client'

export interface FoodRow {
  id: string
  source: Food['source']
  source_id: string | null
  name: string
  brand: string | null
  barcode: string | null
  base_unit: Food['baseUnit']
  energy_kj: number | string
  protein_g: number | string | null
  carbs_g: number | string | null
  fat_g: number | string | null
  serving_size: number | string | null
  serving_label: string | null
  archived_at: string | null
}

export const FOOD_COLUMNS =
  'id, source, source_id, name, brand, barcode, base_unit, energy_kj, protein_g, carbs_g, fat_g, serving_size, serving_label, archived_at'

const numOrNull = (v: number | string | null) => (v == null ? null : Number(v))

export const toFood = (r: FoodRow): Food => ({
  id: r.id,
  source: r.source,
  sourceId: r.source_id,
  name: r.name,
  brand: r.brand,
  barcode: r.barcode,
  baseUnit: r.base_unit,
  per100: {
    energyKj: Number(r.energy_kj),
    proteinG: numOrNull(r.protein_g),
    carbsG: numOrNull(r.carbs_g),
    fatG: numOrNull(r.fat_g),
  },
  servingSize: numOrNull(r.serving_size),
  servingLabel: r.serving_label,
  archivedAt: r.archived_at,
})

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

function toRow(f: FoodData) {
  return {
    source: f.source,
    source_id: f.sourceId,
    name: f.name.trim(),
    brand: f.brand?.trim() || null,
    barcode: f.barcode?.trim() || null,
    base_unit: f.baseUnit,
    energy_kj: r2(f.per100.energyKj),
    protein_g: r2(f.per100.proteinG),
    carbs_g: r2(f.per100.carbsG),
    fat_g: r2(f.per100.fatG),
    serving_size: r2(f.servingSize),
    serving_label: f.servingLabel?.trim() || null,
  }
}

/** The user's saved foods (custom and previously logged search results), A–Z. */
export async function listFoods(db: Client): Promise<Food[]> {
  return unwrap<FoodRow[]>(
    await db.from('foods').select(FOOD_COLUMNS).is('archived_at', null).order('name'),
  ).map(toFood)
}

export async function createFood(db: Client, userId: string, input: FoodData): Promise<Food> {
  return toFood(
    unwrap<FoodRow>(
      await db
        .from('foods')
        .insert({ ...toRow({ ...input, source: 'custom', sourceId: null }), user_id: userId })
        .select(FOOD_COLUMNS)
        .single(),
    ),
  )
}

export async function updateFood(db: Client, id: string, input: FoodData): Promise<Food> {
  const { source: _s, source_id: _id, ...row } = toRow(input)
  return toFood(
    unwrap<FoodRow>(
      await db
        .from('foods')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(FOOD_COLUMNS)
        .single(),
    ),
  )
}

/** Hide a food from lists. Past log entries keep their own snapshot. */
export async function archiveFood(db: Client, id: string): Promise<void> {
  unwrap(await db.from('foods').update({ archived_at: new Date().toISOString() }).eq('id', id))
}

/**
 * Save a food from a search API into the user's list (or refresh the copy
 * already there) so it can be logged and shows up in recents. Custom foods
 * are returned as-is.
 */
export async function ensureFoodSaved(db: Client, userId: string, food: FoodData | Food): Promise<Food> {
  if ('id' in food && food.id) return food
  if (food.source === 'custom' || !food.sourceId) throw new Error('Custom foods must be created first')
  return toFood(
    unwrap<FoodRow>(
      await db
        .from('foods')
        .upsert(
          { ...toRow(food), user_id: userId, archived_at: null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,source,source_id' },
        )
        .select(FOOD_COLUMNS)
        .single(),
    ),
  )
}

/** A food the user already has with this barcode (custom foods win over saved lookups). */
export async function findSavedFoodByBarcode(db: Client, barcode: string): Promise<Food | null> {
  const rows = unwrap<FoodRow[]>(
    await db.from('foods').select(FOOD_COLUMNS).eq('barcode', barcode).is('archived_at', null),
  )
  const food = rows.find((r) => r.source === 'custom') ?? rows[0]
  return food ? toFood(food) : null
}

export interface RecentFood {
  food: Food
  /** What the user logged last time, to prefill the amount */
  lastAmount: number | null
  lastAmountUnit: AmountUnit | null
}

/** Foods logged most recently, newest first, one entry per food. */
export async function listRecentFoods(db: Client, limit = 30): Promise<RecentFood[]> {
  type Row = { amount: number | string | null; amount_unit: AmountUnit | null; foods: FoodRow | null }
  const rows = unwrap(
    await db
      .from('food_logs')
      .select(`amount, amount_unit, foods (${FOOD_COLUMNS})`)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
      // food_id is a to-one link, so PostgREST returns an object, not an array.
      .overrideTypes<Row[], { merge: false }>(),
  )
  const seen = new Set<string>()
  const out: RecentFood[] = []
  for (const r of rows) {
    if (!r.foods || r.foods.archived_at || seen.has(r.foods.id)) continue
    seen.add(r.foods.id)
    out.push({ food: toFood(r.foods), lastAmount: numOrNull(r.amount), lastAmountUnit: r.amount_unit })
    if (out.length >= limit) break
  }
  return out
}
