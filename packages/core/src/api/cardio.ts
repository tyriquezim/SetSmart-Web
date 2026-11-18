import type { CardioInput, CardioSession } from '../types'
import { unwrap, type Client } from './client'

interface Row {
  id: string
  activity: CardioSession['activity']
  custom_name: string | null
  started_at: string
  duration_s: number
  distance_m: number | string | null
  effort: CardioSession['effort']
  met: number | string | null
  notes: string | null
}

const COLUMNS = 'id, activity, custom_name, started_at, duration_s, distance_m, effort, met, notes'

const toSession = (r: Row): CardioSession => ({
  id: r.id,
  activity: r.activity,
  customName: r.custom_name,
  startedAt: r.started_at,
  durationS: r.duration_s,
  distanceM: r.distance_m == null ? null : Number(r.distance_m),
  effort: r.effort,
  met: r.met == null ? null : Number(r.met),
  notes: r.notes,
})

/** Most recent first. */
export async function listCardioSessions(
  db: Client,
  { limit = 20, before }: { limit?: number; before?: string } = {},
): Promise<CardioSession[]> {
  let q = db.from('cardio_sessions').select(COLUMNS).order('started_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('started_at', before)
  return unwrap<Row[]>(await q).map(toSession)
}

/** Every session that started in [fromIso, toIso), oldest first. */
export async function listCardioSessionsBetween(db: Client, fromIso: string, toIso: string): Promise<CardioSession[]> {
  return unwrap<Row[]>(
    await db
      .from('cardio_sessions')
      .select(COLUMNS)
      .gte('started_at', fromIso)
      .lt('started_at', toIso)
      .order('started_at'),
  ).map(toSession)
}

export async function getCardioSession(db: Client, id: string): Promise<CardioSession> {
  return toSession(unwrap<Row>(await db.from('cardio_sessions').select(COLUMNS).eq('id', id).single()))
}

/** Create (id null) or update a session. */
export async function saveCardioSession(db: Client, input: CardioInput): Promise<CardioSession> {
  const row = {
    activity: input.activity,
    custom_name: input.activity === 'other' ? input.customName?.trim() || null : null,
    started_at: input.startedAt,
    duration_s: Math.round(input.durationS),
    distance_m: input.distanceM,
    effort: input.effort,
    met: input.activity === 'other' ? input.met : null,
    notes: input.notes?.trim() || null,
  }
  const q = input.id
    ? db.from('cardio_sessions').update(row).eq('id', input.id)
    : db.from('cardio_sessions').insert(row)
  return toSession(unwrap<Row>(await q.select(COLUMNS).single()))
}

export async function deleteCardioSession(db: Client, id: string): Promise<void> {
  unwrap(await db.from('cardio_sessions').delete().eq('id', id))
}
