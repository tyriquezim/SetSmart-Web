import type { BodyWeightEntry } from '../types'
import { unwrap, type Client } from './client'

interface Row {
  id: string
  measured_on: string
  weight_kg: number | string
  note: string | null
}

const toEntry = (r: Row): BodyWeightEntry => ({
  id: r.id,
  measuredOn: r.measured_on,
  weightKg: Number(r.weight_kg),
  note: r.note,
})

/** All entries, oldest first. */
export async function listBodyWeights(db: Client): Promise<BodyWeightEntry[]> {
  return unwrap<Row[]>(await db.from('body_weights').select('id, measured_on, weight_kg, note').order('measured_on')).map(
    toEntry,
  )
}

/** Log (or overwrite) the weight for a given day. */
export async function upsertBodyWeight(
  db: Client,
  userId: string,
  entry: { measuredOn: string; weightKg: number; note?: string | null },
): Promise<BodyWeightEntry> {
  const row = unwrap<Row>(
    await db
      .from('body_weights')
      .upsert(
        {
          user_id: userId,
          measured_on: entry.measuredOn,
          weight_kg: Math.round(entry.weightKg * 100) / 100,
          note: entry.note?.trim() || null,
        },
        { onConflict: 'user_id,measured_on' },
      )
      .select('id, measured_on, weight_kg, note')
      .single(),
  )
  return toEntry(row)
}

export async function deleteBodyWeight(db: Client, id: string): Promise<void> {
  unwrap(await db.from('body_weights').delete().eq('id', id))
}
