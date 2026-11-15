import { kjTo, type EnergyUnit, type Nutrients, type NutritionTargets } from '@setsmart/core'
import { energyLabel, grams } from '../../lib/nutrition'
import { chartTheme } from '../charts/theme'
import { AlertIcon } from '../icons'
import { Card } from '../ui'

// Meter colours: the fill is the validated chart lime; the track is a dark step of
// the same lime ramp, so the whole bar reads as one measure. Going over a target
// switches the fill to the amber warning status, always with an icon and text.
const TRACK = '#1a2e05' // lime-950
const OVER = '#d97706' // amber-600

function Meter({ value, target, label }: { value: number; target: number; label: string }) {
  const over = value > target
  const pct = Math.min(100, (value / target) * 100)
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuenow={Math.round(value)}
      className="h-2 rounded-full overflow-hidden"
      style={{ background: TRACK }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? OVER : chartTheme.series }} />
    </div>
  )
}

function Remaining({ value, target, unit }: { value: number; target: number; unit: string }) {
  const diff = target - value
  if (diff >= 0) return <span className="text-zinc-500">{`${unit === 'g' ? grams(diff) : diff.toLocaleString()} ${unit} left`}</span>
  return (
    <span className="inline-flex items-center gap-1 text-amber-300">
      <AlertIcon className="size-3.5" />
      {`Over by ${unit === 'g' ? grams(-diff) : (-diff).toLocaleString()} ${unit}`}
    </span>
  )
}

const MACROS = [
  { key: 'proteinG', label: 'Protein' },
  { key: 'carbsG', label: 'Carbs' },
  { key: 'fatG', label: 'Fat' },
] as const

/** The day's energy as a headline with its meter, then a meter row per macro. */
export function NutritionSummary({
  totals,
  targets,
  unit,
  onEditTargets,
}: {
  totals: Nutrients
  targets: NutritionTargets
  unit: EnergyUnit
  onEditTargets: () => void
}) {
  const eLabel = energyLabel(unit)
  const eaten = Math.round(kjTo(unit, totals.energyKj))
  const target = targets.energyKj != null ? Math.round(kjTo(unit, targets.energyKj)) : null
  const hasAnyTarget = Object.values(targets).some((v) => v != null)

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Energy</p>
          <p className="mt-1">
            <span className="text-4xl font-black tabular-nums">{eaten.toLocaleString()}</span>
            <span className="text-sm text-zinc-400 ml-1.5">
              {target != null ? `of ${target.toLocaleString()} ${eLabel}` : eLabel}
            </span>
          </p>
        </div>
        <button type="button" onClick={onEditTargets} className="text-sm text-accent shrink-0 mt-1">
          {hasAnyTarget ? 'Targets' : 'Set targets'}
        </button>
      </div>
      {target != null && (
        <div className="mt-3 space-y-1.5">
          <Meter value={eaten} target={target} label={`Energy, ${eLabel}`} />
          <p className="text-xs">
            <Remaining value={eaten} target={target} unit={eLabel} />
          </p>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-4">
        {MACROS.map(({ key, label }) => {
          const value = totals[key]
          const t = targets[key]
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-sm">
                <span className="font-semibold tabular-nums">{grams(value)}</span>
                <span className="text-zinc-500">{t != null ? ` / ${grams(t)} g` : ' g'}</span>
              </dd>
              {t != null && (
                <dd className="space-y-1">
                  <Meter value={value} target={t} label={`${label}, grams`} />
                  <p className="text-[11px] truncate">
                    <Remaining value={value} target={t} unit="g" />
                  </p>
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </Card>
  )
}
