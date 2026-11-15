import {
  canPostpone,
  currentSet,
  formatDuration,
  formatWeight,
  logWorkout,
  restRemainingMs,
  toKg,
  toLogPayload,
  weightInputValue,
  weightStep,
  workoutPRs,
  workoutTotals,
  type CurrentSetInfo,
  type WeightUnit,
  type WorkoutAction,
  type WorkoutState,
} from '@gymbro/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckIcon, SkipIcon, TrophyIcon } from '../components/icons'
import { Button, Card, ConfirmModal, EmptyState, ErrorText, Input, Modal, NumberInput, Stepper } from '../components/ui'
import { keys, useWeightUnit } from '../hooks/data'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { supabase } from '../lib/supabase'
import { unlockAudio } from '../workout/alarm'
import { useActiveWorkout } from '../workout/context'

export function WorkoutPage() {
  const { workout, dispatch, discard } = useActiveWorkout()
  const unit = useWeightUnit()
  const [ending, setEnding] = useState(false)
  useWakeLock(workout != null && workout.phase.kind !== 'complete')

  if (!workout) {
    return (
      <EmptyState title="No workout in progress">
        <p>Pick a routine and hit Start.</p>
        <Link to="/routines">
          <Button variant="primary" tabIndex={-1}>Go to routines</Button>
        </Link>
      </EmptyState>
    )
  }

  const totals = workoutTotals(workout)
  const progress = totals.setsPlanned ? totals.setsLogged / totals.setsPlanned : 0

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-100">
            ← Home
          </Link>
          {workout.phase.kind !== 'complete' && (
            <Button size="sm" variant="ghost" onClick={() => setEnding(true)}>
              End workout
            </Button>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-2">
          <h1 className="text-xl font-bold truncate">{workout.name}</h1>
          <ElapsedTime workout={workout} />
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 mt-3 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Workout progress">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          {totals.setsLogged} / {totals.setsPlanned} sets · {totals.exercisesDone} / {workout.exercises.length} exercises
        </p>
      </header>

      {workout.phase.kind === 'set' && <SetScreen workout={workout} unit={unit} dispatch={dispatch} />}
      {workout.phase.kind === 'rest' && <RestScreen workout={workout} unit={unit} dispatch={dispatch} />}
      {workout.phase.kind === 'complete' && <SummaryScreen workout={workout} unit={unit} dispatch={dispatch} discard={discard} />}

      {workout.phase.kind !== 'complete' && <Queue workout={workout} unit={unit} dispatch={dispatch} />}

      <Modal
        open={ending}
        onClose={() => setEnding(false)}
        title="End workout?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnding(false)}>
              Keep going
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'finish', now: Date.now() })
                setEnding(false)
              }}
            >
              Finish now
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300">
          You've logged {totals.setsLogged} of {totals.setsPlanned} sets. Finishing now takes you to the summary, where
          you can save what you've done so far.
        </p>
      </Modal>
    </div>
  )
}

function ElapsedTime({ workout }: { workout: WorkoutState }) {
  const now = useNow(1000, workout.finishedAt == null)
  const end = workout.finishedAt ? Date.parse(workout.finishedAt) : now
  return (
    <span className="text-sm text-zinc-400 tabular-nums shrink-0">
      {formatDuration((end - Date.parse(workout.startedAt)) / 1000)}
    </span>
  )
}

function targetLabel(cur: CurrentSetInfo, unit: WeightUnit): string {
  const w = cur.target.weightKg != null ? ` @ ${formatWeight(unit, cur.target.weightKg)}` : ''
  return `${cur.target.reps} reps${w}`
}

// ---------------------------------------------------------------------------
// Set screen
// ---------------------------------------------------------------------------

function SetScreen({ workout, unit, dispatch }: { workout: WorkoutState; unit: WeightUnit; dispatch: (a: WorkoutAction) => void }) {
  const cur = currentSet(workout)!
  // Re-mount per set so inputs reset to that set's prefill.
  return <SetForm key={`${cur.exerciseIndex}:${cur.setNumber}`} cur={cur} workout={workout} unit={unit} dispatch={dispatch} />
}

function SetForm({
  cur,
  workout,
  unit,
  dispatch,
}: {
  cur: CurrentSetInfo
  workout: WorkoutState
  unit: WeightUnit
  dispatch: (a: WorkoutAction) => void
}) {
  // Prefill weight from, in order: your previous set today (you may have adjusted it),
  // the routine's target, then what you lifted last time. Reps use the target.
  const [reps, setReps] = useState<number | null>(cur.target.reps)
  const [weight, setWeight] = useState<number | null>(
    weightInputValue(unit, cur.previous?.weightKg ?? cur.target.weightKg ?? cur.lastTime?.weightKg ?? null),
  )
  const [moreOpen, setMoreOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const postponable = canPostpone(workout)
  const nextName = postponable ? workout.exercises[workout.queue[1]].name : null

  return (
    <section aria-label="Current set" className="space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold">
          Set {cur.setNumber} of {cur.totalSets}
        </p>
        <h2 className="text-3xl font-black tracking-tight mt-1 leading-tight">{cur.exercise.name}</h2>
        <p className="text-sm text-zinc-400 mt-1">Target: {targetLabel(cur, unit)}</p>
        {cur.lastTime && (
          <p className="text-sm text-zinc-500">
            Last time: {cur.lastTime.reps} × {formatWeight(unit, cur.lastTime.weightKg)}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Stepper label="Reps" value={reps} onChange={setReps} step={1} decimals={false} />
          <Stepper label="Weight" suffix={unit} value={weight} onChange={setWeight} step={weightStep(unit)} allowEmpty />
        </div>

        <Button
          variant="primary"
          size="xl"
          className="w-full mt-6"
          onClick={() => {
            unlockAudio()
            dispatch({ type: 'logSet', reps: reps ?? 0, weightKg: weight == null ? null : toKg(unit, weight), now: Date.now() })
          }}
        >
          <CheckIcon className="size-6" /> Complete set
        </Button>

        {cur.exercise.logged.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-zinc-500 mb-2">Done so far (tap to fix)</p>
            <div className="flex flex-wrap gap-2">
              {cur.exercise.logged.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditing(i)}
                  className="h-8 px-3 rounded-full bg-zinc-800 text-sm tabular-nums hover:bg-zinc-700"
                >
                  {i + 1}: {s.reps} × {formatWeight(unit, s.weightKg)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button size="lg" disabled={!postponable} onClick={() => dispatch({ type: 'postpone', to: 'next' })}>
          <SkipIcon className="size-4" />
          {postponable ? `Machine taken? Do ${nextName} first` : 'Last exercise — can’t postpone'}
        </Button>
        <Button size="lg" onClick={() => setMoreOpen(true)} aria-label="More options">
          •••
        </Button>
      </div>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={cur.exercise.name}>
        <div className="grid gap-2">
          <Button
            size="lg"
            disabled={!postponable}
            onClick={() => {
              dispatch({ type: 'postpone', to: 'end' })
              setMoreOpen(false)
            }}
          >
            Move to end of workout
          </Button>
          <Button
            size="lg"
            onClick={() => {
              dispatch({ type: 'addSet' })
              setMoreOpen(false)
            }}
          >
            Add an extra set
          </Button>
          <Button
            size="lg"
            variant="danger"
            onClick={() => {
              dispatch({ type: 'skipExercise', now: Date.now() })
              setMoreOpen(false)
            }}
          >
            {cur.exercise.logged.length > 0 ? 'Finish exercise early' : 'Skip this exercise'}
          </Button>
        </div>
      </Modal>

      {editing != null && (
        <EditLoggedSetModal
          key={editing}
          unit={unit}
          setNumber={editing + 1}
          initialReps={cur.exercise.logged[editing].reps}
          initialWeightKg={cur.exercise.logged[editing].weightKg}
          onClose={() => setEditing(null)}
          onSave={(r, wKg) => {
            dispatch({ type: 'editLoggedSet', exerciseIndex: cur.exerciseIndex, setIndex: editing, reps: r, weightKg: wKg })
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function EditLoggedSetModal({
  unit,
  setNumber,
  initialReps,
  initialWeightKg,
  onClose,
  onSave,
}: {
  unit: WeightUnit
  setNumber: number
  initialReps: number
  initialWeightKg: number | null
  onClose: () => void
  onSave: (reps: number, weightKg: number | null) => void
}) {
  const [reps, setReps] = useState<number | null>(initialReps)
  const [weight, setWeight] = useState<number | null>(weightInputValue(unit, initialWeightKg))
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit set ${setNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(reps ?? 0, weight == null ? null : toKg(unit, weight))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-400 space-y-1">
          <span>Reps</span>
          <NumberInput value={reps} onChange={setReps} decimals={false} />
        </label>
        <label className="text-sm text-zinc-400 space-y-1">
          <span>Weight ({unit})</span>
          <NumberInput value={weight} onChange={setWeight} allowEmpty />
        </label>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Rest screen
// ---------------------------------------------------------------------------

function RestScreen({ workout, unit, dispatch }: { workout: WorkoutState; unit: WeightUnit; dispatch: (a: WorkoutAction) => void }) {
  const now = useNow(200)
  if (workout.phase.kind !== 'rest') return null
  const { startedAt, endsAt } = workout.phase
  const remaining = restRemainingMs(workout, now)
  const total = Math.max(1, endsAt - startedAt)
  const fraction = Math.min(1, remaining / total)
  const next = currentSet(workout)!
  const postponable = canPostpone(workout)
  const R = 88
  const C = 2 * Math.PI * R

  return (
    <section aria-label="Rest timer" className="space-y-4">
      <Card className="p-6 flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Rest</p>
        <div className="relative size-56 my-4">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-zinc-800" />
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
              className={remaining <= 3000 ? 'text-amber-400' : 'text-accent'}
              style={{ transition: 'stroke-dashoffset 200ms linear' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-6xl font-black tabular-nums" aria-live="off">
              {formatDuration(Math.ceil(remaining / 1000))}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button size="lg" onClick={() => dispatch({ type: 'adjustRest', deltaSeconds: -15, now: Date.now() })}>
            −15s
          </Button>
          <Button size="lg" onClick={() => dispatch({ type: 'adjustRest', deltaSeconds: 15, now: Date.now() })}>
            +15s
          </Button>
          <Button size="lg" variant="primary" onClick={() => dispatch({ type: 'endRest' })}>
            Skip
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Up next</p>
        <p className="text-lg font-bold mt-1">{next.exercise.name}</p>
        <p className="text-sm text-zinc-400">
          Set {next.setNumber} of {next.totalSets} · {targetLabel(next, unit)}
        </p>
        {next.lastTime && (
          <p className="text-sm text-zinc-500">
            Last time: {next.lastTime.reps} × {formatWeight(unit, next.lastTime.weightKg)}
          </p>
        )}
        {postponable && (
          <Button className="w-full mt-3" onClick={() => dispatch({ type: 'postpone', to: 'next' })}>
            <SkipIcon className="size-4" /> Machine taken? Do {workout.exercises[workout.queue[1]].name} first
          </Button>
        )}
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function Queue({ workout, unit, dispatch }: { workout: WorkoutState; unit: WeightUnit; dispatch: (a: WorkoutAction) => void }) {
  const upcoming = workout.queue.slice(1)
  const finished = workout.exercises
    .map((e, index) => ({ ...e, index }))
    .filter((e) => e.status !== 'pending')
  if (upcoming.length === 0 && finished.length === 0) return null
  return (
    <section className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">Later</h3>
          <ol className="space-y-1.5">
            {upcoming.map((i) => {
              const e = workout.exercises[i]
              return (
                <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900/60 px-3 py-2">
                  <span className="text-sm truncate">{e.name}</span>
                  <span className="text-xs text-zinc-500 shrink-0">
                    {e.logged.length > 0
                      ? `${e.logged.length}/${e.sets.length} sets`
                      : `${e.sets.length} ${e.sets.length === 1 ? 'set' : 'sets'}`}
                  </span>
                </li>
              )
            })}
          </ol>
          {upcoming.length > 1 && (
            <p className="text-xs text-zinc-600 mt-2">
              Tip: “Machine taken?” swaps the current exercise with the next one.{' '}
              <button type="button" className="underline hover:text-zinc-400" onClick={() => dispatch({ type: 'postpone', to: 'end' })}>
                Send current to the end
              </button>
            </p>
          )}
        </div>
      )}
      {finished.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">Done</h3>
          <ul className="space-y-1.5">
            {finished.map((e) => (
              <li key={e.index} className="rounded-xl bg-zinc-900/60 px-3 py-2">
                <p className="text-sm flex items-center gap-2">
                  {e.status === 'done' ? <CheckIcon className="size-4 text-accent" /> : <span className="text-zinc-600">—</span>}
                  <span className={e.status === 'skipped' ? 'text-zinc-500 line-through' : ''}>{e.name}</span>
                </p>
                {e.logged.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                    {e.logged.map((s) => `${s.reps}×${formatWeight(unit, s.weightKg)}`).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function SummaryScreen({
  workout,
  unit,
  dispatch,
  discard,
}: {
  workout: WorkoutState
  unit: WeightUnit
  dispatch: (a: WorkoutAction) => void
  discard: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const totals = workoutTotals(workout)
  const save = useMutation({
    mutationFn: () => logWorkout(supabase, toLogPayload(workout, notes.trim() || null)),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: keys.sessions })
      void qc.invalidateQueries({ queryKey: keys.stats })
      discard()
      navigate(`/history/${id}`, { replace: true })
    },
  })
  const durationS = (Date.parse(workout.finishedAt ?? new Date().toISOString()) - Date.parse(workout.startedAt)) / 1000
  const performed = workout.performedOrder.map((i) => workout.exercises[i])
  const prs = new Map(workoutPRs(workout).map((p) => [workout.exercises[p.exerciseIndex], p]))

  return (
    <section className="space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold">Workout complete</p>
        <h2 className="text-2xl font-black mt-1">Nice work 💪</h2>
        <dl className="grid grid-cols-3 gap-3 mt-5 text-center">
          {[
            ['Duration', formatDuration(durationS)],
            ['Sets', String(totals.setsLogged)],
            ['Volume', formatWeight(unit, totals.volumeKg)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-zinc-950 py-3">
              <dt className="text-xs text-zinc-500">{k}</dt>
              <dd className="text-lg font-bold tabular-nums mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {performed.length > 0 && (
        <Card className="p-4 divide-y divide-zinc-800">
          {performed.map((e, i) => (
            <div key={i} className="py-2.5 first:pt-0 last:pb-0">
              <p className="font-medium flex flex-wrap items-center gap-2">
                {e.name}
                {prs.has(e) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 text-amber-200 text-xs font-semibold px-2 py-0.5">
                    <TrophyIcon className="size-3.5" />
                    {[prs.get(e)!.weight && 'Heaviest ever', prs.get(e)!.e1rm && 'Best est. 1RM'].filter(Boolean).join(' · ')}
                  </span>
                )}
              </p>
              <p className="text-sm text-zinc-400 tabular-nums">
                {e.logged.map((s) => `${s.reps}×${formatWeight(unit, s.weightKg)}`).join(' · ')}
              </p>
            </div>
          ))}
        </Card>
      )}

      <Input placeholder="Notes (optional) — how did it feel?" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Workout notes" />

      <ErrorText error={save.error && `Couldn't save: ${save.error.message}. Your workout is kept on this device — try again when you're online.`} />

      <Button variant="primary" size="xl" className="w-full" disabled={totals.setsLogged === 0} loading={save.isPending} onClick={() => save.mutate()}>
        Save workout
      </Button>
      <div className="flex gap-2">
        {workout.queue.length > 0 && (
          <Button className="flex-1" onClick={() => dispatch({ type: 'reopen' })}>
            Back to workout
          </Button>
        )}
        <Button className="flex-1" variant="danger" onClick={() => setConfirmDiscard(true)}>
          Discard
        </Button>
      </div>

      <ConfirmModal
        open={confirmDiscard}
        title="Discard workout?"
        message="Nothing from this workout will be saved."
        confirmLabel="Discard"
        danger
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          discard()
          navigate('/', { replace: true })
        }}
      />
    </section>
  )
}
