import { useState } from 'react'
import { Link } from 'react-router'
import { SessionCard } from '../components/SessionCard'
import { Button, EmptyState, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useWeightUnit, useWorkoutSessions } from '../hooks/data'

const PAGE = 20

export function HistoryPage() {
  const [limit, setLimit] = useState(PAGE)
  const sessions = useWorkoutSessions(limit)
  const unit = useWeightUnit()

  return (
    <>
      <PageHeader title="History" />
      {sessions.isPending ? (
        <LoadingBlock />
      ) : sessions.error ? (
        <ErrorText error={sessions.error} />
      ) : sessions.data.length === 0 ? (
        <EmptyState title="No workouts logged yet">
          <p>Finish a workout and it'll show up here.</p>
          <Link to="/routines">
            <Button variant="primary" tabIndex={-1}>Start one</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {sessions.data.map((s) => (
              <li key={s.id}>
                <SessionCard session={s} unit={unit} />
              </li>
            ))}
          </ul>
          {sessions.data.length >= limit && (
            <Button className="w-full mt-4" loading={sessions.isFetching} onClick={() => setLimit((l) => l + PAGE)}>
              Load more
            </Button>
          )}
        </>
      )}
    </>
  )
}
