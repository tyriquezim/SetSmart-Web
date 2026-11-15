import { kjTo, toKj, type EnergyUnit, type NutritionTargets } from '@setsmart/core'
import { useState } from 'react'
import { useSaveNutritionTargets } from '../../hooks/data'
import { energyLabel } from '../../lib/nutrition'
import { Button, ErrorText, Field, Modal, NumberInput } from '../ui'

export function TargetsModal({
  open,
  targets,
  unit,
  onClose,
}: {
  open: boolean
  targets: NutritionTargets
  unit: EnergyUnit
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Daily targets">
      {/* Mount fresh on each open so the fields start from the saved values. */}
      {open && <TargetsForm targets={targets} unit={unit} onDone={onClose} />}
    </Modal>
  )
}

function TargetsForm({ targets, unit, onDone }: { targets: NutritionTargets; unit: EnergyUnit; onDone: () => void }) {
  const save = useSaveNutritionTargets()
  const [energy, setEnergy] = useState(targets.energyKj != null ? Math.round(kjTo(unit, targets.energyKj)) : null)
  const [protein, setProtein] = useState(targets.proteinG)
  const [carbs, setCarbs] = useState(targets.carbsG)
  const [fat, setFat] = useState(targets.fatG)

  // Energy implied by the macro targets (17 kJ/g protein and carbs, 37 kJ/g fat).
  const macroKj = protein != null && carbs != null && fat != null ? protein * 17 + carbs * 17 + fat * 37 : null

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(
          { energyKj: energy != null ? toKj(unit, energy) : null, proteinG: protein, carbsG: carbs, fatG: fat },
          { onSuccess: onDone },
        )
      }}
    >
      <p className="text-sm text-zinc-400">Leave any field empty to not track a target for it.</p>
      <Field label={`Energy (${energyLabel(unit)})`}>
        {(id) => <NumberInput id={id} value={energy} onChange={setEnergy} allowEmpty min={0} className="text-left" placeholder="—" />}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein (g)">{(id) => <NumberInput id={id} value={protein} onChange={setProtein} allowEmpty min={0} placeholder="—" />}</Field>
        <Field label="Carbs (g)">{(id) => <NumberInput id={id} value={carbs} onChange={setCarbs} allowEmpty min={0} placeholder="—" />}</Field>
        <Field label="Fat (g)">{(id) => <NumberInput id={id} value={fat} onChange={setFat} allowEmpty min={0} placeholder="—" />}</Field>
      </div>
      {macroKj != null && (
        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            These macros add up to about {Math.round(kjTo(unit, macroKj)).toLocaleString()} {energyLabel(unit)}.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setEnergy(Math.round(kjTo(unit, macroKj)))}>
            Use this
          </Button>
        </div>
      )}
      <ErrorText error={save.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save targets
        </Button>
      </div>
    </form>
  )
}
