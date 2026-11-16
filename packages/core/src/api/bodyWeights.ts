import type { BodyWeightEntry } from '../types'
import { unwrap, type Client } from './client'

interface Row {
  id: string
  measured_on: string
  weight_kg: number | string
  body_fat_pct: number | string | null
  note: string | null
}

const COLUMNS = 'id, measured_on, weight_kg, body_fat_pct, note'

const toEntry = (r: Row): BodyWeightEntry => ({
  id: r.id,
  measuredOn: r.measured_on,
  weightKg: Number(r.weight_kg),
  bodyFatPct: r.body_fat_pct == null ? null : Number(r.body_fat_pct),
  note: r.note,
})

/** All entries, oldest first. */
export async function listBodyWeights(db: Client): Promise<BodyWeightEntry[]> {
  return unwrap<Row[]>(await db.from('body_weights').select(COLUMNS).order('measured_on')).map(
    toEntry,
  )
}

/** Log (or overwrite) the weight for a given day. */
export async function upsertBodyWeight(
  db: Client,
  userId: string,
  entry: { measuredOn: string; weightKg: number; bodyFatPct?: number | null; note?: string | null },
): Promise<BodyWeightEntry> {
  const row = unwrap<Row>(
    await db
      .from('body_weights')
      .upsert(
        {
          user_id: userId,
          measured_on: entry.measuredOn,
          weight_kg: Math.round(entry.weightKg * 100) / 100,
          body_fat_pct: entry.bodyFatPct == null ? null : Math.round(entry.bodyFatPct * 10) / 10,
          note: entry.note?.trim() || null,
        },
        { onConflict: 'user_id,measured_on' },
      )
      .select(COLUMNS)
      .single(),
  )
  return toEntry(row)
}

export async function deleteBodyWeight(db: Client, id: string): Promise<void> {
  unwrap(await db.from('body_weights').delete().eq('id', id))
}
