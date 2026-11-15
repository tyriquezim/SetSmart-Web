import { Link } from 'react-router'
import { PlayIcon, PlusIcon } from '../components/icons'
import { StartWorkoutDialogs } from '../components/StartWorkoutDialogs'
import { Button, Card, EmptyState, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useRoutines } from '../hooks/data'
import { useStartWorkout } from '../workout/useStartWorkout'

export function RoutinesPage() {
  const routines = useRoutines()
  const starter = useStartWorkout()

  return (
    <>
      <PageHeader
        title="Routines"
        action={
          <div className="flex gap-2">
            <Link to="/exercises" className="md:hidden">
              <Button variant="ghost" tabIndex={-1}>Exercises</Button>
            </Link>
            <Link to="/routines/new">
              <Button variant="primary" tabIndex={-1}>
                <PlusIcon className="size-4" /> New
              </Button>
            </Link>
          </div>
        }
      />
      <StartWorkoutDialogs starter={starter} />
      {routines.isPending ? (
        <LoadingBlock />
      ) : routines.error ? (
        <ErrorText error={routines.error} />
      ) : routines.data.length === 0 ? (
        <EmptyState title="No routines yet">
          <p>Build a routine from exercises in the order you want to do them.</p>
          <Link to="/routines/new">
            <Button variant="primary" tabIndex={-1}>Create your first routine</Button>
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3 mt-3">
          {routines.data.map((r) => (
            <li key={r.id}>
              <Card className="p-4 flex items-center gap-3">
                <Link to={`/routines/${r.id}`} className="min-w-0 flex-1 group">
                  <p className="font-semibold truncate group-hover:text-accent">{r.name}</p>
                  <p className="text-sm text-zinc-500 truncate">
                    {r.exerciseCount} {r.exerciseCount === 1 ? 'exercise' : 'exercises'}
                    {r.notes && ` · ${r.notes}`}
                  </p>
                </Link>
                <Button
                  variant="primary"
                  onClick={() => starter.startRoutine(r.id)}
                  loading={starter.startingId === r.id}
                  disabled={r.exerciseCount === 0}
                  aria-label={`Start ${r.name}`}
                >
                  <PlayIcon className="size-4" /> Start
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
