/** "Nice" round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    min -= pad
    max += pad
  }
  const rough = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step)
  return ticks
}

/** Compact axis label: 950, 1,200, 12K. */
export function formatTick(v: number): string {
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)}K`
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
}
