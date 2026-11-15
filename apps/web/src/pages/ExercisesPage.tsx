import type { Exercise } from '@setsmart/core'
import { useState } from 'react'
import { ExerciseFormModal } from '../components/ExerciseFormModal'
import { ExerciseList } from '../components/ExerciseList'
import { PlusIcon } from '../components/icons'
import { Button, ConfirmModal, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useArchiveExercise, useExercises } from '../hooks/data'

export function ExercisesPage() {
  const exercises = useExercises()
  const archive = useArchiveExercise()
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [removing, setRemoving] = useState<Exercise | null>(null)

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle={exercises.data ? `${exercises.data.length} exercises` : undefined}
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon className="size-4" /> New
          </Button>
        }
      />
      {exercises.isPending ? (
        <LoadingBlock />
      ) : exercises.error ? (
        <ErrorText error={exercises.error} />
      ) : (
        <ExerciseList
          exercises={exercises.data}
          renderAction={(e) =>
            e.ownerId && (
              <div className="flex shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(e)}>
                  Remove
                </Button>
              </div>
            )
          }
        />
      )}
      {editing && (
        <ExerciseFormModal
          key={editing === 'new' ? 'new' : editing.id}
          open
          exercise={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={removing != null}
        title="Remove exercise?"
        message={
          <>
            <strong>{removing?.name}</strong> will be hidden from your library. Past workouts and routines that use it
            are kept.
          </>
        }
        confirmLabel="Remove"
        danger
        loading={archive.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && archive.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </>
  )
}
