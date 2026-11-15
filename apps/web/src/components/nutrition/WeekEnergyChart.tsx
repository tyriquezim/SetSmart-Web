import { addDays, kjTo, type EnergyUnit, type Nutrients } from '@setsmart/core'
import { useState } from 'react'
import { dayLabel, energyLabel } from '../../lib/nutrition'
import { chartTheme } from '../charts/theme'

const HEIGHT = 96

/**
 * Energy eaten on each of the 7 days ending `endDay`, one column per day.
 * Columns are buttons that open that day; hover or focus shows the value.
 */
export function WeekEnergyChart({
  endDay,
  selectedDay,
  totals,
  targetKj,
  unit,
  onSelect,
}: {
  endDay: string
  selectedDay: string
  totals: Map<string, Nutrients>
  targetKj: number | null
  unit: EnergyUnit
  onSelect: (day: string) => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(endDay, i - 6))
  const values = days.map((d) => kjTo(unit, totals.get(d)?.energyKj ?? 0))
  const target = targetKj != null ? kjTo(unit, targetKj) : null
  const max = Math.max(target ?? 0, ...values) * 1.1 || 1
  const label = energyLabel(unit)
  const daysWithFood = values.filter((v) => v > 0)
  const avg = daysWithFood.length ? daysWithFood.reduce((a, b) => a + b, 0) / daysWithFood.length : null

  return (
    <figure>
      <figcaption className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold">Last 7 days</span>
        <span className="text-xs text-zinc-500">
          {avg != null ? `Avg ${Math.round(avg).toLocaleString()} ${label} on logged days` : 'Nothing logged yet'}
        </span>
      </figcaption>
      <div className="relative" style={{ height: HEIGHT }}>
        {/* baseline */}
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: chartTheme.grid }} />
        {target != null && (
          <div
            className="absolute inset-x-0 border-t border-dashed pointer-events-none"
            style={{ bottom: (target / max) * HEIGHT, borderColor: chartTheme.crosshair }}
          >
            <span className="absolute right-0 -top-4 text-[10px]" style={{ color: chartTheme.axisText }}>
              Target
            </span>
          </div>
        )}
        <div className="absolute inset-0 grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const v = values[i]
            const name = dayLabel(d)
            const valueText = v > 0 ? `${Math.round(v).toLocaleString()} ${label}` : 'Nothing logged'
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelect(d)}
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover((h) => (h === d ? null : h))}
                onFocus={() => setHover(d)}
                onBlur={() => setHover((h) => (h === d ? null : h))}
                aria-label={`${name}: ${valueText}`}
                aria-pressed={d === selectedDay}
                className="relative h-full flex items-end justify-center rounded-md focus-visible:outline-2 focus-visible:outline-accent hover:bg-zinc-800/40"
              >
                {v > 0 && (
                  <span
                    className="block w-full max-w-7 rounded-t"
                    style={{ height: Math.max(2, (v / max) * HEIGHT), background: chartTheme.series }}
                  />
                )}
                {hover === d && (
                  <span
                    role="tooltip"
                    className={`absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 shadow-lg ${
                      i < 2 ? 'left-0' : i > 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    <span className="text-zinc-400">{name} · </span>
                    {valueText}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mt-1.5" aria-hidden>
        {days.map((d) => (
          <span
            key={d}
            className={`text-center text-[11px] ${d === selectedDay ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}
          >
            {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
          </span>
        ))}
      </div>
    </figure>
  )
}
