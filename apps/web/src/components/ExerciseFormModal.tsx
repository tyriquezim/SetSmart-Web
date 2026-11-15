import { EQUIPMENT, MUSCLE_GROUPS, type Exercise } from '@setsmart/core'
import { useState, type FormEvent } from 'react'
import { useCreateExercise, useUpdateExercise } from '../hooks/data'
import { Button, ErrorText, Field, Input, Modal, Select } from './ui'

/** Create a custom exercise, or edit one when `exercise` is given. Mount with a `key` to reset. */
export function ExerciseFormModal({
  open,
  exercise,
  initialName = '',
  onClose,
  onSaved,
}: {
  open: boolean
  exercise?: Exercise
  initialName?: string
  onClose: () => void
  onSaved?: (exercise: Exercise) => void
}) {
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscleGroup ?? MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState(exercise?.equipment ?? EQUIPMENT[0])
  const create = useCreateExercise()
  const update = useUpdateExercise()
  const mutation = exercise ? update : create

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { name, muscleGroup, equipment }
    const saved = exercise ? await update.mutateAsync({ id: exercise.id, input }) : await create.mutateAsync(input)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={exercise ? 'Edit exercise' : 'New exercise'}>
      <form onSubmit={(e) => onSubmit(e).catch(() => {})} className="space-y-4">
        <Field label="Name">
          {(id) => <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Muscle group">
            {(id) => (
              <Select id={id} value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}>
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Equipment">
            {(id) => (
              <Select id={id} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                {EQUIPMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <ErrorText
          error={
            mutation.error?.message.includes('duplicate')
              ? 'You already have an exercise with that name.'
              : mutation.error
          }
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
