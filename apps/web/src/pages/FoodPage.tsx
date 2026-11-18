import {
  addDays,
  dailyTotals,
  describeAmount,
  groupByMeal,
  MEALS,
  NO_TARGETS,
  sumNutrients,
  todayIsoDate,
  type FoodLogEntry,
  type Meal,
} from '@setsmart/core'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, PlusIcon } from '../components/icons'
import { EnergyBalanceCard } from '../components/energy/EnergyBalanceCard'
import { EditEntryModal } from '../components/nutrition/EditEntryModal'
import { NutritionSummary } from '../components/nutrition/NutritionSummary'
import { TargetsModal } from '../components/nutrition/TargetsModal'
import { WeekEnergyChart } from '../components/nutrition/WeekEnergyChart'
import { Button, Card, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useCardioBetween, useCopyFoodLogs, useEnergyUnit, useFoodLogs, useNutritionTargets, useWorkoutTimes } from '../hooks/data'
import { dayLabel, energyLabel, energyNumber, isIsoDate } from '../lib/nutrition'

const NO_WORKOUTS: [] = []
const NO_CARDIO: [] = []

export function FoodPage() {
  const [params, setParams] = useSearchParams()
  const today = todayIsoDate()
  const raw = params.get('date')
  const day = isIsoDate(raw) ? raw : today
  const setDay = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true })

  const unit = useEnergyUnit()
  const targets = useNutritionTargets()
  // One query covers the selected day, the day before (for copying) and the week chart.
  const week = useFoodLogs(addDays(day, -6), day)
  const workouts = useWorkoutTimes(day)
  const cardio = useCardioBetween(day)
  const [editing, setEditing] = useState<FoodLogEntry | null>(null)
  const [targetsOpen, setTargetsOpen] = useState(false)

  const entries = useMemo(() => week.data ?? [], [week.data])
  const dayEntries = useMemo(() => entries.filter((e) => e.eatenOn === day), [entries, day])
  const yesterdayByMeal = useMemo(() => groupByMeal(entries.filter((e) => e.eatenOn === addDays(day, -1))), [entries, day])
  const byMeal = useMemo(() => groupByMeal(dayEntries), [dayEntries])
  const totals = useMemo(() => dailyTotals(entries), [entries])

  return (
    <>
      <PageHeader title="Food" />

      <div className="flex items-center justify-between gap-2 mb-4">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
          <ChevronLeftIcon className="size-5" />
        </Button>
        <div className="text-center">
          <p className="font-semibold">{dayLabel(day, today)}</p>
          {day !== today && (
            <button type="button" className="text-xs text-accent" onClick={() => setDay(today)}>
              Back to today
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => setDay(addDays(day, 1))}
          disabled={day >= today}
          aria-label="Next day"
        >
          <ChevronRightIcon className="size-5" />
        </Button>
      </div>

      <ErrorText error={week.error ?? targets.error} />
      {week.isPending ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <NutritionSummary
            totals={sumNutrients(dayEntries)}
            targets={targets.data ?? NO_TARGETS}
            unit={unit}
            onEditTargets={() => setTargetsOpen(true)}
          />

          <EnergyBalanceCard
            day={day}
            today={today}
            eatenKj={sumNutrients(dayEntries).energyKj}
            workouts={workouts.data ?? NO_WORKOUTS}
            cardio={cardio.data ?? NO_CARDIO}
            unit={unit}
          />

          <div className="space-y-3">
            {MEALS.map((m) => (
              <MealSection
                key={m.value}
                meal={m.value}
                label={m.label}
                day={day}
                entries={byMeal[m.value]}
                yesterday={yesterdayByMeal[m.value]}
                onEdit={setEditing}
              />
            ))}
          </div>

          <Card className="p-5">
            <WeekEnergyChart
              endDay={day}
              selectedDay={day}
              totals={totals}
              targetKj={targets.data?.energyKj ?? null}
              unit={unit}
              onSelect={setDay}
            />
          </Card>
        </div>
      )}

      <EditEntryModal entry={editing} unit={unit} onClose={() => setEditing(null)} />
      <TargetsModal open={targetsOpen} targets={targets.data ?? NO_TARGETS} unit={unit} onClose={() => setTargetsOpen(false)} />
    </>
  )
}

function MealSection({
  meal,
  label,
  day,
  entries,
  yesterday,
  onEdit,
}: {
  meal: Meal
  label: string
  day: string
  entries: FoodLogEntry[]
  yesterday: FoodLogEntry[]
  onEdit: (e: FoodLogEntry) => void
}) {
  const unit = useEnergyUnit()
  const copy = useCopyFoodLogs()
  const total = sumNutrients(entries).energyKj
  const addHref = `/food/add?meal=${meal}&date=${day}`

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <h2 className="font-semibold">
          {label}
          {entries.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500 tabular-nums">
              {energyNumber(unit, total)} {energyLabel(unit)}
            </span>
          )}
        </h2>
        <Link to={addHref} className="flex items-center gap-1 text-sm text-accent" aria-label={`Add food to ${label}`}>
          <PlusIcon className="size-4" /> Add
        </Link>
      </div>
      {entries.length > 0 ? (
        <ul className="divide-y divide-zinc-800/80 border-t border-zinc-800/80">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{e.name}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {[e.brand, describeAmount(e) ?? 'Quick add'].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-zinc-300">{energyNumber(unit, e.energyKj)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        yesterday.length > 0 && (
          <div className="px-4 pb-3">
            <Button
              size="sm"
              variant="ghost"
              className="-ml-3 text-zinc-400"
              loading={copy.isPending}
              onClick={() =>
                copy.mutate(
                  yesterday.map((e) => ({
                    eatenOn: day,
                    meal: e.meal,
                    foodId: e.foodId,
                    name: e.name,
                    brand: e.brand,
                    amount: e.amount,
                    amountUnit: e.amountUnit,
                    grams: e.grams,
                    energyKj: e.energyKj,
                    proteinG: e.proteinG,
                    carbsG: e.carbsG,
                    fatG: e.fatG,
                  })),
                )
              }
            >
              <CopyIcon className="size-4" />
              Copy yesterday's {label.toLowerCase()} ({yesterday.length} {yesterday.length === 1 ? 'item' : 'items'})
            </Button>
            <ErrorText error={copy.error} />
          </div>
        )
      )}
    </Card>
  )
}
