import { loadDevicePrefs } from './devicePrefs'

/**
 * Rest-timer alerts. Sounds are synthesised with Web Audio (no asset files).
 * Browsers only allow audio after a user gesture, so call `unlockAudio()` from
 * click handlers (start workout, complete set) to keep the context running.
 */
let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function beep(at: number, freq: number, duration: number, volume = 0.3): void {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.01)
  gain.gain.setValueAtTime(volume, at + duration - 0.03)
  gain.gain.linearRampToValueAtTime(0, at + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration)
}

/** Short pip for the 3-2-1 countdown. */
export function playTick(): void {
  const prefs = loadDevicePrefs()
  if (!prefs.sound || !prefs.countdownBeeps) return
  unlockAudio()
  if (ctx) beep(ctx.currentTime, 660, 0.08, 0.15)
}

/** The "rest is over" alarm: three rising double-beeps (~1.5s). */
export function playAlarm(): void {
  unlockAudio()
  if (!ctx) return
  const t = ctx.currentTime + 0.02
  for (let i = 0; i < 3; i++) {
    beep(t + i * 0.5, 880 + i * 110, 0.14)
    beep(t + i * 0.5 + 0.18, 880 + i * 110, 0.14)
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function restOverAlert(nextUp: string): void {
  const prefs = loadDevicePrefs()
  if (prefs.sound) playAlarm()
  if (prefs.vibrate) navigator.vibrate?.([300, 150, 300, 150, 300])
  // A system notification helps when the tab is in the background.
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Rest over — time to lift!', { body: nextUp, tag: 'setsmart-rest', requireInteraction: false })
    } catch {
      // Some mobile browsers only allow notifications via a service worker.
    }
  }
}
