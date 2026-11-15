import {
  formatDuration,
  toKg,
  weightInputValue,
  type Exercise,
  type PlannedSet,
  type Routine,
  type WeightUnit,
} from '@gymbro/core'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../components/ExercisePicker'
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, PlusIcon, TrashIcon } from '../components/icons'
import {
  Button,
  Card,
  ConfirmModal,
  ErrorText,
  Field,
  Input,
  LoadingBlock,
  NumberInput,
  PageHeader,
  Select,
} from '../components/ui'
import { useDeleteRoutine, useRoutine, useSaveRoutine, useWeightUnit } from '../hooks/data'
import { newId } from '../lib/id'

const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]
const DEFAULT_SETS: PlannedSet[] = [
  { reps: 10, weightKg: null },
  { reps: 10, weightKg: null },
  { reps: 10, weightKg: null },
]

interface DraftExercise {
  key: string
  exercise: Exercise
  restSeconds: number
  sets: PlannedSet[]
  notes: string | null
}

export function RoutineEditorPage() {
  const { id } = useParams()
  const routine = useRoutine(id)
  if (id && routine.isPending) return <LoadingBlock />
  if (id && routine.error) return <ErrorText error={routine.error} />
  return <RoutineEditor key={id ?? 'new'} initial={id ? routine.data : undefined} />
}

function RoutineEditor({ initial }: { initial?: Routine }) {
  const navigate = useNavigate()
  const unit = useWeightUnit()
  const save = useSaveRoutine()
  const del = useDeleteRoutine()
  const [name, setName] = useState(initial?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<DraftExercise[]>(
    () => initial?.exercises.map((e) => ({ ...e, key: newId() })) ?? [],
  )
  const [pickerKey, setPickerKey] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)

  const patch = (key: string, p: Partial<DraftExercise>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)))

  const move = (index: number, delta: number) =>
    setItems((xs) => {
      const j = index + delta
      if (j < 0 || j >= xs.length) return xs
      const next = [...xs]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setValidation(null)
    if (!name.trim()) return setValidation('Give your routine a name.')
    if (items.length === 0) return setValidation('Add at least one exercise.')
    if (items.some((i) => i.sets.length === 0)) return setValidation('Every exercise needs at least one set.')
    const routineId = await save.mutateAsync({
      id: initial?.id ?? null,
      name,
      notes,
      exercises: items.map(({ exercise, restSeconds, sets, notes }) => ({
        exerciseId: exercise.id,
        restSeconds,
        sets,
        notes,
      })),
    })
    navigate(`/routines/${routineId}`, { replace: true })
  }

  return (
    <form onSubmit={(e) => onSubmit(e).catch(() => {})}>
      <PageHeader title={initial ? 'Edit routine' : 'New routine'} />
      <div className="space-y-4">
        <Card className="p-4 space-y-4">
          <Field label="Name">
            {(id) => (
              <Input id={id} placeholder="e.g. Push day" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Field label="Notes (optional)">
            {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </Card>

        {items.map((item, index) => (
          <ExerciseEditor
            key={item.key}
            item={item}
            index={index}
            count={items.length}
            unit={unit}
            onChange={(p) => patch(item.key, p)}
            onMove={(d) => move(index, d)}
            onRemove={() => setItems((xs) => xs.filter((x) => x.key !== item.key))}
          />
        ))}

        <Button size="lg" className="w-full border border-dashed border-zinc-700 bg-transparent" onClick={() => setPickerKey(Date.now())}>
          <PlusIcon className="size-5" /> Add exercises
        </Button>

        <ErrorText error={validation ?? save.error} />

        <div className="flex gap-2 justify-between pt-2">
          {initial ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              Save routine
            </Button>
          </div>
        </div>
      </div>

      {pickerKey != null && (
        <ExercisePicker
          key={pickerKey}
          open
          onClose={() => setPickerKey(null)}
          onPick={(picked) =>
            setItems((xs) => [
              ...xs,
              ...picked.map((exercise) => ({
                key: newId(),
                exercise,
                restSeconds: 90,
                sets: DEFAULT_SETS.map((s) => ({ ...s })),
                notes: null,
              })),
            ])
          }
        />
      )}
      {initial && (
        <ConfirmModal
          open={confirmDelete}
          title="Delete routine?"
          message={
            <>
              <strong>{initial.name}</strong> will be deleted. Workouts you've logged with it stay in your history.
            </>
          }
          confirmLabel="Delete"
          danger
          loading={del.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => del.mutate(initial.id, { onSuccess: () => navigate('/routines', { replace: true }) })}
        />
      )}
    </form>
  )
}

function ExerciseEditor({
  item,
  index,
  count,
  unit,
  onChange,
  onMove,
  onRemove,
}: {
  item: DraftExercise
  index: number
  count: number
  unit: WeightUnit
  onChange: (p: Partial<DraftExercise>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const setSet = (i: number, p: Partial<PlannedSet>) =>
    onChange({ sets: item.sets.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  const restOptions = REST_PRESETS.includes(item.restSeconds)
    ? REST_PRESETS
    : [...REST_PRESETS, item.restSeconds].sort((a, b) => a - b)

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="size-7 shrink-0 grid place-items-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{item.exercise.name}</p>
          <p className="text-xs text-zinc-500">
            {item.exercise.muscleGroup} · {item.exercise.equipment}
          </p>
        </div>
        <div className="flex shrink-0 -mr-2">
          <Button variant="ghost" size="sm" className="px-2" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUpIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDownIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2" onClick={onRemove} aria-label={`Remove ${item.exercise.name}`}>
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 items-center text-xs text-zinc-500 uppercase tracking-wider mb-1 px-1">
        <span>Set</span>
        <span className="text-center">Reps</span>
        <span className="text-center">Weight ({unit})</span>
        <span />
      </div>
      <div className="space-y-2">
        {item.sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 items-center">
            <span className="text-sm font-semibold text-zinc-400 pl-1">{i + 1}</span>
            <NumberInput
              aria-label={`Set ${i + 1} reps`}
              decimals={false}
              min={0}
              value={s.reps}
              onChange={(v) => setSet(i, { reps: Math.max(0, Math.round(v ?? 0)) })}
              className="h-10"
            />
            <NumberInput
              aria-label={`Set ${i + 1} weight`}
              allowEmpty
              min={0}
              placeholder="—"
              value={weightInputValue(unit, s.weightKg)}
              onChange={(v) => setSet(i, { weightKg: v == null ? null : toKg(unit, Math.max(0, v)) })}
              className="h-10"
            />
            <button
              type="button"
              className="size-8 grid place-items-center rounded-lg text-zinc-500 hover:text-red-300 hover:bg-zinc-800 disabled:opacity-30"
              onClick={() => onChange({ sets: item.sets.filter((_, j) => j !== i) })}
              disabled={item.sets.length === 1}
              aria-label={`Remove set ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({ sets: [...item.sets, { ...(item.sets[item.sets.length - 1] ?? { reps: 10, weightKg: null }) }] })}
        >
          <PlusIcon className="size-4" /> Add set
        </Button>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <ClockIcon className="size-4" />
          Rest
          <Select
            value={item.restSeconds}
            onChange={(e) => onChange({ restSeconds: Number(e.target.value) })}
            className="h-9 w-24 text-sm"
            aria-label={`Rest time for ${item.exercise.name}`}
          >
            {restOptions.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? 'None' : formatDuration(s)}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </Card>
  )
}
