import type { ReactNode } from 'react'
import { Card } from './ui'

/** label · value · optional detail (e.g. the date a record was set). */
export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {detail && <p className="text-xs text-zinc-500 mt-0.5">{detail}</p>}
    </Card>
  )
}
