import { useEffect } from 'react'

/** Keep the screen on while `active` (e.g. during a workout). No-op where unsupported. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) void l.release()
        else lock = l
      } catch {
        // Denied (e.g. low battery) — not critical.
      }
    }
    void acquire()
    // The lock is released automatically when the tab is hidden; re-acquire on return.
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
