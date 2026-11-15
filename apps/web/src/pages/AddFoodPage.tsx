import {
  MEALS,
  mealForHour,
  todayIsoDate,
  type AmountUnit,
  type EnergyUnit,
  type Food,
  type FoodData,
  type Meal,
  type RecentFood,
} from '@setsmart/core'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BarcodeIcon, BoltIcon, ChevronLeftIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import { BarcodeScannerModal } from '../components/nutrition/BarcodeScanner'
import { FoodFormModal } from '../components/nutrition/FoodFormModal'
import { LogFoodModal } from '../components/nutrition/LogFoodModal'
import { QuickAddForm } from '../components/nutrition/QuickAddForm'
import { Button, Card, ConfirmModal, ErrorText, Input, Modal, Segmented, Spinner } from '../components/ui'
import {
  useArchiveFood,
  useBarcodeLookup,
  useEnergyUnit,
  useFoods,
  useLogFood,
  useRecentFoods,
} from '../hooks/data'
import {
  dayLabel,
  defaultAmount,
  energyLabel,
  energyNumber,
  isIsoDate,
  isMeal,
  sourceLabel,
  useDebounced,
  useOffSearch,
  useUsdaSearch,
} from '../lib/nutrition'

type Tab = 'recent' | 'mine'

const keyOf = (f: FoodData | Food) => ('id' in f ? f.id : `${f.source}:${f.sourceId}`)

export function AddFoodPage() {
  const [params] = useSearchParams()
  const today = todayIsoDate()
  const day = isIsoDate(params.get('date')) ? params.get('date')! : today
  const mealParam = params.get('meal')
  const meal: Meal = isMeal(mealParam) ? mealParam : mealForHour(new Date().getHours())
  const mealLabel = MEALS.find((m) => m.value === meal)!.label
  const backHref = day === today ? '/food' : `/food?date=${day}`

  const unit = useEnergyUnit()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 400)
  const [tab, setTab] = useState<Tab>('recent')

  const [selected, setSelected] = useState<{ food: FoodData | Food; amount: number; unit: AmountUnit } | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [quickOpen, setQuickOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [newFood, setNewFood] = useState<{ barcode: string | null; name: string } | null>(null)

  const log = useLogFood()
  const lookup = useBarcodeLookup()
  const recents = useRecentFoods()
  const lastUsed = useMemo(() => new Map((recents.data ?? []).map((r) => [r.food.id, r])), [recents.data])

  const pick = (food: FoodData | Food) => {
    log.reset()
    const last = 'id' in food ? lastUsed.get(food.id) : undefined
    const d = defaultAmount(food, last && { amount: last.lastAmount, unit: last.lastAmountUnit })
    setSelected({ food, amount: d.amount, unit: d.unit })
  }

  const onBarcode = (code: string) => {
    setScanOpen(false)
    setNotFound(null)
    lookup.mutate(code, {
      onSuccess: (food) => (food ? pick(food) : setNotFound(code)),
    })
  }

  return (
    <>
      <div className="mb-5">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100 -ml-1">
          <ChevronLeftIcon className="size-4" /> {dayLabel(day, today)}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Add to {mealLabel.toLowerCase()}</h1>
      </div>

      {added.length > 0 && (
        <Card className="px-4 py-3 mb-4 flex items-center gap-3 border-lime-900">
          <p className="text-sm min-w-0 flex-1 truncate">
            Added {added[added.length - 1]}
            {added.length > 1 && <span className="text-zinc-500"> and {added.length - 1} more</span>}
          </p>
          <Link to={backHref} className="text-sm font-semibold text-accent shrink-0">
            Done
          </Link>
        </Card>
      )}

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <SearchIcon className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods"
            aria-label="Search foods"
            className="pl-10"
            autoFocus
          />
        </div>
        <Button className="h-11 w-11 px-0 shrink-0" onClick={() => setScanOpen(true)} aria-label="Scan barcode">
          <BarcodeIcon className="size-5" />
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Button size="sm" onClick={() => setQuickOpen(true)}>
          <BoltIcon className="size-4" /> Quick add
        </Button>
        <Button size="sm" onClick={() => setNewFood({ barcode: null, name: query.trim() })}>
          <PlusIcon className="size-4" /> New food
        </Button>
      </div>

      {lookup.isPending && (
        <p className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
          <Spinner className="size-4" /> Looking up barcode…
        </p>
      )}
      <ErrorText error={lookup.error} />
      {notFound && (
        <Card className="p-4 mb-4 space-y-3">
          <p className="text-sm">
            Barcode <span className="font-mono">{notFound}</span> isn't in Open Food Facts yet.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setNewFood({ barcode: notFound, name: '' })}>
              Create this food
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNotFound(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {debounced.length >= 2 ? (
        <SearchResults query={debounced} unit={unit} onPick={pick} />
      ) : (
        <>
          <Segmented<Tab>
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'mine', label: 'My foods' },
            ]}
          />
          <div className="mt-4">
            {tab === 'recent' ? (
              <RecentList recents={recents.data} loading={recents.isPending} error={recents.error} unit={unit} onPick={pick} />
            ) : (
              <MyFoods unit={unit} onPick={pick} />
            )}
          </div>
        </>
      )}

      <LogFoodModal
        food={selected?.food ?? null}
        initial={selected && { amount: selected.amount, unit: selected.unit }}
        meal={meal}
        unit={unit}
        saving={log.isPending}
        error={log.error}
        onClose={() => setSelected(null)}
        onLog={(v) => {
          if (!selected) return
          const food = selected.food
          log.mutate(
            {
              food,
              entry: {
                eatenOn: day,
                meal: v.meal,
                name: food.name,
                brand: food.brand,
                amount: v.amount,
                amountUnit: v.amountUnit,
                grams: v.grams,
                ...v.nutrients,
              },
            },
            {
              onSuccess: () => {
                setAdded((a) => [...a, food.name])
                setSelected(null)
                setNotFound(null)
              },
            },
          )
        }}
      />

      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add">
        {quickOpen && (
          <QuickAddForm
            initial={{ name: '', meal, energy: null, proteinG: null, carbsG: null, fatG: null }}
            unit={unit}
            saving={log.isPending}
            error={log.error}
            submitLabel="Add"
            onSubmit={(v) =>
              log.mutate(
                {
                  food: null,
                  entry: { eatenOn: day, meal: v.meal, name: v.name, brand: null, amount: null, amountUnit: null, grams: null, ...v.nutrients },
                },
                {
                  onSuccess: () => {
                    setAdded((a) => [...a, v.name])
                    setQuickOpen(false)
                  },
                },
              )
            }
          />
        )}
      </Modal>

      <BarcodeScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onBarcode} />

      <FoodFormModal
        open={newFood != null}
        initialBarcode={newFood?.barcode}
        initialName={newFood?.name}
        unit={unit}
        onClose={() => setNewFood(null)}
        onSaved={(f) => {
          setNotFound(null)
          pick(f)
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------

function FoodRow({
  food,
  unit,
  onPick,
  detail,
  action,
}: {
  food: FoodData | Food
  unit: EnergyUnit
  onPick: () => void
  detail?: string
  action?: React.ReactNode
}) {
  // Show energy per serving when there is one (that's what people eat), else per 100.
  const per = food.servingSize
    ? { kj: (food.per100.energyKj * food.servingSize) / 100, label: food.servingLabel ?? `${food.servingSize} ${food.baseUnit}` }
    : { kj: food.per100.energyKj, label: `100 ${food.baseUnit}` }
  return (
    <li className="flex items-center">
      <button type="button" onClick={onPick} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{food.name}</p>
          <p className="text-xs text-zinc-500 truncate">{[food.brand, detail].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm tabular-nums">
            {energyNumber(unit, per.kj)} <span className="text-zinc-500 text-xs">{energyLabel(unit)}</span>
          </p>
          <p className="text-[11px] text-zinc-500 max-w-28 truncate">per {per.label}</p>
        </div>
      </button>
      {action}
    </li>
  )
}

function ResultSection({
  title,
  foods,
  loading,
  error,
  empty,
  unit,
  onPick,
}: {
  title: string
  foods: Array<FoodData | Food> | undefined
  loading?: boolean
  error?: unknown
  empty?: string
  unit: EnergyUnit
  onPick: (f: FoodData | Food) => void
}) {
  if (!loading && !error && foods?.length === 0 && !empty) return null
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold flex items-center gap-2">
        {title} {loading && <Spinner className="size-3.5" />}
      </h2>
      <ErrorText error={error} />
      {foods && foods.length > 0 && (
        <Card>
          <ul className="divide-y divide-zinc-800/80">
            {foods.map((f) => (
              <FoodRow key={keyOf(f)} food={f} unit={unit} onPick={() => onPick(f)} />
            ))}
          </ul>
        </Card>
      )}
      {!loading && !error && foods?.length === 0 && empty && <p className="text-sm text-zinc-500">{empty}</p>}
    </section>
  )
}

function SearchResults({ query, unit, onPick }: { query: string; unit: EnergyUnit; onPick: (f: FoodData | Food) => void }) {
  const foods = useFoods()
  const usda = useUsdaSearch(query)
  const off = useOffSearch(query)

  // Saved foods matching every word typed, in name or brand.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const mine = (foods.data ?? []).filter((f) => {
    const hay = `${f.name} ${f.brand ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  // Hide search hits the user has already saved (they appear under "Your foods").
  const savedKeys = new Set((foods.data ?? []).map((f) => `${f.source}:${f.sourceId}`))
  const fresh = (list: FoodData[] | undefined) => list?.filter((f) => !savedKeys.has(`${f.source}:${f.sourceId}`))

  return (
    <div className="space-y-6">
      <ResultSection title="Your foods" foods={mine.slice(0, 10)} unit={unit} onPick={onPick} />
      <ResultSection
        title="Generic foods · USDA"
        foods={fresh(usda.data)}
        loading={usda.isFetching}
        error={usda.error}
        empty="No generic foods found."
        unit={unit}
        onPick={onPick}
      />
      <ResultSection
        title="Packaged foods · Open Food Facts"
        foods={fresh(off.data)}
        loading={off.isFetching}
        error={off.error}
        empty="No packaged foods found. Try fewer words, or scan the barcode."
        unit={unit}
        onPick={onPick}
      />
    </div>
  )
}

function RecentList({
  recents,
  loading,
  error,
  unit,
  onPick,
}: {
  recents: RecentFood[] | undefined
  loading: boolean
  error: unknown
  unit: EnergyUnit
  onPick: (f: Food) => void
}) {
  if (loading) return <Spinner className="size-5 text-zinc-500" />
  if (error) return <ErrorText error={error} />
  if (!recents?.length) {
    return <p className="text-sm text-zinc-500">Foods you log will show up here so you can add them again quickly.</p>
  }
  return (
    <Card>
      <ul className="divide-y divide-zinc-800/80">
        {recents.map((r) => (
          <FoodRow key={r.food.id} food={r.food} unit={unit} detail={sourceLabel(r.food.source)} onPick={() => onPick(r.food)} />
        ))}
      </ul>
    </Card>
  )
}

function MyFoods({ unit, onPick }: { unit: EnergyUnit; onPick: (f: Food) => void }) {
  const foods = useFoods()
  const archive = useArchiveFood()
  const [editing, setEditing] = useState<Food | null>(null)
  const [removing, setRemoving] = useState<Food | null>(null)
  const custom = (foods.data ?? []).filter((f) => f.source === 'custom')

  if (foods.isPending) return <Spinner className="size-5 text-zinc-500" />
  return (
    <>
      <ErrorText error={foods.error} />
      {custom.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Foods you create show up here: home recipes, or anything the databases don't have.
        </p>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-800/80">
            {custom.map((f) => (
              <FoodRow
                key={f.id}
                food={f}
                unit={unit}
                onPick={() => onPick(f)}
                action={
                  <div className="flex pr-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="px-2" onClick={() => setRemoving(f)} aria-label={`Remove ${f.name}`}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                }
              />
            ))}
          </ul>
        </Card>
      )}
      <FoodFormModal open={editing != null} food={editing} unit={unit} onClose={() => setEditing(null)} />
      <ConfirmModal
        open={removing != null}
        title="Remove food?"
        message={`“${removing?.name}” will be removed from your foods. Days you've already logged it keep their entries.`}
        confirmLabel="Remove"
        danger
        loading={archive.isPending}
        onConfirm={() => removing && archive.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
