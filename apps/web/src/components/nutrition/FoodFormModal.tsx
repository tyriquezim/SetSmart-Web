import { kjTo, toKj, type BaseUnit, type EnergyUnit, type Food, type FoodData } from '@setsmart/core'
import { useState } from 'react'
import { useCreateFood, useUpdateFood } from '../../hooks/data'
import { energyLabel } from '../../lib/nutrition'
import { Button, ErrorText, Field, Input, Modal, NumberInput, Segmented } from '../ui'

type Basis = '100' | 'serving'

export function FoodFormModal({
  open,
  food,
  initialBarcode,
  initialName,
  unit,
  onClose,
  onSaved,
}: {
  open: boolean
  /** Edit this food; omit to create a new one */
  food?: Food | null
  initialBarcode?: string | null
  initialName?: string
  unit: EnergyUnit
  onClose: () => void
  onSaved?: (food: Food) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={food ? 'Edit food' : 'New food'}>
      {open && (
        <FoodForm
          food={food ?? null}
          initialBarcode={initialBarcode ?? null}
          initialName={initialName ?? ''}
          unit={unit}
          onSaved={(f) => {
            onSaved?.(f)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}

function FoodForm({
  food,
  initialBarcode,
  initialName,
  unit,
  onSaved,
}: {
  food: Food | null
  initialBarcode: string | null
  initialName: string
  unit: EnergyUnit
  onSaved: (food: Food) => void
}) {
  const create = useCreateFood()
  const update = useUpdateFood()
  const [name, setName] = useState(food?.name ?? initialName)
  const [brand, setBrand] = useState(food?.brand ?? '')
  const [barcode, setBarcode] = useState(food?.barcode ?? initialBarcode ?? '')
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(food?.baseUnit ?? 'g')
  const [servingSize, setServingSize] = useState<number | null>(food?.servingSize ?? null)
  const [servingLabel, setServingLabel] = useState(food?.servingLabel ?? '')
  const [basis, setBasis] = useState<Basis>('100')
  const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)
  const [energy, setEnergy] = useState<number | null>(food ? Math.round(kjTo(unit, food.per100.energyKj)) : null)
  const [protein, setProtein] = useState<number | null>(r1(food?.per100.proteinG ?? null))
  const [carbs, setCarbs] = useState<number | null>(r1(food?.per100.carbsG ?? null))
  const [fat, setFat] = useState<number | null>(r1(food?.per100.fatG ?? null))

  const needsServing = basis === 'serving' && !(servingSize && servingSize > 0)
  const valid = name.trim().length > 0 && energy != null && energy >= 0 && !needsServing
  const saving = create.isPending || update.isPending

  // Switching the basis rescales whatever has been typed, so nothing is lost.
  const changeBasis = (next: Basis) => {
    if (next === basis || !servingSize) return setBasis(next)
    const f = next === 'serving' ? servingSize / 100 : 100 / servingSize
    const scale = (v: number | null, d = 10) => (v == null ? null : Math.round(v * f * d) / d)
    setEnergy(scale(energy, 1))
    setProtein(scale(protein))
    setCarbs(scale(carbs))
    setFat(scale(fat))
    setBasis(next)
  }

  const submit = () => {
    if (!valid) return
    const toPer100 = (v: number | null) => (v == null ? null : basis === 'serving' ? (v * 100) / servingSize! : v)
    const input: FoodData = {
      source: 'custom',
      sourceId: null,
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.replace(/\s/g, '') || null,
      baseUnit,
      per100: {
        energyKj: toKj(unit, toPer100(energy)!),
        proteinG: toPer100(protein),
        carbsG: toPer100(carbs),
        fatG: toPer100(fat),
      },
      servingSize: servingSize && servingSize > 0 ? servingSize : null,
      servingLabel: servingLabel.trim() || null,
    }
    if (food) update.mutate({ id: food.id, input }, { onSuccess: onSaved })
    else create.mutate(input, { onSuccess: onSaved })
  }

  const per = basis === '100' ? `per 100 ${baseUnit}` : 'per serving'

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand">{(id) => <Input id={id} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional" />}</Field>
        <Field label="Barcode">
          {(id) => <Input id={id} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" inputMode="numeric" />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-zinc-300">Measured in</span>
        <Segmented<BaseUnit>
          label="Measured in"
          value={baseUnit}
          onChange={setBaseUnit}
          options={[
            { value: 'g', label: 'grams' },
            { value: 'ml', label: 'millilitres' },
          ]}
        />
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Field label={`Serving (${baseUnit})`}>
          {(id) => <NumberInput id={id} value={servingSize} onChange={setServingSize} allowEmpty min={0} placeholder="—" />}
        </Field>
        <Field label="Serving name">
          {(id) => <Input id={id} value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 slice" />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-sm font-semibold">Nutrition</span>
        <Segmented<Basis>
          label="Nutrition values are"
          value={basis}
          onChange={changeBasis}
          options={[
            { value: '100', label: `per 100 ${baseUnit}` },
            { value: 'serving', label: 'per serving' },
          ]}
        />
      </div>
      {needsServing && <p className="text-xs text-amber-300 -mt-2">Enter the serving size above to use per-serving values.</p>}
      <Field label={`Energy (${energyLabel(unit)}, ${per})`}>
        {(id) => <NumberInput id={id} value={energy} onChange={setEnergy} allowEmpty min={0} className="text-left" required />}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein (g)">{(id) => <NumberInput id={id} value={protein} onChange={setProtein} allowEmpty min={0} placeholder="—" />}</Field>
        <Field label="Carbs (g)">{(id) => <NumberInput id={id} value={carbs} onChange={setCarbs} allowEmpty min={0} placeholder="—" />}</Field>
        <Field label="Fat (g)">{(id) => <NumberInput id={id} value={fat} onChange={setFat} allowEmpty min={0} placeholder="—" />}</Field>
      </div>

      <ErrorText error={create.error ?? update.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving} disabled={!valid}>
          {food ? 'Save' : 'Create food'}
        </Button>
      </div>
    </form>
  )
}
