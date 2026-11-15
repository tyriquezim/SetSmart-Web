import { useEffect, useState } from 'react'

/** Re-render on an interval and return the current time (epoch ms). */
export function useNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
  return now
}
