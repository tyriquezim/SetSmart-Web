import type { DailyActivity, Profile, Sex, WorkoutEffort } from '@setsmart/core'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useEnergyUnit, useUpdateProfile } from '../../hooks/data'
import { InfoIcon } from '../icons'
import { Button, Card, ErrorText, Field, NumberInput, Segmented } from '../ui'
import { EstimatesInfoModal } from './EstimatesInfoModal'

const CM_PER_IN = 2.54

const ACTIVITY_OPTIONS: Array<{ value: DailyActivity; label: string; hint: string }> = [
  { value: 'sitting', label: 'Mostly sitting', hint: 'Desk job, little walking outside workouts' },
  { value: 'mixed', label: 'Mix of sitting and moving', hint: 'Some walking or standing through the day' },
  { value: 'active', label: 'On your feet most of the day', hint: 'e.g. retail, nursing, trades' },
]

type SexChoice = Sex | 'unset'

/** Height, birth year, sex and activity levels used for energy estimates. */
export function BodyDetailsCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const energyUnit = useEnergyUnit()
  const imperial = profile.weightUnit === 'lb'
  const [infoOpen, setInfoOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const initialIn = profile.heightCm != null ? profile.heightCm / CM_PER_IN : null
  const [cm, setCm] = useState<number | null>(profile.heightCm)
  const [ft, setFt] = useState<number | null>(initialIn != null ? Math.floor(Math.round(initialIn) / 12) : null)
  const [inch, setInch] = useState<number | null>(initialIn != null ? Math.round(initialIn) % 12 : null)
  const [birthYear, setBirthYear] = useState<number | null>(profile.birthYear)
  const [sex, setSex] = useState<SexChoice>(profile.sex ?? 'unset')
  const [activity, setActivity] = useState<DailyActivity | null>(profile.dailyActivity)
  const [effort, setEffort] = useState<WorkoutEffort>(profile.workoutEffort)

  const touched = () => setSaved(false)
  const heightCm = imperial
    ? ft == null && inch == null
      ? null
      : ((ft ?? 0) * 12 + (inch ?? 0)) * CM_PER_IN
    : cm
  const thisYear = new Date().getFullYear()
  const heightOk = heightCm == null || (heightCm >= 50 && heightCm <= 272)
  const yearOk = birthYear == null || (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= thisYear)
  const age = birthYear != null ? thisYear - birthYear : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!heightOk || !yearOk) return
    update.mutate(
      {
        heightCm,
        birthYear,
        sex: sex === 'unset' ? null : sex,
        dailyActivity: activity,
        workoutEffort: effort,
      },
      { onSuccess: () => setSaved(true) },
    )
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <h2 className="font-semibold">Body details</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Used only to estimate how much energy you burn. Weight and body fat % come from your latest{' '}
            <Link to="/progress" className="text-accent">
              weigh-in
            </Link>
            .
          </p>
        </div>

        {imperial ? (
          <fieldset className="space-y-1.5">
            <legend className="block text-sm font-medium text-zinc-300 mb-1.5">Height</legend>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <NumberInput aria-label="Height, feet" allowEmpty decimals={false} min={0} value={ft} onChange={(v) => { setFt(v); touched() }} className="pr-9" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">ft</span>
              </div>
              <div className="relative flex-1">
                <NumberInput aria-label="Height, inches" allowEmpty min={0} max={11} value={inch} onChange={(v) => { setInch(v); touched() }} className="pr-9" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">in</span>
              </div>
            </div>
          </fieldset>
        ) : (
          <Field label="Height">
            {(id) => (
              <div className="relative">
                <NumberInput id={id} allowEmpty min={0} value={cm} onChange={(v) => { setCm(v); touched() }} className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">cm</span>
              </div>
            )}
          </Field>
        )}
        {!heightOk && <p className="text-xs text-red-300">Enter a height between 50 and 272 cm.</p>}

        <Field label="Birth year" hint={age != null && age < 18 ? 'These equations were developed for adults, so estimates are less reliable under 18.' : undefined}>
          {(id) => (
            <NumberInput id={id} allowEmpty decimals={false} min={1900} max={thisYear} placeholder="e.g. 1995" value={birthYear} onChange={(v) => { setBirthYear(v); touched() }} />
          )}
        </Field>
        {!yearOk && <p className="text-xs text-red-300">Enter a year between 1900 and {thisYear}.</p>}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-300">Sex for the resting energy equation</p>
          <Segmented<SexChoice>
            label="Sex for the resting energy equation"
            value={sex}
            onChange={(v) => { setSex(v); touched() }}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unset', label: 'Not set' },
            ]}
          />
          <p className="text-xs text-zinc-500">
            The Mifflin-St Jeor equation has a male and a female version. If not set, the average of the two is used. It
            isn't needed once you've logged a body fat %.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-300 mb-1">Everyday activity, outside workouts</legend>
          {ACTIVITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                activity === o.value ? 'border-accent bg-zinc-800/50' : 'border-zinc-800'
              }`}
            >
              <input
                type="radio"
                name="daily-activity"
                className="mt-1 accent-lime-400"
                checked={activity === o.value}
                onChange={() => { setActivity(o.value); touched() }}
              />
              <span>
                <span className="block text-sm">{o.label}</span>
                <span className="block text-xs text-zinc-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-300">Typical workout effort</p>
          <Segmented<WorkoutEffort>
            label="Typical workout effort"
            value={effort}
            onChange={(v) => { setEffort(v); touched() }}
            options={[
              { value: 'moderate', label: 'Moderate' },
              { value: 'vigorous', label: 'Vigorous' },
            ]}
          />
          <p className="text-xs text-zinc-500">
            {effort === 'moderate'
              ? 'Several exercises, mostly 8–15 reps, normal rests.'
              : 'Heavy powerlifting or bodybuilding sessions, pushing hard with short rests.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!heightOk || !yearOk}>
            Save body details
          </Button>
          <button type="button" onClick={() => setInfoOpen(true)} className="flex items-center gap-1 text-sm text-accent">
            <InfoIcon className="size-4" /> How estimates work
          </button>
        </div>
        {saved && <p className="text-xs text-lime-200">Saved.</p>}
        <ErrorText error={update.error} />
      </form>
      <EstimatesInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} unit={energyUnit} />
    </Card>
  )
}
