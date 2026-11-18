import { CARDIO_ACTIVITIES, cardioMet, cardioName } from '@setsmart/core'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CardioInfoText, EstimateInfo } from '../components/energy/EstimateInfo'
import { Button, Card, ConfirmModal, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useCardioSession, useDeleteCardio, useEnergyUnit, useWeightUnit } from '../hooks/data'
import { distanceUnitFor, formatCardioDuration, formatDistance, formatPace } from '../lib/cardio'
import { describeMissing, formatEstimate, useCardioEnergy } from '../lib/energy'
import { formatDate, formatTime } from '../lib/format'

export function CardioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useCardioSession(id)
  const del = useDeleteCardio()
  const [confirm, setConfirm] = useState(false)
  const energyUnit = useEnergyUnit()
  const distanceUnit = distanceUnitFor(useWeightUnit())
  const estimate = useCardioEnergy(session.data)

  if (session.isPending) return <LoadingBlock />
  if (session.error) return <ErrorText error={session.error} />
  const s = session.data
  const pace = formatPace(s, distanceUnit)
  const met = cardioMet(s)
  const effortLabel = met?.source.kind === 'effort' && !met.source.defaulted ? met.source.row.label : null

  const stats: Array<[string, string]> = [['Duration', formatCardioDuration(s.durationS)]]
  if (s.distanceM != null) stats.push(['Distance', formatDistance(s.activity, distanceUnit, s.distanceM)])
  if (pace) stats.push([s.activity === 'cycle' || s.activity === 'indoor_cycle' ? 'Avg speed' : 'Avg pace', pace])
  if (effortLabel && stats.length < 3) stats.push(['Effort', effortLabel])

  return (
    <>
      <Link to="/history" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← History
      </Link>
      <div className="mt-3">
        <PageHeader
          title={cardioName(s)}
          subtitle={`${s.activity === 'other' ? '' : `${CARDIO_ACTIVITIES[s.activity].label} · `}${formatDate(s.startedAt, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })} · ${formatTime(s.startedAt)}`}
          action={
            <Link to={`/history/cardio/${s.id}/edit`}>
              <Button tabIndex={-1}>Edit</Button>
            </Link>
          }
        />
      </div>
      <dl className={`grid gap-3 text-center mb-5 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {stats.map(([k, v]) => (
          <Card key={k} className="py-3 px-1">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="text-lg font-bold tabular-nums mt-0.5">{v}</dd>
          </Card>
        ))}
      </dl>
      <p className="text-xs text-zinc-500 -mt-2 mb-5">
        {estimate?.ok ? (
          <>
            Estimated energy burned: ≈ {formatEstimate(energyUnit, estimate.estimate.kcal)} above resting{' '}
            <EstimateInfo label="How this session's energy is estimated" title="Cardio energy" unit={energyUnit}>
              <CardioInfoText cardio={estimate.estimate} unit={energyUnit} distanceUnit={distanceUnit} />
            </EstimateInfo>
            <br />
            This is an estimate from your body details and the session, not a measurement.
          </>
        ) : estimate && !estimate.ok ? (
          estimate.missing.length === 1 && estimate.missing[0] === 'met' ? (
            <>
              <Link to={`/history/cardio/${s.id}/edit`} className="text-accent">
                Add a MET value
              </Link>{' '}
              to see an estimate of the energy this burned.
            </>
          ) : (
            <>
              To see an estimate of the energy this burned,{' '}
              {describeMissing(estimate.missing.filter((m) => m !== 'met'))} (in{' '}
              <Link to="/settings" className="text-accent">
                Settings
              </Link>{' '}
              and{' '}
              <Link to="/progress" className="text-accent">
                Progress
              </Link>
              ).
            </>
          )
        ) : null}
      </p>
      {s.notes && <p className="text-sm text-zinc-300 italic mb-5">“{s.notes}”</p>}
      <Button variant="danger" className="mt-2" onClick={() => setConfirm(true)}>
        Delete session
      </Button>
      <ConfirmModal
        open={confirm}
        title="Delete this session?"
        message="It will be removed from your history and energy estimates. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => del.mutate(s.id, { onSuccess: () => navigate('/history', { replace: true }) })}
      />
    </>
  )
}
