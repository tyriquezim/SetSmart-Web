import type { TimePoint } from '@gymbro/core'
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatTick, niceTicks } from './scale'
import { chartTheme } from './theme'
import { useElementWidth } from './useElementWidth'

export interface ChartSeries {
  key: string
  label: string
  color: string
  points: TimePoint[]
  /** 'line' draws a 2px line; 'dots' draws markers only (e.g. raw readings under a trend). */
  kind: 'line' | 'dots'
  /** 10% wash under the line */
  area?: boolean
}

interface Props {
  series: ChartSeries[]
  ariaLabel: string
  formatValue: (v: number) => string
  height?: number
  /** Start the y-axis at zero (volume); otherwise fit to the data (body weight, 1RM). */
  includeZero?: boolean
  /** Label the latest value of the primary line (off when a headline already states it). */
  endLabel?: boolean
}

const M = { top: 16, right: 16, bottom: 28, left: 44 }
const DAY = 86_400_000

function formatDate(t: number, spanDays: number): string {
  return new Date(t).toLocaleDateString(undefined, spanDays > 300 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
}

export function LineChart({ series, ariaLabel, formatValue, height = 220, includeZero = false, endLabel = true }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (all.length === 0 || width === 0) return null
    let tMin = Math.min(...all.map((p) => p.t))
    let tMax = Math.max(...all.map((p) => p.t))
    if (tMin === tMax) {
      tMin -= DAY
      tMax += DAY
    }
    let vMin = Math.min(...all.map((p) => p.v))
    let vMax = Math.max(...all.map((p) => p.v))
    if (includeZero) vMin = Math.min(0, vMin)
    else {
      const pad = (vMax - vMin) * 0.1 || Math.abs(vMax) * 0.02 || 1
      vMin -= pad
      vMax += pad
    }
    const yTicks = niceTicks(vMin, vMax, 4)
    const lo = yTicks[0]
    const hi = yTicks[yTicks.length - 1]
    const innerW = width - M.left - M.right
    const innerH = height - M.top - M.bottom
    const x = (t: number) => M.left + ((t - tMin) / (tMax - tMin)) * innerW
    const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo || 1)) * innerH
    const spanDays = (tMax - tMin) / DAY
    const xCount = Math.max(2, Math.min(6, Math.floor(innerW / 90)))
    const xTicks = Array.from({ length: xCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xCount - 1))
    const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b)
    return { x, y, yTicks, xTicks, spanDays, times, innerH, baseline: y(lo) }
  }, [series, width, height, includeZero])

  const activeT = geo && active != null ? geo.times[active] : null

  function onPointerMove(e: PointerEvent<SVGRectElement>) {
    if (!geo) return
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left + M.left
    let best = 0
    for (let i = 1; i < geo.times.length; i++) {
      if (Math.abs(geo.x(geo.times[i]) - px) < Math.abs(geo.x(geo.times[best]) - px)) best = i
    }
    setActive(best)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!geo) return
    const last = geo.times.length - 1
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? last) + 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else return
    e.preventDefault()
  }

  const primary = series.find((s) => s.kind === 'line') ?? series[0]
  const lastPoint = primary?.points[primary.points.length - 1]
  const tooltipRows =
    activeT == null
      ? []
      : series.flatMap((s) => {
          const p = s.points.find((pt) => pt.t === activeT)
          return p ? [{ s, p }] : []
        })

  return (
    <div>
      {series.length >= 2 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-zinc-400" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              {s.kind === 'line' ? (
                <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: s.color }} />
              ) : (
                <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
              )}
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={ref}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
        onKeyDown={onKeyDown}
        onFocus={() => geo && setActive((a) => a ?? geo.times.length - 1)}
        onBlur={() => setActive(null)}
      >
        {geo && (
          <svg width={width} height={height} className="block select-none" aria-hidden>
            {/* Grid + y-axis labels */}
            {geo.yTicks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} stroke={chartTheme.grid} strokeWidth={1} />
                <text x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={chartTheme.axisText} className="tabular-nums">
                  {formatTick(v)}
                </text>
              </g>
            ))}
            {/* X-axis labels */}
            {geo.xTicks.map((t, i) => (
              <text
                key={t}
                x={geo.x(t)}
                y={height - 8}
                fontSize={11}
                fill={chartTheme.axisText}
                textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
              >
                {formatDate(t, geo.spanDays)}
              </text>
            ))}

            {/* Series: dots first so lines sit on top */}
            {[...series]
              .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'dots' ? -1 : 1))
              .map((s) => {
                const pts = s.points
                if (pts.length === 0) return null
                if (s.kind === 'dots') {
                  return (
                    <g key={s.key}>
                      {pts.map((p) => (
                        <circle key={p.t} cx={geo.x(p.t)} cy={geo.y(p.v)} r={4} fill={s.color} stroke={chartTheme.surface} strokeWidth={2} />
                      ))}
                    </g>
                  )
                }
                const d = pts.map((p, i) => `${i ? 'L' : 'M'}${geo.x(p.t).toFixed(1)},${geo.y(p.v).toFixed(1)}`).join('')
                const showMarkers = pts.length <= 30
                const end = pts[pts.length - 1]
                return (
                  <g key={s.key}>
                    {s.area && pts.length > 1 && (
                      <path
                        d={`${d}L${geo.x(end.t).toFixed(1)},${geo.baseline}L${geo.x(pts[0].t).toFixed(1)},${geo.baseline}Z`}
                        fill={s.color}
                        fillOpacity={0.1}
                      />
                    )}
                    <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {(showMarkers ? pts : [end]).map((p) => (
                      <circle key={p.t} cx={geo.x(p.t)} cy={geo.y(p.v)} r={4} fill={s.color} stroke={chartTheme.surface} strokeWidth={2} />
                    ))}
                  </g>
                )
              })}

            {/* Direct label: latest value of the primary series */}
            {endLabel && lastPoint && activeT == null && (
              <text
                x={geo.x(lastPoint.t)}
                y={geo.y(lastPoint.v) - 12}
                textAnchor={geo.x(lastPoint.t) > width - 60 ? 'end' : 'middle'}
                fontSize={12}
                fontWeight={600}
                fill={chartTheme.labelText}
                // Surface-colored halo keeps the label legible where it crosses marks.
                stroke={chartTheme.surface}
                strokeWidth={4}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {formatValue(lastPoint.v)}
              </text>
            )}

            {/* Crosshair + highlighted points */}
            {activeT != null && (
              <g>
                <line x1={geo.x(activeT)} x2={geo.x(activeT)} y1={M.top} y2={M.top + geo.innerH} stroke={chartTheme.crosshair} strokeWidth={1} />
                {tooltipRows.map(({ s, p }) => (
                  <circle key={s.key} cx={geo.x(p.t)} cy={geo.y(p.v)} r={5.5} fill={s.color} stroke={chartTheme.surface} strokeWidth={2} />
                ))}
              </g>
            )}

            {/* Hit area: the whole plot, so readers aim at a date, not a 2px line */}
            <rect
              x={M.left}
              y={M.top}
              width={Math.max(0, width - M.left - M.right)}
              height={geo.innerH}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerDown={onPointerMove}
              onPointerLeave={() => setActive(null)}
              style={{ touchAction: 'pan-y' }}
            />
          </svg>
        )}

        {geo && activeT != null && tooltipRows.length > 0 && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl bg-zinc-950/95 border border-zinc-700 px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(geo.x(activeT), 70), width - 70),
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-zinc-400 mb-1 whitespace-nowrap">
              {new Date(activeT).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {tooltipRows.map(({ s, p }) => (
              <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: s.color }} />
                <strong className="text-zinc-100 font-semibold tabular-nums">{formatValue(p.v)}</strong>
                {series.length > 1 && <span className="text-zinc-500">{s.label}</span>}
              </p>
            ))}
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {activeT != null && tooltipRows.map(({ s, p }) => `${s.label} ${formatValue(p.v)}`).join(', ')}
          {activeT != null && ` on ${new Date(activeT).toLocaleDateString()}`}
        </span>
      </div>
    </div>
  )
}
