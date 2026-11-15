import { todayIsoDate } from '@gymbro/core'
import { Link } from 'react-router'
import { PlayIcon, PlusIcon } from '../components/icons'
import { SessionCard } from '../components/SessionCard'
import { StartWorkoutDialogs } from '../components/StartWorkoutDialogs'
import { Button, Card, ErrorText } from '../components/ui'
import { useBodyWeights, useProfile, useRoutines, useWeightUnit, useWorkoutSessions } from '../hooks/data'
import { formatBodyWeight } from '../lib/progress'
import { useNow } from '../hooks/useNow'
import { useStartWorkout } from '../workout/useStartWorkout'

function greeting(now: number): string {
  const h = new Date(now).getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const profile = useProfile()
  const routines = useRoutines()
  const sessions = useWorkoutSessions(20)
  const unit = useWeightUnit()
  const starter = useStartWorkout()
  const bodyWeights = useBodyWeights()
  const latestWeight = bodyWeights.data?.[bodyWeights.data.length - 1]
  const now = useNow(60_000)

  const weekAgo = now - 7 * 86_400_000
  const thisWeek = sessions.data?.filter((s) => Date.parse(s.startedAt) >= weekAgo).length ?? 0
  const name = profile.data?.displayName?.split(' ')[0]

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-zinc-400">{greeting(now)}{name ? `, ${name}` : ''}</p>
        <h1 className="text-3xl font-black tracking-tight mt-0.5">Ready to train?</h1>
      </div>

      <div className="grid sm:grid-cols-[2fr_1fr] gap-3 mb-6">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Last 7 days</p>
            <p className="text-3xl font-black tabular-nums mt-1">
              {thisWeek} <span className="text-base font-medium text-zinc-400">{thisWeek === 1 ? 'workout' : 'workouts'}</span>
            </p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => {
              const day = new Date(now)
              day.setHours(0, 0, 0, 0)
              day.setDate(day.getDate() - (6 - i))
              const next = day.getTime() + 86_400_000
              const trained = sessions.data?.some((s) => {
                const t = Date.parse(s.startedAt)
                return t >= day.getTime() && t < next
              })
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`size-3 rounded-full ${trained ? 'bg-accent' : 'bg-zinc-800'}`} />
                  <span className="text-[10px] text-zinc-600">{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                </div>
              )
            })}
          </div>
        </Card>
        <Link to="/progress" className="block group">
          <Card className="p-5 h-full group-hover:border-zinc-700">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Body weight</p>
            <p className="text-3xl font-black mt-1">{latestWeight ? formatBodyWeight(unit, latestWeight.weightKg) : '—'}</p>
            <p className="text-xs text-accent mt-1">{!latestWeight ? 'Log your weight →' : latestWeight.measuredOn === todayIsoDate() ? 'Logged today ✓' : 'Log today →'}</p>
          </Card>
        </Link>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Your routines</h2>
          <Link to="/routines/new" className="text-sm text-accent flex items-center gap-1">
            <PlusIcon className="size-4" /> New
          </Link>
        </div>
        <StartWorkoutDialogs starter={starter} />
        <ErrorText error={routines.error} />
        {routines.data?.length === 0 && (
          <Card className="p-5 text-sm text-zinc-400">
            You don't have any routines yet.{' '}
            <Link to="/routines/new" className="text-accent">
              Create one
            </Link>{' '}
            to get started.
          </Card>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {routines.data?.slice(0, 4).map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <Link to={`/routines/${r.id}`} className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.name}</p>
                <p className="text-xs text-zinc-500">{r.exerciseCount} exercises</p>
              </Link>
              <Button
                variant="primary"
                className="size-11 px-0 rounded-full"
                onClick={() => starter.startRoutine(r.id)}
                loading={starter.startingId === r.id}
                disabled={r.exerciseCount === 0}
                aria-label={`Start ${r.name}`}
              >
                {starter.startingId !== r.id && <PlayIcon className="size-5" />}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Recent workouts</h2>
          <Link to="/history" className="text-sm text-zinc-400 hover:text-zinc-100">
            See all
          </Link>
        </div>
        <ErrorText error={sessions.error} />
        {sessions.data?.length === 0 && <p className="text-sm text-zinc-500">No workouts logged yet.</p>}
        <div className="space-y-2">
          {sessions.data?.slice(0, 3).map((s) => <SessionCard key={s.id} session={s} unit={unit} />)}
        </div>
      </section>
    </>
  )
}
