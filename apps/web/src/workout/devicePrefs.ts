/** Per-device preferences (sound/vibration differ by phone vs desktop, so not stored on the account). */
export interface DevicePrefs {
  sound: boolean
  vibrate: boolean
  countdownBeeps: boolean
}

const KEY = 'setsmart.devicePrefs.v1'
const DEFAULTS: DevicePrefs = { sound: true, vibrate: true, countdownBeeps: true }

export function loadDevicePrefs(): DevicePrefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveDevicePrefs(prefs: DevicePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage unavailable (private mode); prefs just won't persist
  }
}
