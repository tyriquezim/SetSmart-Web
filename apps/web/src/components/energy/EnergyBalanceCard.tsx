import { estimateDayEnergy, KJ_PER_KCAL, roundEstimate, type CardioSession, type EnergyUnit, type WorkoutTimes } from '@setsmart/core'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useBodyWeights, useProfile } from '../../hooks/data'
import { describeMissing, formatEstimate } from '../../lib/energy'
import { energyLabel, energyNumber } from '../../lib/nutrition'
import { InfoIcon } from '../icons'
import { Card } from '../ui'
import { CardioDayInfoText, EstimateInfo, EverydayInfoText, RestingInfoText, TotalInfoText, WorkoutsDayInfoText } from './EstimateInfo'
import { EstimatesInfoModal } from './EstimatesInfoModal'

/** Uncertainty shown with the total: the resting equations are typically within about 10%. */
const UNCERTAINTY = 0.1

/**
 * Eaten vs estimated energy burned for one day, with the burn split into resting,
 * everyday activity and workouts. Always labelled as an estimate.
 */
export function EnergyBalanceCard({
  day,
  today,
  eatenKj,
  workouts,
  cardio,
  unit,
}: {
  day: string
  today: string
  eatenKj: number
  workouts: WorkoutTimes[]
  cardio: CardioSession[]
  unit: EnergyUnit
}) {
  const profile = useProfile()
  const weights = useBodyWeights()
  const [infoOpen, setInfoOpen] = useState(false)

  const result = useMemo(
    () =>
      profile.data && weights.data
        ? estimateDayEnergy({ day, profile: profile.data, weights: weights.data, workouts, cardio })
        : null,
    [day, profile.data, weights.data, workouts, cardio],
  )
  if (!result) return null

  const label = energyLabel(unit)
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Energy balance</p>
        <p className="text-xs text-zinc-500 mt-0.5">Burn figures are estimates, not measurements</p>
      </div>
      <button type="button" onClick={() => setInfoOpen(true)} className="flex items-center gap-1 text-sm text-accent shrink-0">
        <InfoIcon className="size-4" /> How it's worked out
      </button>
    </div>
  )

  if (!result.ok) {
    const needsWeight = result.missing.includes('weight')
    const needsProfile = result.missing.some((m) => m !== 'weight')
    return (
      <Card className="p-5 space-y-3">
        {header}
        <p className="text-sm text-zinc-300">
          To estimate how much energy you burn, {describeMissing(result.missing)}.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {needsProfile && (
            <Link to="/settings" className="text-accent">
              Add body details →
            </Link>
          )}
          {needsWeight && (
            <Link to="/progress" className="text-accent">
              Log your weight →
            </Link>
          )}
        </div>
        <EstimatesInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} unit={unit} />
      </Card>
    )
  }

  const e = result.estimate
  const eatenKcal = eatenKj / KJ_PER_KCAL
  const diff = eatenKcal - e.totalKcal
  const margin = e.totalKcal * UNCERTAINTY
  // Within the margin of error, the honest answer is "about even".
  const verdict =
    Math.abs(diff) <= margin * 0.5
      ? 'About even with your estimated burn'
      : diff < 0
        ? `About ${formatEstimate(unit, -diff)} less than your estimated burn`
        : `About ${formatEstimate(unit, diff)} more than your estimated burn`

  const p = profile.data!
  const rows: Array<{ name: string; kcal: number; note?: string; info: ReactNode }> = [
    {
      name: 'Resting (BMR)',
      kcal: e.restingKcal,
      info: (
        <EstimateInfo label="How resting energy is estimated" title="Resting energy (BMR)" unit={unit} estimate={e}>
          <RestingInfoText resting={e.resting} stats={e.stats} unit={unit} />
        </EstimateInfo>
      ),
    },
    {
      name: 'Everyday activity',
      kcal: e.everydayKcal,
      note: e.activityAssumed ? 'assumed mostly sitting' : undefined,
      info: (
        <EstimateInfo label="How everyday activity is estimated" title="Everyday activity" unit={unit} estimate={e}>
          <EverydayInfoText estimate={e} activity={p.dailyActivity} unit={unit} />
        </EstimateInfo>
      ),
    },
    {
      name: 'Workouts',
      kcal: e.workoutKcal,
      info: (
        <EstimateInfo label="How workout energy is estimated" title="Workouts" unit={unit} estimate={e}>
          <WorkoutsDayInfoText estimate={e} effort={p.workoutEffort} unit={unit} />
        </EstimateInfo>
      ),
    },
    {
      name: 'Cardio',
      kcal: e.cardioKcal,
      info: (
        <EstimateInfo label="How cardio energy is estimated" title="Cardio" unit={unit} estimate={e}>
          <CardioDayInfoText estimate={e} unit={unit} />
        </EstimateInfo>
      ),
    },
  ]

  return (
    <Card className="p-5 space-y-4">
      {header}

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-zinc-500">Eaten</dt>
          <dd className="text-2xl font-black tabular-nums">
            {energyNumber(unit, eatenKj)}
            <span className="text-sm font-medium text-zinc-400 ml-1">{label}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">
            Burned (estimate){' '}
            <EstimateInfo label="How the total burn is estimated" title="Estimated burn" unit={unit} estimate={e}>
              <TotalInfoText estimate={e} unit={unit} />
            </EstimateInfo>
          </dt>
          <dd className="text-2xl font-black tabular-nums">
            ≈ {roundEstimate(e.totalKcal, unit).toLocaleString()}
            <span className="text-sm font-medium text-zinc-400 ml-1">{label}</span>
          </dd>
          <dd className="text-xs text-zinc-500 tabular-nums">± {formatEstimate(unit, margin)} or more</dd>
        </div>
      </dl>

      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Estimated energy burned, by part</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-zinc-800/80">
              <th scope="row" className="py-1.5 text-left font-normal text-zinc-400">
                {r.name}
                {r.note && (
                  <Link to="/settings" className="ml-1.5 text-xs text-accent">
                    ({r.note})
                  </Link>
                )}
              </th>
              <td className="py-1.5 text-right text-zinc-300 whitespace-nowrap">
                ≈ {formatEstimate(unit, r.kcal)}
                <span className="ml-1.5">{r.info}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1">
        <p className="text-sm font-semibold">{verdict}</p>
        {day === today && <p className="text-xs text-zinc-500">The burn is for the whole day, so it assumes the rest of today goes as usual.</p>}
      </div>

      <EstimatesInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} estimate={e} unit={unit} />
    </Card>
  )
}
