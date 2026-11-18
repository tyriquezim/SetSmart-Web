import type { Exercise, ExerciseKind } from '@setsmart/core'
import { useState } from 'react'
import { useExercises } from '../hooks/data'
import { ExerciseFormModal } from './ExerciseFormModal'
import { ExerciseList } from './ExerciseList'
import { Button, ErrorText, LoadingBlock, Modal } from './ui'

/** Modal to pick one or more exercises (in tap order). Mount with a `key` to reset selection. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (exercises: Exercise[]) => void
}) {
  const exercises = useExercises()
  const [selected, setSelected] = useState<Exercise[]>([])
  const [creating, setCreating] = useState<{ name: string; kind: ExerciseKind } | null>(null)

  const toggle = (e: Exercise) =>
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]))

  return (
    <>
      <Modal
        open={open && creating == null}
        onClose={onClose}
        title="Add exercises"
        footer={
          <Button
            variant="primary"
            disabled={selected.length === 0}
            onClick={() => {
              onPick(selected)
              onClose()
            }}
          >
            Add {selected.length || ''} {selected.length === 1 ? 'exercise' : 'exercises'}
          </Button>
        }
      >
        {exercises.isPending ? (
          <LoadingBlock />
        ) : exercises.error ? (
          <ErrorText error={exercises.error} />
        ) : (
          <ExerciseList
            exercises={exercises.data}
            onSelect={toggle}
            isSelected={(e) => selected.some((x) => x.id === e.id)}
            footer={(query, kind) => (
              <Button variant="ghost" className="w-full" onClick={() => setCreating({ name: query, kind })}>
                + Create {query.trim() ? `“${query.trim()}”` : kind === 'cardio' ? 'a custom cardio exercise' : 'a custom exercise'}
              </Button>
            )}
          />
        )}
      </Modal>
      {creating != null && (
        <ExerciseFormModal
          open
          initialName={creating.name}
          initialKind={creating.kind}
          onClose={() => setCreating(null)}
          onSaved={(e) => setSelected((s) => [...s, e])}
        />
      )}
    </>
  )
}
