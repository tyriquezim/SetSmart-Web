import {
  gramsFor,
  MEALS,
  nutrientsFor,
  type AmountUnit,
  type EnergyUnit,
  type Food,
  type FoodData,
  type Meal,
  type Nutrients,
} from '@setsmart/core'
import { useState } from 'react'
import { energyLabel, energyNumber, grams, sourceLabel } from '../../lib/nutrition'
import { Button, ErrorText, Field, Modal, NumberInput, Segmented, Select } from '../ui'

/** Energy + macros for an amount, as a compact row of figures. */
export function NutrientFigures({ n, unit }: { n: Nutrients; unit: EnergyUnit }) {
  const items = [
    { label: energyLabel(unit), value: energyNumber(unit, n.energyKj) },
    { label: 'Protein', value: `${grams(n.proteinG)} g` },
    { label: 'Carbs', value: `${grams(n.carbsG)} g` },
    { label: 'Fat', value: `${grams(n.fatG)} g` },
  ]
  return (
    <dl className="grid grid-cols-4 gap-2 rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-center">
      {items.map((i) => (
        <div key={i.label}>
          <dd className="font-semibold tabular-nums">{i.value}</dd>
          <dt className="text-[11px] text-zinc-500">{i.label}</dt>
        </div>
      ))}
    </dl>
  )
}

/**
 * Pick an amount and meal for a food, preview its nutrients and save.
 * Shared by "add food" and by editing an amount-based log entry.
 */
export function AmountForm({
  food,
  initialAmount,
  initialUnit,
  initialMeal,
  unit,
  saving,
  error,
  submitLabel,
  onSubmit,
  extraActions,
}: {
  food: FoodData
  initialAmount: number
  initialUnit: AmountUnit
  initialMeal: Meal
  unit: EnergyUnit
  saving: boolean
  error: unknown
  submitLabel: string
  onSubmit: (v: { amount: number; amountUnit: AmountUnit; grams: number; meal: Meal; nutrients: Nutrients }) => void
  extraActions?: React.ReactNode
}) {
  const [amount, setAmount] = useState<number | null>(initialAmount)
  const [amountUnit, setAmountUnit] = useState<AmountUnit>(initialUnit)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const g = amount != null ? gramsFor(food, amount, amountUnit) : null
  const nutrients = nutrientsFor(food, g ?? 0)

  const unitOptions: Array<{ value: AmountUnit; label: string }> = [{ value: food.baseUnit, label: food.baseUnit }]
  if (food.servingSize) unitOptions.push({ value: 'serving', label: 'servings' })

  const switchUnit = (next: AmountUnit) => {
    // Keep the same quantity of food when flipping between grams and servings.
    if (food.servingSize && amount != null && next !== amountUnit) {
      setAmount(
        next === 'serving'
          ? Math.round((amount / food.servingSize) * 100) / 100
          : Math.round(amount * food.servingSize),
      )
    }
    setAmountUnit(next)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (amount != null && g != null) onSubmit({ amount, amountUnit, grams: Math.round(g * 10) / 10, meal, nutrients })
      }}
    >
      <div className="flex items-end gap-3">
        <Field label="Amount">
          {(id) => (
            <NumberInput id={id} value={amount} onChange={setAmount} allowEmpty min={0} className="w-28 text-lg font-semibold" autoFocus />
          )}
        </Field>
        {unitOptions.length > 1 ? (
          <Segmented<AmountUnit> label="Amount unit" value={amountUnit} options={unitOptions} onChange={switchUnit} />
        ) : (
          <span className="pb-3 text-zinc-400">{food.baseUnit}</span>
        )}
      </div>
      {food.servingSize && (
        <p className="text-xs text-zinc-500 -mt-2">
          1 serving = {food.servingSize} {food.baseUnit}
          {food.servingLabel ? ` (${food.servingLabel})` : ''}
          {amountUnit === 'serving' && g != null && ` · ${Math.round(g)} ${food.baseUnit} total`}
        </p>
      )}

      <NutrientFigures n={nutrients} unit={unit} />

      <Field label="Meal">
        {(id) => (
          <Select id={id} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <ErrorText error={error} />
      <div className="flex gap-2 justify-end">
        {extraActions}
        <Button type="submit" variant="primary" loading={saving} disabled={g == null}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function FoodTitle({ food }: { food: FoodData | Food }) {
  return (
    <div className="mb-4">
      <p className="font-semibold">{food.name}</p>
      <p className="text-xs text-zinc-500">
        {[food.brand, sourceLabel(food.source)].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

export function LogFoodModal({
  food,
  initial,
  meal,
  unit,
  saving,
  error,
  onClose,
  onLog,
}: {
  food: FoodData | Food | null
  initial: { amount: number; unit: AmountUnit } | null
  meal: Meal
  unit: EnergyUnit
  saving: boolean
  error: unknown
  onClose: () => void
  onLog: (v: { amount: number; amountUnit: AmountUnit; grams: number; meal: Meal; nutrients: Nutrients }) => void
}) {
  return (
    <Modal open={food != null} onClose={onClose} title="Add food">
      {food && initial && (
        <>
          <FoodTitle food={food} />
          <AmountForm
            // Remount for each food so the form starts from that food's defaults.
            key={'id' in food ? food.id : `${food.source}:${food.sourceId}`}
            food={food}
            initialAmount={initial.amount}
            initialUnit={initial.unit}
            initialMeal={meal}
            unit={unit}
            saving={saving}
            error={error}
            submitLabel="Add"
            onSubmit={onLog}
          />
        </>
      )}
    </Modal>
  )
}
