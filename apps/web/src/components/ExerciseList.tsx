import { MUSCLE_GROUPS, type Exercise } from '@setsmart/core'
import { useMemo, useState, type ReactNode } from 'react'
import { Input } from './ui'

/** Searchable, filterable exercise list. `renderAction` adds a control to each row. */
export function ExerciseList({
  exercises,
  renderAction,
  onSelect,
  isSelected,
  footer,
}: {
  exercises: Exercise[]
  renderAction?: (e: Exercise) => ReactNode
  onSelect?: (e: Exercise) => void
  isSelected?: (e: Exercise) => boolean
  footer?: (query: string) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        (!group || e.muscleGroup === group) &&
        (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
    )
  }, [exercises, query, group])

  return (
    <div className="space-y-3">
      <Input type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises" />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
        {[null, ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g ?? 'all'}
            type="button"
            onClick={() => setGroup(g)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
              group === g ? 'bg-accent text-zinc-950 border-accent' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {g ?? 'All'}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-zinc-800/80">
        {filtered.map((e) => {
          const selected = isSelected?.(e) ?? false
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {e.name}
                  {e.ownerId && <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">Custom</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {e.muscleGroup} · {e.equipment}
                </p>
              </div>
              {selected && <span className="text-accent text-lg" aria-label="Selected">✓</span>}
            </>
          )
          return (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  aria-pressed={selected}
                  className={`flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl px-2 -mx-2 py-1 ${selected ? 'bg-lime-400/10' : 'hover:bg-zinc-800/50'}`}
                >
                  {content}
                </button>
              ) : (
                content
              )}
              {renderAction?.(e)}
            </li>
          )
        })}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">No exercises match.</p>}
      {footer?.(query)}
    </div>
  )
}
