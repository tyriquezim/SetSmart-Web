import { formatDuration, formatWeight, type PlannedSet, type WeightUnit } from '@setsmart/core'
import { Link, useParams } from 'react-router'
import { ClockIcon, PlayIcon } from '../components/icons'
import { StartWorkoutDialogs } from '../components/StartWorkoutDialogs'
import { Button, Card, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useRoutine, useWeightUnit } from '../hooks/data'
import { formatGoal } from '../lib/cardio'
import { useStartWorkout } from '../workout/useStartWorkout'

/** "3 × 10 @ 60 kg" when all sets match, otherwise "10 · 8 · 6". */
function summariseSets(sets: PlannedSet[], unit: WeightUnit): string {
  if (sets.length === 0) return 'No sets'
  const same = sets.every((s) => s.reps === sets[0].reps && s.weightKg === sets[0].weightKg)
  if (same) {
    const w = sets[0].weightKg != null ? ` @ ${formatWeight(unit, sets[0].weightKg)}` : ''
    return `${sets.length} × ${sets[0].reps}${w}`
  }
  return sets.map((s) => (s.weightKg != null ? `${s.reps}×${formatWeight(unit, s.weightKg)}` : `${s.reps}`)).join(' · ')
}

export function RoutineDetailPage() {
  const { id } = useParams()
  const routine = useRoutine(id)
  const unit = useWeightUnit()
  const starter = useStartWorkout()

  if (routine.isPending) return <LoadingBlock />
  if (routine.error) return <ErrorText error={routine.error} />
  const r = routine.data
  const totalSets = r.exercises.reduce((n, e) => n + e.sets.length, 0)
  const cardioCount = r.exercises.filter((e) => e.exercise.kind === 'cardio').length
  const parts = [
    `${r.exercises.length} ${r.exercises.length === 1 ? 'exercise' : 'exercises'}`,
    totalSets > 0 && `${totalSets} sets`,
    cardioCount > 0 && `${cardioCount} cardio`,
    r.notes,
  ].filter(Boolean)

  return (
    <>
      <Link to="/routines" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← Routines
      </Link>
      <div className="mt-3">
        <PageHeader
          title={r.name}
          subtitle={parts.join(' · ')}
          action={
            <Link to={`/routines/${r.id}/edit`}>
              <Button tabIndex={-1}>Edit</Button>
            </Link>
          }
        />
      </div>
      <StartWorkoutDialogs starter={starter} />
      <Button
        variant="primary"
        size="xl"
        className="w-full mb-6"
        onClick={() => starter.startRoutine(r.id)}
        loading={starter.startingId === r.id}
        disabled={totalSets === 0 && cardioCount === 0}
      >
        <PlayIcon className="size-5" /> Start workout
      </Button>
      <ol className="space-y-2">
        {r.exercises.map((e, i) => (
          <li key={i}>
            <Card className="p-4 flex items-center gap-3">
              <span className="size-7 shrink-0 grid place-items-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{e.exercise.name}</p>
                <p className="text-sm text-zinc-400">
                  {e.exercise.kind === 'cardio'
                    ? `Cardio · ${e.targetDurationS != null ? `Goal ${formatGoal(e.targetDurationS)}` : 'No goal'}`
                    : summariseSets(e.sets, unit)}
                </p>
              </div>
              {e.exercise.kind !== 'cardio' && (
                <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                  <ClockIcon className="size-3.5" />
                  {e.restSeconds ? formatDuration(e.restSeconds) : 'No rest'}
                </span>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </>
  )
}
