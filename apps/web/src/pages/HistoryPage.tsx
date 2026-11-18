import { useState } from 'react'
import { Link } from 'react-router'
import { CardioCard } from '../components/CardioCard'
import { PlusIcon } from '../components/icons'
import { SessionCard } from '../components/SessionCard'
import { Button, EmptyState, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useCardioSessions, useWeightUnit, useWorkoutSessions } from '../hooks/data'
import { mergeActivities } from '../lib/activity'

const PAGE = 20

export function HistoryPage() {
  const [limit, setLimit] = useState(PAGE)
  const sessions = useWorkoutSessions(limit)
  const cardio = useCardioSessions(limit)
  const unit = useWeightUnit()

  const pending = sessions.isPending || cardio.isPending
  const error = sessions.error ?? cardio.error
  // Each list is fetched `limit` deep, so the newest `limit` of the two combined are complete.
  const items = mergeActivities(sessions.data, cardio.data).slice(0, limit)
  const more = (sessions.data?.length ?? 0) >= limit || (cardio.data?.length ?? 0) >= limit

  return (
    <>
      <PageHeader
        title="History"
        action={
          <Link to="/history/cardio/new">
            <Button tabIndex={-1}>
              <PlusIcon className="size-4" /> Log cardio
            </Button>
          </Link>
        }
      />
      {pending ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorText error={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing logged yet">
          <p>Finish a workout or log some cardio and it'll show up here.</p>
          <Link to="/routines">
            <Button variant="primary" tabIndex={-1}>Start a workout</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.kind}-${item.data.id}`}>
                {item.kind === 'workout' ? <SessionCard session={item.data} unit={unit} /> : <CardioCard session={item.data} />}
              </li>
            ))}
          </ul>
          {more && (
            <Button
              className="w-full mt-4"
              loading={sessions.isFetching || cardio.isFetching}
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
