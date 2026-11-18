import { MUSCLE_GROUPS, type Exercise, type ExerciseKind } from '@setsmart/core'
import { useMemo, useState, type ReactNode } from 'react'
import { exerciseSubtitle } from '../lib/exercises'
import { Input } from './ui'

const KINDS: Array<{ value: ExerciseKind; label: string }> = [
  { value: 'weights', label: 'Weights' },
  { value: 'cardio', label: 'Cardio' },
]

/**
 * Searchable exercise list, with weights and cardio on separate tabs so cardio is easy
 * to find. `renderAction` adds a control to each row.
 */
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
  /** Shown under the list, e.g. a "create" button for the current tab */
  footer?: (query: string, kind: ExerciseKind) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weights')
  const [group, setGroup] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        e.kind === kind &&
        (kind === 'cardio' || !group || e.muscleGroup === group) &&
        (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
    )
  }, [exercises, query, kind, group])
  const selectedElsewhere = isSelected ? exercises.filter((e) => e.kind !== kind && isSelected(e)).length : 0

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Exercise type" className="grid grid-cols-2 rounded-xl bg-zinc-950 border border-zinc-800 p-1">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="tab"
            aria-selected={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`h-9 rounded-lg text-sm font-medium transition-colors ${
              kind === k.value ? 'bg-zinc-800 text-accent' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <Input
        type="search"
        placeholder={kind === 'cardio' ? 'Search cardio' : 'Search exercises'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={kind === 'cardio' ? 'Search cardio' : 'Search exercises'}
      />
      {kind === 'weights' && (
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
      )}
      {selectedElsewhere > 0 && (
        <p className="text-xs text-zinc-500">
          {selectedElsewhere} {kind === 'cardio' ? 'weights' : 'cardio'} {selectedElsewhere === 1 ? 'exercise' : 'exercises'} also selected
        </p>
      )}
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
                <p className="text-xs text-zinc-500">{exerciseSubtitle(e)}</p>
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
      {footer?.(query, kind)}
    </div>
  )
}
