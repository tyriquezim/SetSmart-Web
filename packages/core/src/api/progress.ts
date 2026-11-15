import type { ExerciseHistory, ExerciseSessionStat } from '../types'
import { unwrap, type Client } from './client'

interface StatRow {
  exercise_id: string
  session_id: string
  started_at: string
  set_count: number
  max_reps: number
  max_weight_kg: number | string | null
  best_e1rm_kg: number | string | null
  volume_kg: number | string
  total_reps: number
}

const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

const toStat = (r: StatRow): ExerciseSessionStat => ({
  exerciseId: r.exercise_id,
  sessionId: r.session_id,
  startedAt: r.started_at,
  setCount: r.set_count,
  maxReps: r.max_reps,
  maxWeightKg: num(r.max_weight_kg),
  bestE1rmKg: num(r.best_e1rm_kg),
  volumeKg: Number(r.volume_kg),
  totalReps: r.total_reps,
})

/** Per-session stats, oldest first. Pass exerciseIds to limit to those exercises. */
export async function listExerciseSessionStats(db: Client, exerciseIds?: string[]): Promise<ExerciseSessionStat[]> {
  let q = db.from('exercise_session_stats').select('*').order('started_at')
  if (exerciseIds) q = q.in('exercise_id', exerciseIds)
  return unwrap<StatRow[]>(await q).map(toStat)
}

/**
 * History for the given exercises: the sets from the most recent session plus
 * all-time bests. Exercises never performed are absent from the result.
 */
export async function getExerciseHistory(db: Client, exerciseIds: string[]): Promise<Record<string, ExerciseHistory>> {
  if (exerciseIds.length === 0) return {}
  const ids = [...new Set(exerciseIds)]
  const stats = await listExerciseSessionStats(db, ids)
  const result: Record<string, ExerciseHistory> = {}
  const latestSession: Record<string, string> = {}
  for (const s of stats) {
    const h = (result[s.exerciseId] ??= {
      lastSets: [],
      lastPerformedAt: null,
      bestE1rmKg: null,
      maxWeightKg: null,
      maxReps: null,
    })
    h.bestE1rmKg = maxOrNull(h.bestE1rmKg, s.bestE1rmKg)
    h.maxWeightKg = maxOrNull(h.maxWeightKg, s.maxWeightKg)
    h.maxReps = maxOrNull(h.maxReps, s.maxReps)
    h.lastPerformedAt = s.startedAt // stats are oldest-first, so the last one wins
    latestSession[s.exerciseId] = s.sessionId
  }
  const sessionIds = [...new Set(Object.values(latestSession))]
  if (sessionIds.length > 0) {
    const sets = unwrap<Array<{ exercise_id: string; session_id: string; set_number: number; reps: number; weight_kg: number | string | null }>>(
      await db
        .from('workout_sets')
        .select('exercise_id, session_id, set_number, reps, weight_kg')
        .in('session_id', sessionIds)
        .in('exercise_id', ids)
        .order('set_number'),
    )
    for (const s of sets) {
      if (latestSession[s.exercise_id] === s.session_id) {
        result[s.exercise_id].lastSets.push({ reps: s.reps, weightKg: num(s.weight_kg) })
      }
    }
  }
  return result
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}
