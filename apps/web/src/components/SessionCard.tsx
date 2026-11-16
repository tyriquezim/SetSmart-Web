import { formatWeight, type WeightUnit, type WorkoutSessionSummary } from '@setsmart/core'
import { Link } from 'react-router'
import { useEnergyUnit } from '../hooks/data'
import { formatEstimate, useWorkoutEnergy } from '../lib/energy'
import { formatDate, minutesBetween } from '../lib/format'
import { EstimateInfo, WorkoutInfoText } from './energy/EstimateInfo'
import { Card } from './ui'

// The whole card is clickable through a "stretched" link (its ::after covers the
// card), so the estimate's info button can sit on top without being inside the <a>.
export function SessionCard({ session, unit }: { session: WorkoutSessionSummary; unit: WeightUnit }) {
  const energyUnit = useEnergyUnit()
  const estimate = useWorkoutEnergy(session)
  return (
    <Card className="relative p-4 flex items-center gap-4 hover:border-zinc-700">
      <div className="w-12 shrink-0 text-center">
        <p className="text-[11px] uppercase text-zinc-500">{formatDate(session.startedAt, { month: 'short' })}</p>
        <p className="text-xl font-black leading-none">{formatDate(session.startedAt, { day: 'numeric' })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/history/${session.id}`} className="block font-semibold truncate after:absolute after:inset-0 after:rounded-[inherit]">
          {session.name}
        </Link>
        <p className="text-sm text-zinc-500">
          {minutesBetween(session.startedAt, session.finishedAt)} min · {session.setCount} sets ·{' '}
          {formatWeight(unit, session.volumeKg)}
          {estimate != null && (
            <>
              {' · '}
              <span className="whitespace-nowrap">
                ≈ {formatEstimate(energyUnit, estimate.kcal)}{' '}
                <EstimateInfo label="How this workout's energy is estimated" title="Workout energy" unit={energyUnit}>
                  <WorkoutInfoText workout={estimate} unit={energyUnit} />
                </EstimateInfo>
              </span>
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
