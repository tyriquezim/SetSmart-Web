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
  const items = sessions.data ?? []
  const more = items.length >= limit

  return (
    <>
      <PageHeader title="History" />
      {sessions.isPending ? (
        <LoadingBlock />
      ) : sessions.error ? (
        <ErrorText error={sessions.error} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing logged yet">
          <p>Finish a workout and it'll show up here, weights and cardio alike.</p>
          <Link to="/routines">
            <Button variant="primary" tabIndex={-1}>Start a workout</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id}>
                <SessionCard session={s} unit={unit} />
              </li>
            ))}
          </ul>
          {more && (
            <Button
              className="w-full mt-4"
              loading={sessions.isFetching}
              onClick={() => setLimit((l) => l + PAGE)}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </>
  )
}
