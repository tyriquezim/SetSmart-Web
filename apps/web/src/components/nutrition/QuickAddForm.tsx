import { MEALS, roundNutrients, toKj, type EnergyUnit, type Meal, type Nutrients } from '@setsmart/core'
import { useState, type ReactNode } from 'react'
import { energyLabel } from '../../lib/nutrition'
import { Button, ErrorText, Field, Input, NumberInput, Select } from '../ui'

/**
 * Log (or edit) raw numbers without a food: a name, energy and optional macros.
 * Energy is typed in the user's unit and stored in kJ.
 */
export function QuickAddForm({
  initial,
  unit,
  saving,
  error,
  submitLabel,
  onSubmit,
  extraActions,
}: {
  initial: { name: string; meal: Meal; energy: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }
  unit: EnergyUnit
  saving: boolean
  error: unknown
  submitLabel: string
  onSubmit: (v: { name: string; meal: Meal; nutrients: Nutrients }) => void
  extraActions?: ReactNode
}) {
  const [name, setName] = useState(initial.name)
  const [meal, setMeal] = useState<Meal>(initial.meal)
  const [energy, setEnergy] = useState<number | null>(initial.energy)
  const [protein, setProtein] = useState<number | null>(initial.proteinG)
  const [carbs, setCarbs] = useState<number | null>(initial.carbsG)
  const [fat, setFat] = useState<number | null>(initial.fatG)
  const valid = energy != null && energy >= 0 && [protein, carbs, fat].every((v) => v == null || v >= 0)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          name: name.trim() || 'Quick add',
          meal,
          nutrients: roundNutrients({
            energyKj: toKj(unit, energy),
            proteinG: protein ?? 0,
            carbsG: carbs ?? 0,
            fatG: fat ?? 0,
          }),
        })
      }}
    >
      <Field label="Description" hint="Optional, e.g. “Café lunch”">
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Quick add" maxLength={200} />}
      </Field>
      <Field label={`Energy (${energyLabel(unit)})`}>
        {(id) => <NumberInput id={id} value={energy} onChange={setEnergy} allowEmpty min={0} className="text-left" required autoFocus />}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['Protein (g)', protein, setProtein],
            ['Carbs (g)', carbs, setCarbs],
            ['Fat (g)', fat, setFat],
          ] as const
        ).map(([label, value, set]) => (
          <Field key={label} label={label}>
            {(id) => <NumberInput id={id} value={value} onChange={set} allowEmpty min={0} placeholder="—" />}
          </Field>
        ))}
      </div>
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
        <Button type="submit" variant="primary" loading={saving} disabled={!valid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
