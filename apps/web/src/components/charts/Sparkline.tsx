import type { TimePoint } from '@gymbro/core'
import { chartTheme } from './theme'

/** Tiny trend line: history in the de-emphasis gray, latest point in the series color. Decorative — values are shown as text alongside. */
export function Sparkline({ points, width = 72, height = 28 }: { points: TimePoint[]; width?: number; height?: number }) {
  const pts = points.slice(-12)
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />
  const pad = 4
  const ts = pts.map((p) => p.t)
  const vs = pts.map((p) => p.v)
  const [t0, t1, v0, v1] = [Math.min(...ts), Math.max(...ts), Math.min(...vs), Math.max(...vs)]
  const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - v0) / (v1 - v0 || 1)) * (height - pad * 2)
  const end = pts[pts.length - 1]
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <polyline
        points={pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke={chartTheme.deemphasis}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(end.t)} cy={y(end.v)} r={3} fill={chartTheme.series} />
    </svg>
  )
}
