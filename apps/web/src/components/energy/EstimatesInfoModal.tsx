import {
  BODY_FAT_MAX_AGE_DAYS,
  DAILY_ACTIVITY_PAL,
  ENERGY_SOURCES,
  MAX_WORKOUT_MINUTES,
  WORKOUT_MET,
  type DayEnergyEstimate,
  type EnergyUnit,
} from '@setsmart/core'
import type { ReactNode } from 'react'
import { formatEstimate, RESTING_METHOD_LABEL } from '../../lib/energy'
import { Modal } from '../ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      {children}
    </section>
  )
}

const Formula = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 overflow-x-auto">{children}</p>
)

const Cite = ({ ids }: { ids: string[] }) => (
  <sup className="text-zinc-500">[{ids.map((id) => ENERGY_SOURCES.findIndex((s) => s.id === id) + 1).join(', ')}]</sup>
)

/** How every energy estimate is worked out, with the user's own numbers when available. */
export function EstimatesInfoModal({
  open,
  onClose,
  estimate,
  unit,
}: {
  open: boolean
  onClose: () => void
  estimate?: DayEnergyEstimate | null
  unit: EnergyUnit
}) {
  return (
    <Modal open={open} onClose={onClose} title="How energy estimates work">
      <div className="space-y-5 text-sm text-zinc-400 leading-relaxed">
        <p className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-zinc-200">
          These numbers are <strong>estimates from published equations, not measurements</strong>. They're based on
          averages from groups of people, so your real energy use can be 10% or more higher or lower. Use them as a
          guide, and adjust based on how your weight actually changes over a few weeks.
        </p>

        <Section title="Resting energy (BMR)">
          <p>The energy your body uses at rest to keep you alive: breathing, circulation, organs and temperature.</p>
          {estimate && (
            <p className="text-zinc-200">
              Yours: about {formatEstimate(unit, estimate.restingKcal)} a day, using the {RESTING_METHOD_LABEL[estimate.resting.method]}.
            </p>
          )}
          <p>
            <strong className="text-zinc-300">If you've logged a body fat %</strong> within {BODY_FAT_MAX_AGE_DAYS} days, we use the
            Cunningham equation, which works from fat-free mass (muscle, organs, bone and water: everything except fat). Fat-free mass burns more
            energy than fat, so this suits people who lift.
            <Cite ids={['cunningham', 'tenhaaf']} />
          </p>
          <Formula>
            fat-free mass = weight × (1 − body fat %)
            <br />
            kcal/day = 500 + 22 × fat-free mass (kg)
          </Formula>
          <p>
            <strong className="text-zinc-300">Otherwise</strong> we use the Mifflin-St Jeor equation, from your weight, height and
            age. A systematic review found it was the equation most often within 10% of measured resting energy in healthy
            adults.
            <Cite ids={['mifflin', 'frankenfield']} />
          </p>
          <Formula>
            kcal/day = 10 × weight (kg) + 6.25 × height (cm) − 5 × age + s
            <br />s = +5 (male), −161 (female), −78 if not set
          </Formula>
          <p>
            About "muscle mass" on smart scales: brands measure and define it differently, and it isn't the same as fat-free
            mass, so we ask for body fat % instead. Most smart scales show it. Home scales can be a few percent out, which
            changes resting energy by roughly 2–3%.
          </p>
        </Section>

        <Section title="Everyday activity">
          <p>
            Walking around, standing, chores and digesting food, but not your logged workouts. It's estimated by
            multiplying resting energy by a physical activity level (PAL).
            <Cite ids={['fao']} />
          </p>
          <ul className="list-disc pl-5">
            <li>Mostly sitting: PAL {DAILY_ACTIVITY_PAL.sitting}</li>
            <li>Mix of sitting and moving: PAL {DAILY_ACTIVITY_PAL.mixed}</li>
            <li>On your feet most of the day: PAL {DAILY_ACTIVITY_PAL.active}</li>
          </ul>
          {estimate && (
            <p className="text-zinc-200">
              Yours: PAL {estimate.pal}
              {estimate.activityAssumed && " (assumed, because you haven't chosen a level in Settings)"}, about{' '}
              {formatEstimate(unit, estimate.everydayKcal)} on top of resting.
            </p>
          )}
          <p>This is the least certain part. People's everyday movement varies a lot, even with similar jobs.</p>
        </Section>

        <Section title="Workouts">
          <p>
            Each logged workout uses the MET value for weight training from the 2024 Adult Compendium of Physical
            Activities: {WORKOUT_MET.moderate} METs for moderate sessions (multiple exercises, 8–15 reps) or {WORKOUT_MET.vigorous} for
            vigorous ones (powerlifting or bodybuilding style). These values allow for rest between sets.
            <Cite ids={['compendium']} />
          </p>
          <Formula>
            kcal = (MET × 3.5 × weight (kg) ÷ 200 − resting kcal per minute) × minutes
          </Formula>
          <p>
            Resting energy is subtracted because it's already counted in the daily total. Sessions are counted for at most{' '}
            {MAX_WORKOUT_MINUTES / 60} hours, in case a workout was left running. Weight training burns less than it feels like it
            does, and how hard you work changes it a lot.
          </p>
        </Section>

        <Section title="Who these don't suit">
          <p>
            The equations were developed in healthy adults. They're less reliable if you're under 18, pregnant or
            breastfeeding, have a medical condition or take medication that affects metabolism, or are a very
            high-level athlete. Talk to a dietitian or doctor if you need accurate numbers.
          </p>
        </Section>

        <Section title="Sources">
          <ol className="list-decimal pl-5 space-y-1.5 text-xs">
            {ENERGY_SOURCES.map((s) => (
              <li key={s.id}>
                {s.citation}{' '}
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent break-all">
                  Link
                </a>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </Modal>
  )
}
