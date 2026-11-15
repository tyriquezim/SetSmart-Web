import { kjTo, type EnergyUnit, type FoodData, type FoodLogEntry } from '@setsmart/core'
import { useDeleteFoodLog, useUpdateFoodLog } from '../../hooks/data'
import { TrashIcon } from '../icons'
import { Button, Modal } from '../ui'
import { AmountForm } from './LogFoodModal'
import { QuickAddForm } from './QuickAddForm'

/**
 * Rebuild per-100 values from an entry's own snapshot, so the amount can be
 * changed even if the original food was edited or deleted since.
 */
function foodFromEntry(e: FoodLogEntry): FoodData | null {
  if (e.amount == null || e.amountUnit == null || e.grams == null || e.grams <= 0) return null
  const f = 100 / e.grams
  return {
    source: 'custom',
    sourceId: null,
    name: e.name,
    brand: e.brand,
    barcode: null,
    baseUnit: e.amountUnit === 'ml' ? 'ml' : 'g',
    per100: { energyKj: e.energyKj * f, proteinG: e.proteinG * f, carbsG: e.carbsG * f, fatG: e.fatG * f },
    servingSize: e.amountUnit === 'serving' ? e.grams / e.amount : null,
    servingLabel: null,
  }
}

export function EditEntryModal({ entry, unit, onClose }: { entry: FoodLogEntry | null; unit: EnergyUnit; onClose: () => void }) {
  const update = useUpdateFoodLog()
  const remove = useDeleteFoodLog()
  const food = entry ? foodFromEntry(entry) : null

  const deleteButton = entry && (
    <Button
      variant="danger"
      className="mr-auto"
      loading={remove.isPending}
      onClick={() => remove.mutate(entry.id, { onSuccess: onClose })}
    >
      <TrashIcon className="size-4" /> Delete
    </Button>
  )
  const saved = { onSuccess: onClose }

  return (
    <Modal open={entry != null} onClose={onClose} title="Edit entry">
      {entry && (
        <>
          {food ? (
            <>
              <div className="mb-4">
                <p className="font-semibold">{entry.name}</p>
                {entry.brand && <p className="text-xs text-zinc-500">{entry.brand}</p>}
              </div>
              <AmountForm
                key={entry.id}
                food={food}
                initialAmount={entry.amount!}
                initialUnit={entry.amountUnit!}
                initialMeal={entry.meal}
                unit={unit}
                saving={update.isPending}
                error={update.error ?? remove.error}
                submitLabel="Save"
                extraActions={deleteButton}
                onSubmit={(v) =>
                  update.mutate(
                    { id: entry.id, patch: { amount: v.amount, amountUnit: v.amountUnit, grams: v.grams, meal: v.meal, ...v.nutrients } },
                    saved,
                  )
                }
              />
            </>
          ) : (
            <QuickAddForm
              key={entry.id}
              initial={{
                name: entry.name,
                meal: entry.meal,
                energy: Math.round(kjTo(unit, entry.energyKj)),
                proteinG: entry.proteinG || null,
                carbsG: entry.carbsG || null,
                fatG: entry.fatG || null,
              }}
              unit={unit}
              saving={update.isPending}
              error={update.error ?? remove.error}
              submitLabel="Save"
              extraActions={deleteButton}
              onSubmit={(v) => update.mutate({ id: entry.id, patch: { name: v.name, meal: v.meal, ...v.nutrients } }, saved)}
            />
          )}
        </>
      )}
    </Modal>
  )
}
