import { formatWeight, type WeightUnit, type WorkoutSessionSummary } from '@setsmart/core'
import { Link } from 'react-router'
import { formatDate, minutesBetween } from '../lib/format'
import { Card } from './ui'

export function SessionCard({ session, unit }: { session: WorkoutSessionSummary; unit: WeightUnit }) {
  return (
    <Link to={`/history/${session.id}`} className="block group">
      <Card className="p-4 flex items-center gap-4 group-hover:border-zinc-700">
        <div className="w-12 shrink-0 text-center">
          <p className="text-[11px] uppercase text-zinc-500">{formatDate(session.startedAt, { month: 'short' })}</p>
          <p className="text-xl font-black leading-none">{formatDate(session.startedAt, { day: 'numeric' })}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{session.name}</p>
          <p className="text-sm text-zinc-500">
            {minutesBetween(session.startedAt, session.finishedAt)} min · {session.setCount} sets ·{' '}
            {formatWeight(unit, session.volumeKg)}
          </p>
        </div>
      </Card>
    </Link>
  )
}
