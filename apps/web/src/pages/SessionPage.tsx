import { formatDuration, formatWeight, type EnergyUnit, type LoggedCardio, type LoggedWorkoutSet } from '@setsmart/core'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ConfirmModal, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useDeleteWorkoutSession, useEnergyUnit, useWeightUnit, useWorkoutSession } from '../hooks/data'
import { CardioInfoText, EstimateInfo, WorkoutInfoText } from '../components/energy/EstimateInfo'
import { cardioSummary, distanceUnitFor, formatGoal, type DistanceUnit } from '../lib/cardio'
import { formatEstimate, useCardioEnergy, useWorkoutEnergy } from '../lib/energy'
import { formatDate, formatTime, minutesBetween } from '../lib/format'

export function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useWorkoutSession(id)
  const unit = useWeightUnit()
  const del = useDeleteWorkoutSession()
  const [confirm, setConfirm] = useState(false)
  const energyUnit = useEnergyUnit()
  const estimate = useWorkoutEnergy(session.data)

  if (session.isPending) return <LoadingBlock />
  if (session.error) return <ErrorText error={session.error} />
  const s = session.data

  // Group sets by the order exercises were performed, with cardio in its place.
  const groups: LoggedWorkoutSet[][] = []
  for (const set of s.sets) {
    const last = groups[groups.length - 1]
    if (last && last[0].exercisePosition === set.exercisePosition) last.push(set)
    else groups.push([set])
  }
  const items: Array<{ position: number; sets: LoggedWorkoutSet[] } | { position: number; cardio: LoggedCardio }> = [
    ...groups.map((sets) => ({ position: sets[0].exercisePosition, sets })),
    ...s.cardio.map((cardio) => ({ position: cardio.exercisePosition, cardio })),
  ].sort((a, b) => a.position - b.position)
  const cardioSeconds = s.cardio.reduce((sum, c) => sum + c.durationS, 0)
  const tiles: Array<[string, string]> = [
    ['Duration', `${minutesBetween(s.startedAt, s.finishedAt)} min`],
    ...(s.setCount > 0 || s.cardio.length === 0
      ? ([
          ['Sets', String(s.setCount)],
          ['Volume', formatWeight(unit, s.volumeKg)],
        ] as Array<[string, string]>)
      : []),
    ...(s.cardio.length > 0 ? ([['Cardio', formatDuration(cardioSeconds)]] as Array<[string, string]>) : []),
  ]

  return (
    <>
      <Link to="/history" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← History
      </Link>
      <div className="mt-3">
        <PageHeader
          title={s.name}
          subtitle={`${formatDate(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${formatTime(s.startedAt)}`}
        />
      </div>
      <dl className={`grid gap-3 text-center mb-5 ${tiles.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map(([k, v]) => (
          <Card key={k} className="py-3">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="text-lg font-bold tabular-nums mt-0.5">{v}</dd>
          </Card>
        ))}
      </dl>
      <p className="text-xs text-zinc-500 -mt-2 mb-5">
        {estimate != null ? (
          <>
            Estimated energy burned: ≈ {formatEstimate(energyUnit, estimate.kcal)} above resting{' '}
            <EstimateInfo label="How this workout's energy is estimated" title="Workout energy" unit={energyUnit}>
              <WorkoutInfoText workout={estimate} unit={energyUnit} cardioNames={s.cardio.map((c) => c.exerciseName)} />
            </EstimateInfo>
            <br />
            This is an estimate from your body details and the workout's length, not a measurement.
          </>
        ) : (
          <>
            Add your <Link to="/settings" className="text-accent">body details</Link> and{' '}
            <Link to="/progress" className="text-accent">weight</Link> to see an estimate of the energy this burned.
          </>
        )}
      </p>
      {s.notes && <p className="text-sm text-zinc-300 italic mb-5">“{s.notes}”</p>}
      <div className="space-y-3">
        {items.map((item) =>
          'cardio' in item ? (
            <CardioEntry key={item.position} cardio={item.cardio} distanceUnit={distanceUnitFor(unit)} energyUnit={energyUnit} />
          ) : (
            <Card key={item.position} className="p-4">
              <p className="font-semibold mb-2">{item.sets[0].exerciseName}</p>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-zinc-500 text-left">
                    <th className="font-normal pb-1 w-12">Set</th>
                    <th className="font-normal pb-1">Reps</th>
                    <th className="font-normal pb-1">Weight</th>
                    <th className="font-normal pb-1 text-right">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {item.sets.map((x) => (
                    <tr key={x.setNumber} className="border-t border-zinc-800/80">
                      <td className="py-1.5 text-zinc-500">{x.setNumber}</td>
                      <td className="py-1.5">{x.reps}</td>
                      <td className="py-1.5">{formatWeight(unit, x.weightKg)}</td>
                      <td className="py-1.5 text-right text-zinc-500">
                        {x.targetReps != null ? `${x.targetReps}${x.targetWeightKg != null ? ` × ${formatWeight(unit, x.targetWeightKg)}` : ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ),
        )}
      </div>
      <Button variant="danger" className="mt-6" onClick={() => setConfirm(true)}>
        Delete workout
      </Button>
      <ConfirmModal
        open={confirm}
        title="Delete this workout?"
        message="It will be removed from your history and progress. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => del.mutate(s.id, { onSuccess: () => navigate('/history', { replace: true }) })}
      />
    </>
  )
}

function CardioEntry({
  cardio,
  distanceUnit,
  energyUnit,
}: {
  cardio: LoggedCardio
  distanceUnit: DistanceUnit
  energyUnit: EnergyUnit
}) {
  const estimate = useCardioEnergy(cardio, cardio.startedAt)
  const goal = cardio.targetDurationS
  return (
    <Card className="p-4">
      <p className="font-semibold">
        {cardio.exerciseName} <span className="text-xs font-medium text-zinc-500 ml-1">Cardio</span>
      </p>
      <p className="text-sm text-zinc-300 tabular-nums mt-1">{cardioSummary(cardio, distanceUnit)}</p>
      {goal != null && (
        <p className="text-xs text-zinc-500 mt-0.5">
          Goal {formatGoal(goal)}
          {cardio.durationS >= goal ? ' · reached ✓' : ''}
        </p>
      )}
      {estimate?.ok && (
        <p className="text-xs text-zinc-500 mt-1">
          ≈ {formatEstimate(energyUnit, estimate.estimate.kcal)} above resting{' '}
          <EstimateInfo label={`How ${cardio.exerciseName}'s energy is estimated`} title="Cardio energy" unit={energyUnit}>
            <CardioInfoText cardio={estimate.estimate} unit={energyUnit} distanceUnit={distanceUnit} />
          </EstimateInfo>
        </p>
      )}
    </Card>
  )
}
