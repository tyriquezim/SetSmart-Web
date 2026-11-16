import {
  bodyWeightTrend,
  changeOver,
  dateToMs,
  formatWeight,
  summariseExercises,
  todayIsoDate,
  toKg,
  type BodyWeightEntry,
  type WeightUnit,
} from '@setsmart/core'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { LineChart } from '../components/charts/LineChart'
import { Sparkline } from '../components/charts/Sparkline'
import { chartTheme } from '../components/charts/theme'
import { TrashIcon } from '../components/icons'
import { Button, Card, EmptyState, ErrorText, Input, LoadingBlock, NumberInput, PageHeader, Segmented } from '../components/ui'
import { useBodyWeights, useDeleteBodyWeight, useExercises, useExerciseStats, useUpsertBodyWeight, useWeightUnit } from '../hooks/data'
import { useNow } from '../hooks/useNow'
import { formatDate } from '../lib/format'
import { formatBodyWeight, formatSignedWeight, RANGE_OPTIONS, rangeStart, type RangeKey } from '../lib/progress'

export function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" />
      <div className="space-y-10">
        <BodyWeightSection />
        <ExercisesSection />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Body weight
// ---------------------------------------------------------------------------

function BodyWeightSection() {
  const unit = useWeightUnit()
  const weights = useBodyWeights()
  const now = useNow(60_000)
  const [range, setRange] = useState<RangeKey>('3M')
  const [showTable, setShowTable] = useState(false)

  const entries = useMemo(() => weights.data ?? [], [weights.data])
  const trend = useMemo(() => bodyWeightTrend(entries), [entries])
  const from = rangeStart(range, now)
  const series = useMemo(() => {
    const daily = entries.map((e) => ({ t: dateToMs(e.measuredOn), v: e.weightKg })).filter((p) => p.t >= from)
    const avg = trend.filter((p) => p.t >= from)
    return [
      { key: 'daily', label: 'Daily weigh-in', color: chartTheme.deemphasis, points: daily, kind: 'dots' as const },
      { key: 'trend', label: '7-day average', color: chartTheme.series, points: avg, kind: 'line' as const },
    ]
  }, [entries, trend, from])

  const latest = entries[entries.length - 1]
  const latestAvg = trend[trend.length - 1]
  const change30 = changeOver(trend, 30)

  return (
    <section aria-labelledby="bw-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="bw-heading" className="font-bold">Body weight</h2>
          {latest ? (
            <p className="mt-1">
              <span className="text-4xl font-black">{formatBodyWeight(unit, latest.weightKg)}</span>
              <span className="block sm:inline text-sm text-zinc-400 sm:ml-2">
                {formatDate(latest.measuredOn + 'T12:00:00')} · 7-day avg {formatBodyWeight(unit, latestAvg.v)}
                {change30 != null && ` (${formatSignedWeight(unit, change30)} in 30 days)`}
                {latest.bodyFatPct != null && ` · ${latest.bodyFatPct}% body fat`}
              </span>
            </p>
          ) : (
            <p className="text-sm text-zinc-400 mt-1">Log your weight to see your trend.</p>
          )}
        </div>
        {entries.length > 0 && <Segmented label="Date range" value={range} options={RANGE_OPTIONS} onChange={setRange} />}
      </div>

      <LogWeightForm unit={unit} />

      {weights.isPending ? (
        <LoadingBlock />
      ) : weights.error ? (
        <ErrorText error={weights.error} />
      ) : entries.length > 0 ? (
        <Card className="p-4">
          {series[0].points.length === 0 ? (
            <p className="text-sm text-zinc-500 py-12 text-center">No weigh-ins in this range.</p>
          ) : (
            <LineChart series={series} ariaLabel="Body weight over time" formatValue={(v) => formatBodyWeight(unit, v)} endLabel={false} />
          )}
          <button type="button" className="text-xs text-zinc-400 hover:text-zinc-100 mt-3" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
            {showTable ? 'Hide entries' : `Show all ${entries.length} entries`}
          </button>
          {showTable && <WeightTable entries={entries} unit={unit} />}
        </Card>
      ) : null}
    </section>
  )
}

function LogWeightForm({ unit }: { unit: WeightUnit }) {
  const upsert = useUpsertBodyWeight()
  const [date, setDate] = useState(() => todayIsoDate())
  const [value, setValue] = useState<number | null>(null)
  const [fat, setFat] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  const fatOk = fat == null || (fat >= 3 && fat <= 70)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (value == null || value <= 0 || !fatOk) return
    upsert.mutate(
      { measuredOn: date, weightKg: toKg(unit, value), bodyFatPct: fat },
      {
        onSuccess: () => {
          setValue(null)
          setFat(null)
          setSaved(true)
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          aria-label="Date"
          value={date}
          max={todayIsoDate()}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto flex-1 min-w-36"
          required
        />
        <div className="relative flex-1 min-w-28">
          <NumberInput aria-label={`Weight in ${unit}`} placeholder="Weight" allowEmpty min={0} value={value} onChange={(v) => { setValue(v); setSaved(false) }} className="pr-10" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{unit}</span>
        </div>
        <div className="relative flex-1 min-w-28">
          <NumberInput aria-label="Body fat percent (optional)" placeholder="Body fat" allowEmpty min={3} max={70} value={fat} onChange={(v) => { setFat(v); setSaved(false) }} className="pr-8" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">%</span>
        </div>
        <Button type="submit" variant="primary" className="h-11" loading={upsert.isPending} disabled={value == null || value <= 0 || !fatOk}>
          Log
        </Button>
      </div>
      <p className="text-xs text-zinc-500">Body fat % is optional (e.g. from a smart scale). It makes energy estimates reflect your muscle.</p>
      {!fatOk && <p className="text-xs text-red-300">Enter a body fat % between 3 and 70.</p>}
      {saved && <p className="text-xs text-lime-200">Saved. Logging the same day again replaces that day's entry.</p>}
      <ErrorText error={upsert.error} />
    </form>
  )
}

function WeightTable({ entries, unit }: { entries: BodyWeightEntry[]; unit: WeightUnit }) {
  const del = useDeleteBodyWeight()
  return (
    <div className="mt-3 max-h-80 overflow-y-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-zinc-500 text-left">
            <th className="font-normal pb-1">Date</th>
            <th className="font-normal pb-1">Weight</th>
            <th className="font-normal pb-1">Body fat</th>
            <th className="pb-1"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {[...entries].reverse().map((e) => (
            <tr key={e.id} className="border-t border-zinc-800/80">
              <td className="py-1.5">{formatDate(e.measuredOn + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td className="py-1.5">{formatBodyWeight(unit, e.weightKg)}</td>
              <td className="py-1.5 text-zinc-400">{e.bodyFatPct != null ? `${e.bodyFatPct}%` : '—'}</td>
              <td className="py-1.5 text-right">
                <button
                  type="button"
                  className="p-1 text-zinc-500 hover:text-red-300 disabled:opacity-40"
                  onClick={() => del.mutate(e.id)}
                  disabled={del.isPending && del.variables === e.id}
                  aria-label={`Delete entry for ${e.measuredOn}`}
                >
                  <TrashIcon className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

function ExercisesSection() {
  const unit = useWeightUnit()
  const stats = useExerciseStats()
  const exercises = useExercises()
  const names = useMemo(() => new Map(exercises.data?.map((e) => [e.id, e.name])), [exercises.data])
  const summaries = useMemo(() => summariseExercises(stats.data ?? []), [stats.data])

  return (
    <section aria-labelledby="ex-heading" className="space-y-3">
      <h2 id="ex-heading" className="font-bold">Lifts</h2>
      {stats.isPending ? (
        <LoadingBlock />
      ) : stats.error ? (
        <ErrorText error={stats.error} />
      ) : summaries.length === 0 ? (
        <EmptyState title="No lifts logged yet">
          <p>Finish a workout and each exercise's progress will show up here.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {summaries.map((s) => (
            <li key={s.exerciseId}>
              <Link to={`/progress/exercises/${s.exerciseId}`} className="block group">
                <Card className="p-4 flex items-center gap-4 group-hover:border-zinc-700">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug break-words">{names.get(s.exerciseId) ?? 'Removed exercise'}</p>
                    <p className="text-xs text-zinc-500">
                      {s.sessions} {s.sessions === 1 ? 'session' : 'sessions'} · last {formatDate(s.lastPerformedAt)}
                    </p>
                  </div>
                  <Sparkline points={s.trend} />
                  <div className="text-right shrink-0">
                    <p className="font-semibold">
                      {s.best == null ? '—' : s.primaryMetric === 'maxReps' ? `${s.best} reps` : formatWeight(unit, s.best)}
                    </p>
                    <p className="text-xs text-zinc-500">{s.primaryMetric === 'maxReps' ? 'best set' : 'best est. 1RM'}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
