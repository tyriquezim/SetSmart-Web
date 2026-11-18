import { deleteMyAccount } from '@setsmart/core'
import { useState, type FormEvent } from 'react'
import { useUser } from '../auth/context'
import { supabase } from '../lib/supabase'
import { ACCOUNT_DELETED_FLAG } from '../lib/accountDeleted'
import { Button, Card, ErrorText, Field, Input, Modal } from './ui'

/** Permanently deletes the account after the user re-enters their password. */
export function DeleteAccountCard() {
  const user = useUser()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setPassword('')
    setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Re-check the password so an unlocked, signed-in device isn't enough on its own.
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password })
      if (authError) throw new Error('That password is incorrect.')
      try {
        await deleteMyAccount(supabase)
      } catch (err) {
        const detail = err instanceof Error ? ` (${err.message})` : ''
        throw new Error(`Your account couldn't be deleted, and nothing was removed. Please try again.${detail}`, { cause: err })
      }
      for (const key of ['setsmart.activeWorkout.v1', 'setsmart.devicePrefs.v1']) {
        try {
          localStorage.removeItem(key)
        } catch {
          // Storage unavailable: nothing to clear.
        }
      }
      try {
        sessionStorage.setItem(ACCOUNT_DELETED_FLAG, '1')
      } catch {
        // Only used to show a confirmation on the sign-in page.
      }
      // The session no longer exists on the server, so only clear it locally.
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Your account was not deleted.')
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 space-y-3 border-red-900/60">
      <h2 className="font-semibold">Delete account</h2>
      <p className="text-sm text-zinc-400">
        Permanently delete your account and everything in it. This can't be undone.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account…
      </Button>

      <Modal open={open} onClose={close} title="Delete your account?">
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <p className="text-zinc-300">This permanently deletes:</p>
          <ul className="list-disc pl-5 text-zinc-400 space-y-0.5">
            <li>your workouts, cardio sessions and routines</li>
            <li>your custom exercises and foods</li>
            <li>your food log, targets and weigh-ins</li>
            <li>your profile, body details and login</li>
          </ul>
          <p className="text-zinc-300">
            <strong>This can't be undone</strong>, and the data can't be recovered. You can sign up again with the same
            email later, but you'll start from scratch.
          </p>
          <Field label="Enter your password to confirm">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <ErrorText error={error} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!password}>
              Delete my account
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
