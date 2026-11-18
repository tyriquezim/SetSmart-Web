import {
  CARDIO_ACTIVITIES,
  canPostpone,
  cardioElapsedMs,
  currentExercise,
  formatDuration,
  type CardioEffort,
  type WorkoutAction,
  type WorkoutState,
} from '@setsmart/core'
import { useState } from 'react'
import { useEnergyUnit } from '../hooks/data'
import { useNow } from '../hooks/useNow'
import {
  distanceFromPace,
  distanceToM,
  formatDistance,
  formatGoal,
  formatPace,
  paceSpec,
  usesMetres,
  type DistanceUnit,
} from '../lib/cardio'
import { describeMissing, formatEstimate, useCardioEnergy } from '../lib/energy'
import { unlockAudio } from '../workout/alarm'
import { CardioInfoText, EstimateInfo } from './energy/EstimateInfo'
import { PlayIcon, SkipIcon } from './icons'
import { Button, Card, ConfirmModal, NumberInput, Segmented } from './ui'

type Dispatch = (a: WorkoutAction) => void

// ---------------------------------------------------------------------------
// Before the timer starts
// ---------------------------------------------------------------------------

/** The current exercise is cardio: show its goal and a Start button. */
export function CardioStartScreen({ workout, dispatch }: { workout: WorkoutState; dispatch: Dispatch }) {
  const { exercise } = currentExercise(workout)!
  const goal = exercise.cardio?.targetDurationS ?? null
  const postponable = canPostpone(workout)
  const nextName = postponable ? workout.exercises[workout.queue[1]].name : null

  return (
    <section aria-label="Cardio" className="space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold">Cardio</p>
        <h2 className="text-3xl font-black tracking-tight mt-1 leading-tight">{exercise.name}</h2>
        <p className="text-sm text-zinc-400 mt-1">{goal != null ? `Goal: ${formatGoal(goal)}` : 'No goal set'}</p>

        <Button
          variant="primary"
          size="xl"
          className="w-full mt-6"
          onClick={() => {
            unlockAudio()
            dispatch({ type: 'startCardio', now: Date.now() })
          }}
        >
          <PlayIcon className="size-6" /> Start
        </Button>
        <p className="text-xs text-zinc-500 mt-3">
          The timer keeps counting if you switch apps or lock your phone.
          {goal != null && " You'll get an alert when you reach your goal."} When you end it, you can add your distance or
          pace.
        </p>
      </Card>

      <div className="grid gap-2">
        {postponable && (
          <Button size="lg" onClick={() => dispatch({ type: 'postpone', to: 'next' })}>
            <SkipIcon className="size-4" /> Not now? Do {nextName} first
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={() => dispatch({ type: 'skipExercise', now: Date.now() })}>
          Skip this exercise
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Timer running or paused
// ---------------------------------------------------------------------------

export function CardioTimerScreen({ workout, dispatch }: { workout: WorkoutState; dispatch: Dispatch }) {
  const now = useNow(250)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  if (workout.phase.kind !== 'cardio') return null
  const phase = workout.phase
  const exercise = workout.exercises[phase.exerciseIndex]
  const goalMs = (exercise.cardio?.targetDurationS ?? 0) * 1000
  const elapsed = cardioElapsedMs(workout, now)
  const running = phase.runningSince != null
  const reached = goalMs > 0 && elapsed >= goalMs
  const fraction = goalMs > 0 ? Math.min(1, elapsed / goalMs) : 0
  const R = 88
  const C = 2 * Math.PI * R

  return (
    <section aria-label="Cardio timer" className="space-y-4">
      <Card className="p-6 flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">{exercise.name}</p>
        <div className="relative size-56 my-4">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-zinc-800" />
            {goalMs > 0 && (
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fraction)}
                className={reached ? 'text-amber-400' : 'text-accent'}
                style={{ transition: 'stroke-dashoffset 250ms linear' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black tabular-nums" aria-live="off">
              {formatDuration(Math.floor(elapsed / 1000))}
            </span>
            <span className="text-sm text-zinc-400 mt-1">
              {!running ? 'Paused' : reached ? 'Goal reached!' : goalMs > 0 ? `Goal ${formatGoal(goalMs / 1000)}` : 'No goal'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full">
          {running ? (
            <Button size="xl" onClick={() => dispatch({ type: 'pauseCardio', now: Date.now() })}>
              Pause
            </Button>
          ) : (
            <Button
              size="xl"
              onClick={() => {
                unlockAudio()
                dispatch({ type: 'resumeCardio', now: Date.now() })
              }}
            >
              Resume
            </Button>
          )}
          <Button size="xl" variant="primary" onClick={() => dispatch({ type: 'endCardio', now: Date.now() })}>
            End
          </Button>
        </div>
      </Card>
      <Button variant="ghost" className="w-full" onClick={() => setConfirmDiscard(true)}>
        Discard timer
      </Button>
      <ConfirmModal
        open={confirmDiscard}
        title="Discard this timer?"
        message={`The time for ${exercise.name} won't be saved. You can start it again.`}
        confirmLabel="Discard"
        danger
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          dispatch({ type: 'cancelCardio' })
          setConfirmDiscard(false)
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// After the timer ends: add distance or pace, then save
// ---------------------------------------------------------------------------

export function CardioLogScreen({
  workout,
  dispatch,
  distanceUnit,
}: {
  workout: WorkoutState
  dispatch: Dispatch
  distanceUnit: DistanceUnit
}) {
  if (workout.phase.kind !== 'cardio' || workout.phase.endedAt == null) return null
  // Re-mount for each exercise so the form starts from that timer.
  return (
    <CardioLogForm
      key={`${workout.phase.exerciseIndex}:${workout.phase.endedAt}`}
      workout={workout}
      dispatch={dispatch}
      distanceUnit={distanceUnit}
    />
  )
}

type Mode = 'distance' | 'pace'

function CardioLogForm({ workout, dispatch, distanceUnit }: { workout: WorkoutState; dispatch: Dispatch; distanceUnit: DistanceUnit }) {
  const phase = workout.phase as Extract<WorkoutState['phase'], { kind: 'cardio' }>
  const exercise = workout.exercises[phase.exerciseIndex]
  const plan = exercise.cardio!
  const info = CARDIO_ACTIVITIES[plan.activity]
  const metres = usesMetres(plan.activity)
  const spec = paceSpec(plan.activity, distanceUnit)
  const energyUnit = useEnergyUnit()

  const timedS = Math.max(1, Math.round(phase.accumulatedMs / 1000))
  const [hours, setHours] = useState<number | null>(Math.floor(timedS / 3600) || null)
  const [minutes, setMinutes] = useState<number | null>(Math.floor((timedS % 3600) / 60) || null)
  const [seconds, setSeconds] = useState<number | null>(timedS % 60 || null)
  const [mode, setMode] = useState<Mode>('distance')
  const [distance, setDistance] = useState<number | null>(null)
  const [paceMin, setPaceMin] = useState<number | null>(null)
  const [paceSec, setPaceSec] = useState<number | null>(null)
  const [speed, setSpeed] = useState<number | null>(null)
  const [effort, setEffort] = useState<CardioEffort | null>(null)

  const durationS = (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  const durationOk = durationS >= 1 && durationS <= 86_400
  const paceValue = spec.kind === 'pace' ? (paceMin ?? 0) * 60 + (paceSec ?? 0) : (speed ?? 0)
  const distanceM = !info.hasDistance
    ? null
    : mode === 'distance'
      ? distance != null && distance > 0
        ? metres
          ? distance
          : distanceToM(distanceUnit, distance)
        : null
      : distanceFromPace(spec, durationS, paceValue)
  const distanceOk = distanceM == null || distanceM < 1_000_000
  const speedSetsMet = info.speeds != null && distanceM != null
  const chosenEffort = info.efforts.some((o) => o.effort === effort) ? effort : null
  const valid = durationOk && distanceOk

  const draft = { activity: plan.activity, durationS, distanceM, effort: chosenEffort, met: plan.met }
  const estimate = useCardioEnergy(durationOk ? draft : undefined, new Date(phase.startedAt).toISOString())
  const derived =
    distanceM == null || !durationOk
      ? null
      : mode === 'distance'
        ? formatPace(draft, distanceUnit) && `Average ${formatPace(draft, distanceUnit)}`
        : `Distance ≈ ${formatDistance(plan.activity, distanceUnit, distanceM)}`
  const distanceLabel = metres ? 'm' : distanceUnit

  return (
    <section aria-label="Log cardio" className="space-y-4">
      <Card className="p-5 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-semibold">Done</p>
          <h2 className="text-2xl font-black tracking-tight mt-1 leading-tight">{exercise.name}</h2>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-zinc-300 mb-1.5">Time</legend>
          <div className="flex gap-2">
            {(
              [
                ['h', 'Hours', hours, setHours, 24],
                ['min', 'Minutes', minutes, setMinutes, 59],
                ['s', 'Seconds', seconds, setSeconds, 59],
              ] as const
            ).map(([suffix, label, value, set, max]) => (
              <div key={suffix} className="relative flex-1">
                <NumberInput
                  aria-label={`Time, ${label.toLowerCase()}`}
                  allowEmpty
                  decimals={false}
                  min={0}
                  max={max}
                  value={value}
                  onChange={set}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{suffix}</span>
              </div>
            ))}
          </div>
          <p className={`text-xs mt-1.5 ${durationOk ? 'text-zinc-500' : 'text-red-300'}`}>
            {durationOk ? 'From your timer. Fix it if you forgot to stop it.' : 'Enter a time between 1 second and 24 hours.'}
          </p>
        </fieldset>

        {info.hasDistance && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-300">Add one (optional)</p>
              <Segmented<Mode>
                label="Distance or pace"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'distance', label: 'Distance' },
                  { value: 'pace', label: spec.kind === 'speed' ? 'Speed' : 'Pace' },
                ]}
              />
            </div>
            {mode === 'distance' ? (
              <div className="relative">
                <NumberInput
                  aria-label={`Distance in ${distanceLabel === 'm' ? 'metres' : distanceLabel}`}
                  allowEmpty
                  min={0}
                  decimals={!metres}
                  value={distance}
                  onChange={setDistance}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{distanceLabel}</span>
              </div>
            ) : spec.kind === 'pace' ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <NumberInput aria-label="Pace, minutes" allowEmpty decimals={false} min={0} value={paceMin} onChange={setPaceMin} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">min</span>
                </div>
                <div className="relative flex-1">
                  <NumberInput aria-label="Pace, seconds" allowEmpty decimals={false} min={0} max={59} value={paceSec} onChange={setPaceSec} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">s</span>
                </div>
                <span className="text-sm text-zinc-500 shrink-0">{spec.label}</span>
              </div>
            ) : (
              <div className="relative">
                <NumberInput aria-label={`Average speed in ${spec.label}`} allowEmpty min={0} value={speed} onChange={setSpeed} className="pr-14" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{spec.label}</span>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              {derived ??
                (mode === 'distance'
                  ? `From your watch, app or the machine's display.${info.speeds ? ' Your speed is used for the energy estimate.' : ''}`
                  : `Your average ${spec.kind === 'speed' ? 'speed' : 'pace'}. The distance is worked out from it.`)}
            </p>
            {!distanceOk && <p className="text-xs text-red-300">That distance is too long.</p>}
          </div>
        )}

        {info.efforts.length > 1 && !speedSetsMet && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-zinc-300">How hard was it?</p>
            <Segmented<CardioEffort>
              label="How hard was it?"
              value={chosenEffort ?? ('' as CardioEffort)}
              onChange={setEffort}
              options={info.efforts.map((o) => ({ value: o.effort, label: o.label }))}
            />
            {!chosenEffort && <p className="text-xs text-zinc-500">If you don't choose, the middle option is used.</p>}
          </div>
        )}

        {durationOk && estimate && (
          <p className="text-sm">
            {estimate.ok ? (
              <span className="text-zinc-300">
                Estimated energy: <strong className="text-zinc-100">≈ {formatEstimate(energyUnit, estimate.estimate.kcal)}</strong> above resting{' '}
                <EstimateInfo label="How this cardio's energy is estimated" title="Cardio energy" unit={energyUnit}>
                  <CardioInfoText cardio={estimate.estimate} unit={energyUnit} distanceUnit={distanceUnit} />
                </EstimateInfo>
              </span>
            ) : (
              <span className="text-zinc-500">
                {estimate.missing.includes('met') && estimate.missing.length === 1
                  ? 'Add a MET value to this exercise to see an energy estimate.'
                  : `To see an energy estimate, ${describeMissing(estimate.missing.filter((m) => m !== 'met'))}.`}
              </span>
            )}
          </p>
        )}

        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={!valid}
          onClick={() => dispatch({ type: 'logCardio', durationS, distanceM, effort: chosenEffort, now: Date.now() })}
        >
          Save {exercise.name}
        </Button>
      </Card>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          unlockAudio()
          dispatch({ type: 'resumeCardio', now: Date.now() })
        }}
      >
        Ended too soon? Resume the timer
      </Button>
    </section>
  )
}
