import { formatWeight, type LoggedWorkoutSet } from '@gymbro/core'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ConfirmModal, ErrorText, LoadingBlock, PageHeader } from '../components/ui'
import { useDeleteWorkoutSession, useWeightUnit, useWorkoutSession } from '../hooks/data'
import { formatDate, formatTime, minutesBetween } from '../lib/format'

export function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useWorkoutSession(id)
  const unit = useWeightUnit()
  const del = useDeleteWorkoutSession()
  const [confirm, setConfirm] = useState(false)

  if (session.isPending) return <LoadingBlock />
  if (session.error) return <ErrorText error={session.error} />
  const s = session.data

  // Group sets by the order exercises were performed.
  const groups: LoggedWorkoutSet[][] = []
  for (const set of s.sets) {
    const last = groups[groups.length - 1]
    if (last && last[0].exercisePosition === set.exercisePosition) last.push(set)
    else groups.push([set])
  }

  return (
    <>
      <Link to="/history" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← History
      </Link>
      <div className="mt-3">
        <PageHeader
          title={s.name}
          subtitle={`${formatDate(s.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${formatTime(s.startedAt)}`}
        />
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center mb-5">
        {[
          ['Duration', `${minutesBetween(s.startedAt, s.finishedAt)} min`],
          ['Sets', String(s.setCount)],
          ['Volume', formatWeight(unit, s.volumeKg)],
        ].map(([k, v]) => (
          <Card key={k} className="py-3">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="text-lg font-bold tabular-nums mt-0.5">{v}</dd>
          </Card>
        ))}
      </dl>
      {s.notes && <p className="text-sm text-zinc-300 italic mb-5">“{s.notes}”</p>}
      <div className="space-y-3">
        {groups.map((sets) => (
          <Card key={sets[0].exercisePosition} className="p-4">
            <p className="font-semibold mb-2">{sets[0].exerciseName}</p>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-zinc-500 text-left">
                  <th className="font-normal pb-1 w-12">Set</th>
                  <th className="font-normal pb-1">Reps</th>
                  <th className="font-normal pb-1">Weight</th>
                  <th className="font-normal pb-1 text-right">Target</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((x) => (
                  <tr key={x.setNumber} className="border-t border-zinc-800/80">
                    <td className="py-1.5 text-zinc-500">{x.setNumber}</td>
                    <td className="py-1.5">{x.reps}</td>
                    <td className="py-1.5">{formatWeight(unit, x.weightKg)}</td>
                    <td className="py-1.5 text-right text-zinc-500">
                      {x.targetReps != null ? `${x.targetReps}${x.targetWeightKg != null ? ` × ${formatWeight(unit, x.targetWeightKg)}` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
      <Button variant="danger" className="mt-6" onClick={() => setConfirm(true)}>
        Delete workout
      </Button>
      <ConfirmModal
        open={confirm}
        title="Delete this workout?"
        message="It will be removed from your history and progress. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => del.mutate(s.id, { onSuccess: () => navigate('/history', { replace: true }) })}
      />
    </>
  )
}
