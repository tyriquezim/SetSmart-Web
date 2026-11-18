import {
  CARDIO_ACTIVITIES,
  CARDIO_ACTIVITY_ORDER,
  COMPENDIUM_URL,
  todayIsoDate,
  type CardioActivity,
  type CardioEffort,
  type CardioSession,
} from '@setsmart/core'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CardioInfoText, EstimateInfo } from '../components/energy/EstimateInfo'
import { Button, Card, ErrorText, Field, Input, LoadingBlock, NumberInput, PageHeader, Segmented } from '../components/ui'
import { useCardioSession, useEnergyUnit, useSaveCardio, useWeightUnit } from '../hooks/data'
import { useNow } from '../hooks/useNow'
import { distanceIn, distanceToM, distanceUnitFor, formatPace, usesMetres, type DistanceUnit } from '../lib/cardio'
import { describeMissing, formatEstimate, useCardioEnergy } from '../lib/energy'

/** Log a new cardio session, or edit one (when the route has an :id). */
export function CardioFormPage() {
  const { id } = useParams()
  const existing = useCardioSession(id)
  const unit = distanceUnitFor(useWeightUnit())

  if (id && existing.isPending) return <LoadingBlock />
  if (id && existing.error) return <ErrorText error={existing.error} />
  return <CardioForm key={id ?? 'new'} session={existing.data ?? null} distanceUnit={unit} />
}

const pad = (n: number) => String(n).padStart(2, '0')
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function CardioForm({ session, distanceUnit }: { session: CardioSession | null; distanceUnit: DistanceUnit }) {
  const navigate = useNavigate()
  const save = useSaveCardio()
  const energyUnit = useEnergyUnit()
  const now = useNow(60_000)

  const start = session ? new Date(session.startedAt) : new Date()
  const [activity, setActivity] = useState<CardioActivity>(session?.activity ?? 'run')
  const [customName, setCustomName] = useState(session?.customName ?? '')
  const [date, setDate] = useState(session ? todayIsoDate(start) : todayIsoDate())
  const [time, setTime] = useState(localTime(start))
  const dur = session?.durationS ?? 0
  const [hours, setHours] = useState<number | null>(session ? Math.floor(dur / 3600) || null : null)
  const [minutes, setMinutes] = useState<number | null>(session ? Math.floor((dur % 3600) / 60) || null : null)
  const [seconds, setSeconds] = useState<number | null>(session ? dur % 60 || null : null)
  const [distance, setDistance] = useState<number | null>(() => {
    if (session?.distanceM == null) return null
    return usesMetres(session.activity) ? session.distanceM : Math.round(distanceIn(distanceUnit, session.distanceM) * 100) / 100
  })
  const [effort, setEffort] = useState<CardioEffort | null>(session?.effort ?? null)
  const [met, setMet] = useState<number | null>(session?.met ?? null)
  const [notes, setNotes] = useState(session?.notes ?? '')

  const info = CARDIO_ACTIVITIES[activity]
  const metres = usesMetres(activity)
  const durationS = (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  const distanceM = info.hasDistance && distance != null && distance > 0 ? (metres ? distance : distanceToM(distanceUnit, distance)) : null
  const startedAt = new Date(`${date}T${time || '00:00'}`)
  const effortOptions = info.efforts
  // Only offer effort choices the activity has; otherwise drop a stale one.
  const chosenEffort = effortOptions.some((o) => o.effort === effort) ? effort : null
  const speedSetsMet = info.speeds != null && distanceM != null

  const durationOk = durationS >= 60 && durationS <= 86_400
  const distanceOk = distance == null || distance > 0
  const metOk = activity !== 'other' || met == null || (met >= 1 && met <= 25)
  const whenOk = !Number.isNaN(startedAt.getTime()) && startedAt.getTime() <= now + 5 * 60_000
  const valid = durationOk && distanceOk && metOk && whenOk

  const draft = {
    activity,
    startedAt: whenOk ? startedAt.toISOString() : new Date(now).toISOString(),
    durationS,
    distanceM,
    effort: chosenEffort,
    met: activity === 'other' ? met : null,
  }
  const estimate = useCardioEnergy(durationOk ? draft : undefined)
  const pace = durationOk ? formatPace({ activity, durationS, distanceM }, distanceUnit) : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    save.mutate(
      {
        id: session?.id ?? null,
        ...draft,
        startedAt: startedAt.toISOString(),
        customName: activity === 'other' ? customName : null,
        notes,
      },
      { onSuccess: (saved) => navigate(`/history/cardio/${saved.id}`, { replace: true }) },
    )
  }

  return (
    <>
      <Link to={session ? `/history/cardio/${session.id}` : '/history'} className="text-sm text-zinc-400 hover:text-zinc-100">
        ← {session ? 'Back' : 'History'}
      </Link>
      <div className="mt-3">
        <PageHeader title={session ? 'Edit cardio' : 'Log cardio'} />
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset>
          <legend className="block text-sm font-medium text-zinc-300 mb-1.5">Activity</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CARDIO_ACTIVITY_ORDER.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={activity === a}
                onClick={() => {
                  // Swims and rows are in metres, the rest in km or miles, so a typed distance no longer fits.
                  if (usesMetres(a) !== usesMetres(activity)) setDistance(null)
                  setActivity(a)
                }}
                className={`h-11 rounded-xl border px-3 text-sm font-medium text-left ${
                  activity === a ? 'border-accent bg-zinc-800/50 text-accent' : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {CARDIO_ACTIVITIES[a].label}
              </button>
            ))}
          </div>
        </fieldset>

        {activity === 'other' && (
          <Field label="What did you do?">
            {(fid) => <Input id={fid} value={customName} maxLength={60} placeholder="e.g. Kayaking" onChange={(e) => setCustomName(e.target.value)} />}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            {(fid) => <Input id={fid} type="date" value={date} max={todayIsoDate()} required onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Start time">
            {(fid) => <Input id={fid} type="time" value={time} required onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        {!whenOk && <p className="text-xs text-red-300">The start can't be in the future.</p>}

        <fieldset>
          <legend className="block text-sm font-medium text-zinc-300 mb-1.5">Duration</legend>
          <div className="flex gap-2">
            {(
              [
                ['h', 'Hours', hours, setHours, undefined],
                ['min', 'Minutes', minutes, setMinutes, 59],
                ['s', 'Seconds', seconds, setSeconds, 59],
              ] as const
            ).map(([suffix, label, value, set, max]) => (
              <div key={suffix} className="relative flex-1">
                <NumberInput aria-label={`Duration, ${label.toLowerCase()}`} allowEmpty decimals={false} min={0} max={max} value={value} onChange={set} className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{suffix}</span>
              </div>
            ))}
          </div>
          {durationS > 0 && !durationOk && <p className="text-xs text-red-300 mt-1.5">Enter between 1 minute and 24 hours.</p>}
        </fieldset>

        {info.hasDistance && (
          <Field
            label="Distance (optional)"
            hint={pace ? `Average ${pace}` : info.speeds ? 'With a distance, your speed is used for the estimate.' : undefined}
          >
            {(fid) => (
              <div className="relative">
                <NumberInput id={fid} allowEmpty min={0} decimals={!metres} value={distance} onChange={setDistance} className="pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">{metres ? 'm' : distanceUnit}</span>
              </div>
            )}
          </Field>
        )}

        {effortOptions.length > 1 && !speedSetsMet && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-zinc-300">How hard was it?</p>
            <Segmented<CardioEffort | 'none'>
              label="How hard was it?"
              value={chosenEffort ?? 'none'}
              onChange={(v) => setEffort(v === 'none' ? null : v)}
              options={effortOptions.map((o) => ({ value: o.effort, label: o.label }))}
            />
            {!chosenEffort && <p className="text-xs text-zinc-500">If you don't choose, the middle option is used.</p>}
          </div>
        )}

        {activity === 'other' && (
          <Field label="MET value (optional)" hint="Needed for an energy estimate.">
            {(fid) => (
              <>
                <NumberInput id={fid} allowEmpty min={1} max={25} value={met} onChange={setMet} placeholder="e.g. 5.0" />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Look up your activity in the{' '}
                  <a href={COMPENDIUM_URL} target="_blank" rel="noreferrer" className="text-accent">
                    Compendium of Physical Activities
                  </a>{' '}
                  and enter its MET value.
                </p>
              </>
            )}
          </Field>
        )}
        {!metOk && <p className="text-xs text-red-300">Enter a MET value between 1 and 25.</p>}

        <Field label="Notes (optional)">
          {(fid) => (
            <textarea
              id={fid}
              value={notes}
              maxLength={1000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          )}
        </Field>

        {durationOk && estimate && (
          <Card className="p-4 text-sm">
            {estimate.ok ? (
              <p className="text-zinc-300">
                Estimated energy: <strong className="text-zinc-100">≈ {formatEstimate(energyUnit, estimate.estimate.kcal)}</strong> above resting{' '}
                <EstimateInfo label="How this session's energy is estimated" title="Cardio energy" unit={energyUnit}>
                  <CardioInfoText cardio={estimate.estimate} unit={energyUnit} distanceUnit={distanceUnit} />
                </EstimateInfo>
              </p>
            ) : (
              <p className="text-zinc-400">
                {estimate.missing.includes('met') && estimate.missing.length === 1
                  ? 'Enter a MET value to see an energy estimate.'
                  : `To see an energy estimate, ${describeMissing(estimate.missing.filter((m) => m !== 'met'))}.`}
              </p>
            )}
          </Card>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={save.isPending} disabled={!valid}>
          {session ? 'Save changes' : 'Save cardio'}
        </Button>
        <ErrorText error={save.error} />
      </form>
    </>
  )
}
