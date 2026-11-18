import {
  CARDIO_ACTIVITIES,
  CARDIO_ACTIVITY_ORDER,
  COMPENDIUM_URL,
  EQUIPMENT,
  MUSCLE_GROUPS,
  type CardioActivity,
  type Exercise,
  type ExerciseInput,
  type ExerciseKind,
} from '@setsmart/core'
import { useState, type FormEvent } from 'react'
import { useCreateExercise, useUpdateExercise } from '../hooks/data'
import { Button, ErrorText, Field, Input, Modal, NumberInput, Segmented, Select } from './ui'

/**
 * Create a custom exercise, or edit one when `exercise` is given. Mount with a `key` to reset.
 * An exercise's type (weights or cardio) can't be changed once it exists, so past workouts stay consistent.
 */
export function ExerciseFormModal({
  open,
  exercise,
  initialName = '',
  initialKind = 'weights',
  onClose,
  onSaved,
}: {
  open: boolean
  exercise?: Exercise
  initialName?: string
  initialKind?: ExerciseKind
  onClose: () => void
  onSaved?: (exercise: Exercise) => void
}) {
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? initialKind)
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [muscleGroup, setMuscleGroup] = useState(exercise?.kind === 'weights' ? exercise.muscleGroup : MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState(exercise?.kind === 'weights' ? exercise.equipment : EQUIPMENT[0])
  const [activity, setActivity] = useState<CardioActivity>(exercise?.cardioActivity ?? 'run')
  const [met, setMet] = useState<number | null>(exercise?.cardioMet ?? null)
  const create = useCreateExercise()
  const update = useUpdateExercise()
  const mutation = exercise ? update : create
  const metOk = kind !== 'cardio' || activity !== 'other' || met == null || (met >= 1 && met <= 25)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!metOk) return
    const input: ExerciseInput =
      kind === 'cardio'
        ? { kind, name, cardioActivity: activity, cardioMet: activity === 'other' ? met : null }
        : { kind, name, muscleGroup, equipment }
    const saved = exercise ? await update.mutateAsync({ id: exercise.id, input }) : await create.mutateAsync(input)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={exercise ? 'Edit exercise' : kind === 'cardio' ? 'New cardio exercise' : 'New exercise'}>
      <form onSubmit={(e) => onSubmit(e).catch(() => {})} className="space-y-4">
        {!exercise && (
          <Segmented<ExerciseKind>
            label="Exercise type"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'weights', label: 'Weights' },
              { value: 'cardio', label: 'Cardio' },
            ]}
          />
        )}
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={100}
              autoFocus
              placeholder={kind === 'cardio' ? 'e.g. Kayaking' : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        {kind === 'weights' ? (
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
        ) : (
          <>
            <Field label="Counts as" hint="Used to estimate the energy it burns.">
              {(id) => (
                <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value as CardioActivity)}>
                  {CARDIO_ACTIVITY_ORDER.map((a) => (
                    <option key={a} value={a}>
                      {a === 'other' ? 'Something else' : CARDIO_ACTIVITIES[a].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {activity === 'other' && (
              <Field label="MET value (optional)" hint="Needed for an energy estimate.">
                {(id) => (
                  <>
                    <NumberInput id={id} allowEmpty min={1} max={25} value={met} onChange={setMet} placeholder="e.g. 5.0" />
                    <p className="text-xs text-zinc-500 mt-1.5">
                      Look up your activity in the{' '}
                      <a href={COMPENDIUM_URL} target="_blank" rel="noreferrer" className="text-accent">
                        Compendium of Physical Activities
                      </a>{' '}
                      and enter its MET value.
                    </p>
                    {!metOk && <p className="text-xs text-red-300 mt-1.5">Enter a MET value between 1 and 25.</p>}
                  </>
                )}
              </Field>
            )}
          </>
        )}
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
          <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!metOk}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
