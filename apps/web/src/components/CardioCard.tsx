import { cardioName, type CardioSession } from '@setsmart/core'
import { Link } from 'react-router'
import { useEnergyUnit, useWeightUnit } from '../hooks/data'
import { distanceUnitFor, formatCardioDuration, formatDistance, formatPace } from '../lib/cardio'
import { formatEstimate, useCardioEnergy } from '../lib/energy'
import { formatDate } from '../lib/format'
import { CardioInfoText, EstimateInfo } from './energy/EstimateInfo'
import { Card } from './ui'

// Same stretched-link layout as SessionCard, so the info button isn't inside the link.
export function CardioCard({ session }: { session: CardioSession }) {
  const energyUnit = useEnergyUnit()
  const distanceUnit = distanceUnitFor(useWeightUnit())
  const estimate = useCardioEnergy(session)
  const pace = formatPace(session, distanceUnit)
  return (
    <Card className="relative p-4 flex items-center gap-4 hover:border-zinc-700">
      <div className="w-12 shrink-0 text-center">
        <p className="text-[11px] uppercase text-zinc-500">{formatDate(session.startedAt, { month: 'short' })}</p>
        <p className="text-xl font-black leading-none">{formatDate(session.startedAt, { day: 'numeric' })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/history/cardio/${session.id}`}
          className="block font-semibold truncate after:absolute after:inset-0 after:rounded-[inherit]"
        >
          {cardioName(session)} <span className="text-xs font-medium text-zinc-500 ml-1">Cardio</span>
        </Link>
        <p className="text-sm text-zinc-500">
          {formatCardioDuration(session.durationS)}
          {session.distanceM != null && ` · ${formatDistance(session.activity, distanceUnit, session.distanceM)}`}
          {pace && ` · ${pace}`}
          {estimate?.ok && (
            <>
              {' · '}
              <span className="whitespace-nowrap">
                ≈ {formatEstimate(energyUnit, estimate.estimate.kcal)}{' '}
                <EstimateInfo label="How this session's energy is estimated" title="Cardio energy" unit={energyUnit}>
                  <CardioInfoText cardio={estimate.estimate} unit={energyUnit} distanceUnit={distanceUnit} />
                </EstimateInfo>
              </span>
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
