import type { FoodLogEntry, FoodLogInput, NutritionTargets } from '../types'
import { unwrap, type Client } from './client'

interface LogRow {
  id: string
  eaten_on: string
  meal: FoodLogEntry['meal']
  food_id: string | null
  name: string
  brand: string | null
  amount: number | string | null
  amount_unit: FoodLogEntry['amountUnit']
  grams: number | string | null
  energy_kj: number | string
  protein_g: number | string
  carbs_g: number | string
  fat_g: number | string
  created_at: string
}

const COLUMNS =
  'id, eaten_on, meal, food_id, name, brand, amount, amount_unit, grams, energy_kj, protein_g, carbs_g, fat_g, created_at'

const numOrNull = (v: number | string | null) => (v == null ? null : Number(v))

const toEntry = (r: LogRow): FoodLogEntry => ({
  id: r.id,
  eatenOn: r.eaten_on,
  meal: r.meal,
  foodId: r.food_id,
  name: r.name,
  brand: r.brand,
  amount: numOrNull(r.amount),
  amountUnit: r.amount_unit,
  grams: numOrNull(r.grams),
  energyKj: Number(r.energy_kj),
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  createdAt: r.created_at,
})

function toRow(e: Partial<FoodLogInput>) {
  const row: Record<string, unknown> = {}
  if (e.eatenOn !== undefined) row.eaten_on = e.eatenOn
  if (e.meal !== undefined) row.meal = e.meal
  if (e.foodId !== undefined) row.food_id = e.foodId
  if (e.name !== undefined) row.name = e.name.trim()
  if (e.brand !== undefined) row.brand = e.brand?.trim() || null
  if (e.amount !== undefined) row.amount = e.amount
  if (e.amountUnit !== undefined) row.amount_unit = e.amountUnit
  if (e.grams !== undefined) row.grams = e.grams
  if (e.energyKj !== undefined) row.energy_kj = e.energyKj
  if (e.proteinG !== undefined) row.protein_g = e.proteinG
  if (e.carbsG !== undefined) row.carbs_g = e.carbsG
  if (e.fatG !== undefined) row.fat_g = e.fatG
  return row
}

/** Entries between two dates inclusive (YYYY-MM-DD), in the order they were logged. */
export async function listFoodLogs(db: Client, from: string, to: string = from): Promise<FoodLogEntry[]> {
  return unwrap<LogRow[]>(
    await db
      .from('food_logs')
      .select(COLUMNS)
      .gte('eaten_on', from)
      .lte('eaten_on', to)
      .order('created_at'),
  ).map(toEntry)
}

export async function addFoodLog(db: Client, userId: string, input: FoodLogInput): Promise<FoodLogEntry> {
  return toEntry(
    unwrap<LogRow>(await db.from('food_logs').insert({ ...toRow(input), user_id: userId }).select(COLUMNS).single()),
  )
}

/** Log several entries at once (e.g. copying a meal from another day). */
export async function addFoodLogs(db: Client, userId: string, inputs: FoodLogInput[]): Promise<void> {
  if (inputs.length === 0) return
  unwrap(await db.from('food_logs').insert(inputs.map((i) => ({ ...toRow(i), user_id: userId }))))
}

export async function updateFoodLog(db: Client, id: string, patch: Partial<FoodLogInput>): Promise<FoodLogEntry> {
  return toEntry(unwrap<LogRow>(await db.from('food_logs').update(toRow(patch)).eq('id', id).select(COLUMNS).single()))
}

export async function deleteFoodLog(db: Client, id: string): Promise<void> {
  unwrap(await db.from('food_logs').delete().eq('id', id))
}

// ---- Targets -----------------------------------------------------------------

interface TargetsRow {
  energy_kj: number | string | null
  protein_g: number | string | null
  carbs_g: number | string | null
  fat_g: number | string | null
}

export const NO_TARGETS: NutritionTargets = { energyKj: null, proteinG: null, carbsG: null, fatG: null }

/** The user's daily targets (all null until they set some). */
export async function getNutritionTargets(db: Client): Promise<NutritionTargets> {
  const row = unwrap<TargetsRow | null>(
    await db.from('nutrition_targets').select('energy_kj, protein_g, carbs_g, fat_g').maybeSingle(),
  )
  if (!row) return NO_TARGETS
  return {
    energyKj: numOrNull(row.energy_kj),
    proteinG: numOrNull(row.protein_g),
    carbsG: numOrNull(row.carbs_g),
    fatG: numOrNull(row.fat_g),
  }
}

export async function saveNutritionTargets(db: Client, userId: string, t: NutritionTargets): Promise<NutritionTargets> {
  const pos = (n: number | null) => (n != null && n > 0 ? Math.round(n * 100) / 100 : null)
  unwrap(
    await db.from('nutrition_targets').upsert({
      user_id: userId,
      energy_kj: pos(t.energyKj),
      protein_g: pos(t.proteinG),
      carbs_g: pos(t.carbsG),
      fat_g: pos(t.fatG),
      updated_at: new Date().toISOString(),
    }),
  )
  return getNutritionTargets(db)
}
