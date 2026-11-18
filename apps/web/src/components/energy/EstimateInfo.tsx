import {
  DAILY_ACTIVITY_PAL,
  MAX_WORKOUT_MINUTES,
  WORKOUT_MET,
  type DailyActivity,
  type DayEnergyEstimate,
  type EnergyUnit,
  type RestingEstimate,
  type BodyStats,
  type CardioEnergyEstimate,
  type WorkoutEnergyEstimate,
  type WorkoutEffort,
} from '@setsmart/core'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { formatSpeed, type DistanceUnit } from '../../lib/cardio'
import { formatEstimate } from '../../lib/energy'
import { InfoIcon } from '../icons'
import { Modal } from '../ui'
import { EstimatesInfoModal } from './EstimatesInfoModal'

const n = (x: number, digits = 0) => x.toLocaleString(undefined, { maximumFractionDigits: digits })

/** "1,780 kcal", or "1,780 kcal (≈ 7,450 kJ)" for kJ users, since the formulas are in kcal. */
function Kcal({ kcal, unit }: { kcal: number; unit: EnergyUnit }) {
  return (
    <strong className="text-zinc-100 whitespace-nowrap">
      ≈ {formatEstimate('kcal', kcal)}
      {unit === 'kj' && ` (≈ ${formatEstimate('kj', kcal)})`}
    </strong>
  )
}

const Formula = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 overflow-x-auto">
    {children}
  </p>
)

const EFFORT_LABEL: Record<WorkoutEffort, string> = {
  moderate: 'moderate',
  vigorous: 'vigorous',
}
const ACTIVITY_LABEL: Record<DailyActivity, string> = {
  sitting: 'mostly sitting',
  mixed: 'mix of sitting and moving',
  active: 'on your feet most of the day',
}

/**
 * A small ⓘ button placed next to an estimate. Tapping it opens a short explanation
 * of how that number was worked out, with a link to the full method and sources.
 * Keep it outside any <a>, so taps don't also follow the link (see the stretched-link cards).
 */
export function EstimateInfo({
  label,
  title,
  unit,
  estimate,
  children,
}: {
  /** Accessible name, e.g. "How resting energy is estimated" */
  label: string
  title: string
  unit: EnergyUnit
  /** Passed through to the full explanation so it can show the user's numbers */
  estimate?: DayEnergyEstimate | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="relative z-10 inline-flex items-center justify-center size-8 -m-2 align-middle rounded-full text-zinc-500 hover:text-accent focus-visible:text-accent"
      >
        <InfoIcon className="size-4" />
      </button>
      {/* Portalled so the sheet's <div>s never end up inside the <p> or <td> holding the button. */}
      {createPortal(
        <>
          <Modal open={open} onClose={() => setOpen(false)} title={title}>
            <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
              {children}
              <p className="text-xs text-zinc-500">
                This is an estimate from published equations, not a measurement. Your real number may be 10% or more
                higher or lower.
              </p>
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => {
                  setOpen(false)
                  setFull(true)
                }}
              >
                Full method and sources →
              </button>
            </div>
          </Modal>
          <EstimatesInfoModal open={full} onClose={() => setFull(false)} estimate={estimate} unit={unit} />
        </>,
        document.body,
      )}
    </>
  )
}

// ---- Brief explanations ----------------------------------------------------------

export function RestingInfoText({
  resting,
  stats,
  unit,
}: {
  resting: RestingEstimate
  stats: BodyStats
  unit: EnergyUnit
}) {
  if (resting.method === 'cunningham') {
    return (
      <>
        <p>
          The energy your body uses at rest. Worked out with the Cunningham equation from your fat-free mass: your
          weight minus fat, using your body fat reading of {n(stats.bodyFatPct ?? 0, 1)}%.
        </p>
        <Formula>
          {n(stats.weightKg, 1)} kg × (1 − {n(stats.bodyFatPct ?? 0, 1)}%) = {n(resting.fatFreeMassKg ?? 0, 1)} kg
          fat-free
          <br />
          500 + 22 × {n(resting.fatFreeMassKg ?? 0, 1)} = {n(resting.kcalPerDay)} kcal/day
        </Formula>
        <p>
          Resting energy: <Kcal kcal={resting.kcalPerDay} unit={unit} /> a day.
        </p>
      </>
    )
  }
  const constant = stats.sex === 'male' ? '+ 5' : stats.sex === 'female' ? '− 161' : '− 78'
  return (
    <>
      <p>
        The energy your body uses at rest. Worked out with the Mifflin-St Jeor equation from your weight, height and age
        {resting.method === 'mifflin-average' &&
          ", using the average of the male and female versions because sex isn't set"}
        . Log a body fat % on Progress to base it on your fat-free mass instead.
      </p>
      <Formula>
        10 × {n(stats.weightKg, 1)} kg + 6.25 × {n(stats.heightCm ?? 0, 1)} cm − 5 × {stats.age} yrs {constant}
        <br />= {n(resting.kcalPerDay)} kcal/day
      </Formula>
      <p>
        Resting energy: <Kcal kcal={resting.kcalPerDay} unit={unit} /> a day.
      </p>
    </>
  )
}

export function EverydayInfoText({
  estimate,
  activity,
  unit,
}: {
  estimate: DayEnergyEstimate
  activity: DailyActivity | null
  unit: EnergyUnit
}) {
  return (
    <>
      <p>
        Walking, standing, chores and digesting food, but not logged workouts. Worked out from your resting energy and
        an activity level of {estimate.pal} ({ACTIVITY_LABEL[activity ?? 'sitting']}
        {estimate.activityAssumed && ', assumed until you choose one'}).
      </p>
      <Formula>
        {n(estimate.restingKcal)} kcal × ({estimate.pal} − 1) = {n(estimate.everydayKcal)} kcal
      </Formula>
      <p>
        Everyday activity: <Kcal kcal={estimate.everydayKcal} unit={unit} />.{' '}
        <Link to="/settings" className="text-accent">
          Change your activity level
        </Link>
        . The levels are {DAILY_ACTIVITY_PAL.sitting}, {DAILY_ACTIVITY_PAL.mixed} and {DAILY_ACTIVITY_PAL.active}.
      </p>
    </>
  )
}

export function WorkoutsDayInfoText({
  estimate,
  effort,
  unit,
}: {
  estimate: DayEnergyEstimate
  effort: WorkoutEffort
  unit: EnergyUnit
}) {
  return (
    <>
      <p>
        Each workout logged on this day counts {WORKOUT_MET[effort]} METs for {EFFORT_LABEL[effort]} weight training
        (2024 Compendium of Physical Activities) for its length, minus any timed cardio, at your weight of{' '}
        {n(estimate.stats.weightKg, 1)} kg. Workouts that were only cardio don't count here. Only the energy above
        resting counts, because resting is already in the total.
      </p>
      <Formula>(MET × 3.5 × kg ÷ 200 − resting kcal per min) × minutes</Formula>
      <p>
        Weight training: <Kcal kcal={estimate.workoutKcal} unit={unit} />. Change workout effort in{' '}
        <Link to="/settings" className="text-accent">
          Settings
        </Link>
        .
      </p>
    </>
  )
}

export function TotalInfoText({ estimate, unit }: { estimate: DayEnergyEstimate; unit: EnergyUnit }) {
  return (
    <>
      <p>Your estimated burn for the whole day is four estimates added together.</p>
      <Formula>
        resting {n(estimate.restingKcal)} + everyday {n(estimate.everydayKcal)} + weight training{' '}
        {n(estimate.workoutKcal)} + cardio {n(estimate.cardioKcal)}
        <br />= {n(estimate.totalKcal)} kcal
      </Formula>
      <p>
        Total: <Kcal kcal={estimate.totalKcal} unit={unit} />. The ± figure is 10%, because these equations are usually
        within about 10% for most people. For some people they're further off.
      </p>
    </>
  )
}

/** A workout's weight training and cardio. `cardioNames` lines up with `workout.cardio`. */
export function WorkoutInfoText({
  workout,
  unit,
  cardioNames = [],
}: {
  workout: WorkoutEnergyEstimate
  unit: EnergyUnit
  cardioNames?: string[]
}) {
  const gross = workout.met * (3.5 / 200) * workout.weightKg
  const rest = workout.resting.kcalPerDay / 1440
  const hasCardio = workout.cardio.length > 0
  return (
    <>
      {workout.minutes > 0 && (
        <>
          <p>
            Weight training uses {workout.met} METs for {EFFORT_LABEL[workout.effort]} weight training (2024 Compendium
            of Physical Activities), your weight of {n(workout.weightKg, 1)} kg and the workout's length
            {hasCardio && ', minus the time you spent on cardio'}. Resting energy is subtracted because it's counted
            separately.
          </p>
          <Formula>
            ({workout.met} × 3.5 × {n(workout.weightKg, 1)} ÷ 200 − {n(rest, 2)} resting) × {n(workout.minutes)} min
            <br />= ({n(gross, 2)} − {n(rest, 2)}) × {n(workout.minutes)} = {n(workout.weightsKcal)} kcal
          </Formula>
          {workout.capped && (
            <p>
              The weight training ran longer than {MAX_WORKOUT_MINUTES / 60} hours, so only {MAX_WORKOUT_MINUTES / 60} hours
              are counted.
            </p>
          )}
        </>
      )}
      {hasCardio && (
        <>
          <p>
            Each cardio exercise gets a MET value from the 2024 Compendium, from your speed when you added a distance or
            pace, otherwise from the effort you chose. Tap the ⓘ next to it on the workout's page for the details.
          </p>
          <ul className="list-disc pl-5">
            {workout.cardio.map((c, i) => (
              <li key={i}>
                {cardioNames[i] ?? 'Cardio'}:{' '}
                {c ? (
                  <>
                    {c.met} METs for {n(c.minutes, 1)} min, <Kcal kcal={c.kcal} unit={unit} />
                  </>
                ) : (
                  'no MET value, so not counted'
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        This workout: <Kcal kcal={workout.kcal} unit={unit} /> above resting.
      </p>
    </>
  )
}

export function CardioDayInfoText({ estimate, unit }: { estimate: DayEnergyEstimate; unit: EnergyUnit }) {
  return (
    <>
      <p>
        Each cardio exercise done in a workout on this day gets a MET value from the 2024 Compendium of Physical
        Activities. For runs, walks and outdoor rides with a distance or pace, the value comes from your average speed.
        Otherwise it comes from the effort you chose. It's counted for the time on your timer, and only the energy above
        resting counts.
      </p>
      <Formula>(MET × 3.5 × kg ÷ 200 − resting kcal per min) × minutes</Formula>
      <p>
        Cardio: <Kcal kcal={estimate.cardioKcal} unit={unit} />. Tap a workout in{' '}
        <Link to="/history" className="text-accent">
          History
        </Link>{' '}
        to see how its estimate was worked out.
      </p>
    </>
  )
}

/** Why a piece of cardio got its MET value, then the sum. */
export function CardioInfoText({
  cardio,
  unit,
  distanceUnit,
}: {
  cardio: CardioEnergyEstimate
  unit: EnergyUnit
  distanceUnit: DistanceUnit
}) {
  const gross = cardio.met * (3.5 / 200) * cardio.weightKg
  const rest = cardio.resting.kcalPerDay / 1440
  const src = cardio.source
  return (
    <>
      {src.kind === 'speed' && (
        <p>
          Your average speed was {formatSpeed(src.speedKmh, distanceUnit)}. The closest row in the 2024 Compendium of
          Physical Activities is “{src.row.description}” (code {src.row.code}), which is {cardio.met} METs.
        </p>
      )}
      {src.kind === 'effort' && (
        <p>
          {src.defaulted ? 'No effort was chosen, so the middle option is used: ' : `You chose “${src.row.label}”, which matches `}
          “{src.row.description}” in the 2024 Compendium of Physical Activities (code {src.row.code}), which is{' '}
          {cardio.met} METs.
        </p>
      )}
      {src.kind === 'custom' && <p>You entered {cardio.met} METs for this exercise.</p>}
      <Formula>
        ({cardio.met} × 3.5 × {n(cardio.weightKg, 1)} ÷ 200 − {n(rest, 2)} resting) × {n(cardio.minutes, 1)} min
        <br />= ({n(gross, 2)} − {n(rest, 2)}) × {n(cardio.minutes, 1)} = {n(cardio.kcal)} kcal
      </Formula>
      <p>
        This exercise: <Kcal kcal={cardio.kcal} unit={unit} /> above resting. Hills, wind, heat and your fitness change
        the real number, and they aren't counted.
      </p>
    </>
  )
}
