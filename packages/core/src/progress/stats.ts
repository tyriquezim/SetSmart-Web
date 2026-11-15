/**
 * Pure helpers for progress charts and personal records.
 */
import type { BodyWeightEntry, ExerciseSessionStat } from '../types'

/** Epley estimated one-rep max. Returns null outside 1-12 reps, where it is unreliable. */
export function estimateOneRepMax(weightKg: number | null, reps: number): number | null {
  if (weightKg == null || weightKg <= 0 || reps < 1 || reps > 12) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

/** Parse a YYYY-MM-DD local date to epoch ms at local midnight. */
export function dateToMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Today's local date as YYYY-MM-DD. */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface TimePoint {
  t: number
  v: number
}

/**
 * Trailing time-window average for each entry: the mean of all entries within
 * the previous `windowDays` days (inclusive). Smooths daily water-weight noise.
 * Entries must be sorted oldest first.
 */
export function bodyWeightTrend(entries: BodyWeightEntry[], windowDays = 7): TimePoint[] {
  const pts = entries.map((e) => ({ t: dateToMs(e.measuredOn), v: e.weightKg }))
  const windowMs = (windowDays - 1) * 86_400_000
  let start = 0
  let sum = 0
  return pts.map((p, i) => {
    sum += p.v
    while (pts[start].t < p.t - windowMs) sum -= pts[start++].v
    return { t: p.t, v: sum / (i - start + 1) }
  })
}

/**
 * Change between the latest value and the value closest to `days` ago
 * (only if there is a reading at least `days` old). Null if not enough data.
 */
export function changeOver(points: TimePoint[], days: number): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const cutoff = last.t - days * 86_400_000
  let base: TimePoint | null = null
  for (const p of points) {
    if (p.t <= cutoff) base = p
    else break
  }
  return base ? last.v - base.v : null
}

export type ProgressMetric = 'e1rm' | 'maxWeight' | 'volume' | 'maxReps'

export function metricValue(s: ExerciseSessionStat, metric: ProgressMetric): number | null {
  switch (metric) {
    case 'e1rm':
      return s.bestE1rmKg
    case 'maxWeight':
      return s.maxWeightKg
    case 'volume':
      return s.volumeKg
    case 'maxReps':
      return s.maxReps
  }
}

export function metricSeries(stats: ExerciseSessionStat[], metric: ProgressMetric): TimePoint[] {
  return stats.flatMap((s) => {
    const v = metricValue(s, metric)
    return v == null ? [] : [{ t: Date.parse(s.startedAt), v }]
  })
}

export interface PersonalRecord {
  value: number
  sessionId: string
  at: string
}

export interface ExerciseRecords {
  e1rm: PersonalRecord | null
  maxWeight: PersonalRecord | null
  volume: PersonalRecord | null
  maxReps: PersonalRecord | null
}

export function personalRecords(stats: ExerciseSessionStat[]): ExerciseRecords {
  const best = (metric: ProgressMetric): PersonalRecord | null => {
    let rec: PersonalRecord | null = null
    for (const s of stats) {
      const v = metricValue(s, metric)
      // Strictly greater: the first time a record is reached is when it was set.
      if (v != null && v > 0 && (!rec || v > rec.value)) rec = { value: v, sessionId: s.sessionId, at: s.startedAt }
    }
    return rec
  }
  return { e1rm: best('e1rm'), maxWeight: best('maxWeight'), volume: best('volume'), maxReps: best('maxReps') }
}

/** True when an exercise has never been done with external weight (e.g. pull-ups). */
export function isBodyweightOnly(stats: ExerciseSessionStat[]): boolean {
  return stats.every((s) => !s.maxWeightKg)
}

export interface ExerciseProgressSummary {
  exerciseId: string
  sessions: number
  lastPerformedAt: string
  /** Primary metric per session (e1RM, or max reps for bodyweight-only), oldest first */
  trend: TimePoint[]
  primaryMetric: ProgressMetric
  best: number | null
}

/** Group stats by exercise, most recently performed first. */
export function summariseExercises(stats: ExerciseSessionStat[]): ExerciseProgressSummary[] {
  const byExercise = new Map<string, ExerciseSessionStat[]>()
  for (const s of stats) {
    const list = byExercise.get(s.exerciseId)
    if (list) list.push(s)
    else byExercise.set(s.exerciseId, [s])
  }
  return [...byExercise.entries()]
    .map(([exerciseId, list]) => {
      const primaryMetric: ProgressMetric = isBodyweightOnly(list) ? 'maxReps' : 'e1rm'
      const trend = metricSeries(list, primaryMetric)
      return {
        exerciseId,
        sessions: list.length,
        lastPerformedAt: list[list.length - 1].startedAt,
        trend,
        primaryMetric,
        best: trend.length ? Math.max(...trend.map((p) => p.v)) : null,
      }
    })
    .sort((a, b) => Date.parse(b.lastPerformedAt) - Date.parse(a.lastPerformedAt))
}
