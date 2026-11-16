import type { EnergyUnit, WeightUnit } from '@setsmart/core'
import { useState } from 'react'
import { useUser } from '../auth/context'
import { BodyDetailsCard } from '../components/energy/BodyDetailsCard'
import { Button, Card, ErrorText, Field, Input, LoadingBlock, PageHeader, Segmented } from '../components/ui'
import { useProfile, useUpdateProfile } from '../hooks/data'
import { supabase } from '../lib/supabase'
import { playAlarm, requestNotificationPermission } from '../workout/alarm'
import { loadDevicePrefs, saveDevicePrefs, type DevicePrefs } from '../workout/devicePrefs'

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <input type="checkbox" className="size-5 accent-lime-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function SettingsPage() {
  const user = useUser()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [name, setName] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<DevicePrefs>(loadDevicePrefs)
  const [notifStatus, setNotifStatus] = useState<string>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<unknown>(null)

  const setPref = (patch: Partial<DevicePrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    saveDevicePrefs(next)
  }

  if (profile.isPending) return <LoadingBlock />
  if (profile.error) return <ErrorText error={profile.error} />
  const p = profile.data
  const displayName = name ?? p.displayName ?? ''

  return (
    <>
      <PageHeader title="Settings" subtitle={user.email} />
      <div className="space-y-4">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <Field label="Display name">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={displayName} onChange={(e) => setName(e.target.value)} />
                <Button
                  variant="primary"
                  disabled={displayName === (p.displayName ?? '')}
                  loading={update.isPending && update.variables?.displayName !== undefined}
                  onClick={() => update.mutate({ displayName: displayName.trim() || null })}
                >
                  Save
                </Button>
              </div>
            )}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-300">Weight unit</span>
            <Segmented<WeightUnit>
              value={p.weightUnit}
              disabled={update.isPending}
              onChange={(weightUnit) => update.mutate({ weightUnit })}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-300">Energy unit</span>
            <Segmented<EnergyUnit>
              value={p.energyUnit}
              disabled={update.isPending}
              onChange={(energyUnit) => update.mutate({ energyUnit })}
              options={[
                { value: 'kj', label: 'kJ' },
                { value: 'kcal', label: 'kcal' },
              ]}
            />
          </div>
          <ErrorText error={update.error} />
        </Card>

        <BodyDetailsCard profile={p} />

        <Card className="p-5">
          <h2 className="font-semibold mb-1">Rest timer alerts</h2>
          <p className="text-xs text-zinc-500 mb-3">Saved on this device only.</p>
          <Toggle label="Alarm sound" checked={prefs.sound} onChange={(sound) => setPref({ sound })} />
          <Toggle label="3-2-1 countdown beeps" checked={prefs.countdownBeeps} onChange={(countdownBeeps) => setPref({ countdownBeeps })} />
          <Toggle label="Vibrate (supported phones)" checked={prefs.vibrate} onChange={(vibrate) => setPref({ vibrate })} />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={playAlarm}>
              Test alarm
            </Button>
            {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
              <Button size="sm" onClick={async () => setNotifStatus(await requestNotificationPermission())}>
                Enable notifications
              </Button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Notifications alert you when rest ends while SetSmart is in a background tab
            {notifStatus === 'denied' && ' (currently blocked in your browser settings)'}.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Account</h2>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              setPwMsg(null)
              setPwErr(null)
              const { error } = await supabase.auth.updateUser({ password: newPassword })
              if (error) setPwErr(error)
              else {
                setPwMsg('Password updated.')
                setNewPassword('')
              }
            }}
          >
            <Input
              type="password"
              placeholder="New password"
              minLength={8}
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-label="New password"
            />
            <Button type="submit">Change</Button>
          </form>
          {pwMsg && <p className="text-sm text-lime-200">{pwMsg}</p>}
          <ErrorText error={pwErr} />
          <Button variant="danger" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    </>
  )
}
