import { formatWeight, isBodyweightOnly, metricSeries, personalRecords, type ProgressMetric, type WeightUnit } from '@setsmart/core'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { LineChart } from '../components/charts/LineChart'
import { chartTheme } from '../components/charts/theme'
import { StatTile } from '../components/StatTile'
import { Card, EmptyState, ErrorText, LoadingBlock, PageHeader, Segmented } from '../components/ui'
import { useExercises, useExerciseStats, useWeightUnit } from '../hooks/data'
import { useNow } from '../hooks/useNow'
import { formatDate } from '../lib/format'
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '../lib/progress'

const METRICS: Array<{ value: ProgressMetric; label: string; weighted: boolean }> = [
  { value: 'e1rm', label: 'Est. 1RM', weighted: true },
  { value: 'maxWeight', label: 'Heaviest', weighted: true },
  { value: 'volume', label: 'Volume', weighted: true },
  { value: 'maxReps', label: 'Best reps', weighted: false },
]

const METRIC_DESCRIPTIONS: Record<ProgressMetric, string> = {
  e1rm: 'Estimated one-rep max (Epley), from your best set of 1–12 reps each session.',
  maxWeight: 'Heaviest weight lifted in each session.',
  volume: 'Total weight moved each session (reps × weight, summed over sets).',
  maxReps: 'Most reps in a single set each session.',
}

function formatMetric(metric: ProgressMetric, unit: WeightUnit, v: number): string {
  return metric === 'maxReps' ? `${Math.round(v)} reps` : formatWeight(unit, v)
}

export function ExerciseProgressPage() {
  const { id } = useParams()
  const unit = useWeightUnit()
  const now = useNow(60_000)
  const stats = useExerciseStats()
  const exercises = useExercises()
  const exercise = exercises.data?.find((e) => e.id === id)
  const mine = useMemo(() => (stats.data ?? []).filter((s) => s.exerciseId === id), [stats.data, id])
  const bodyweightOnly = isBodyweightOnly(mine)
  const [range, setRange] = useState<RangeKey>('All')
  const [chosenMetric, setMetric] = useState<ProgressMetric | null>(null)
  const metric = chosenMetric ?? (bodyweightOnly ? 'maxReps' : 'e1rm')

  const inRange = useMemo(() => mine.filter((s) => Date.parse(s.startedAt) >= rangeStart(range, now)), [mine, range, now])
  const points = useMemo(() => metricSeries(inRange, metric), [inRange, metric])
  const records = useMemo(() => personalRecords(mine), [mine])

  if (stats.isPending || exercises.isPending) return <LoadingBlock />
  if (stats.error) return <ErrorText error={stats.error} />

  const name = exercise?.name ?? 'Exercise'
  const metricOptions = METRICS.filter((m) => !bodyweightOnly || !m.weighted)

  return (
    <>
      <Link to="/progress" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← Progress
      </Link>
      <div className="mt-3">
        <PageHeader title={name} subtitle={exercise ? `${exercise.muscleGroup} · ${exercise.equipment}` : undefined} />
      </div>

      {mine.length === 0 ? (
        <EmptyState title="No sessions yet">
          <p>Log this exercise in a workout to start tracking it.</p>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {!bodyweightOnly && (
              <>
                <StatTile
                  label="Best est. 1RM"
                  value={records.e1rm ? formatWeight(unit, records.e1rm.value) : '—'}
                  detail={records.e1rm && formatDate(records.e1rm.at)}
                />
                <StatTile
                  label="Heaviest"
                  value={records.maxWeight ? formatWeight(unit, records.maxWeight.value) : '—'}
                  detail={records.maxWeight && formatDate(records.maxWeight.at)}
                />
                <StatTile
                  label="Best volume"
                  value={records.volume ? formatWeight(unit, records.volume.value) : '—'}
                  detail={records.volume && formatDate(records.volume.at)}
                />
              </>
            )}
            {bodyweightOnly && (
              <StatTile
                label="Best set"
                value={records.maxReps ? `${records.maxReps.value} reps` : '—'}
                detail={records.maxReps && formatDate(records.maxReps.at)}
              />
            )}
            <StatTile label="Sessions" value={mine.length} detail={`since ${formatDate(mine[0].startedAt, { month: 'short', year: 'numeric' })}`} />
          </div>

          {/* Filters: one row above the chart and table they scope */}
          <div className="flex flex-wrap gap-2">
            <Segmented label="Date range" value={range} options={RANGE_OPTIONS} onChange={setRange} />
            {metricOptions.length > 1 && (
              <Segmented label="Metric" value={metric} options={metricOptions} onChange={setMetric} />
            )}
          </div>

          <Card className="p-4">
            <p className="text-xs text-zinc-500 mb-3">{METRIC_DESCRIPTIONS[metric]}</p>
            {points.length === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center">No sessions in this range.</p>
            ) : (
              <LineChart
                series={[{ key: metric, label: METRICS.find((m) => m.value === metric)!.label, color: chartTheme.series, points, kind: 'line', area: metric === 'volume' }]}
                ariaLabel={`${name}: ${METRICS.find((m) => m.value === metric)!.label} over time`}
                formatValue={(v) => formatMetric(metric, unit, v)}
                includeZero={metric === 'volume'}
              />
            )}
          </Card>

          {/* Table view: every value in the chart, reachable without hovering */}
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-sm tabular-nums whitespace-nowrap [&_th]:pr-4 [&_td]:pr-4 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
              <thead>
                <tr className="text-xs text-zinc-500 text-left">
                  <th className="font-normal pb-2">Date</th>
                  <th className="font-normal pb-2">Sets</th>
                  <th className="font-normal pb-2">Best reps</th>
                  {!bodyweightOnly && (
                    <>
                      <th className="font-normal pb-2">Heaviest</th>
                      <th className="font-normal pb-2">Est. 1RM</th>
                      <th className="font-normal pb-2 text-right">Volume</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...inRange].reverse().map((s) => (
                  <tr key={s.sessionId} className="border-t border-zinc-800/80">
                    <td className="py-2">
                      <Link to={`/history/${s.sessionId}`} className="hover:text-accent">
                        {formatDate(s.startedAt, { day: 'numeric', month: 'short', year: '2-digit' })}
                      </Link>
                    </td>
                    <td className="py-2">{s.setCount}</td>
                    <td className="py-2">{s.maxReps}</td>
                    {!bodyweightOnly && (
                      <>
                        <td className="py-2">{formatWeight(unit, s.maxWeightKg)}</td>
                        <td className="py-2">{formatWeight(unit, s.bestE1rmKg)}</td>
                        <td className="py-2 text-right">{formatWeight(unit, s.volumeKg)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  )
}
