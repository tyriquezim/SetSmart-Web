import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/context'
import { Button, ErrorText, Field, FullScreenSpinner, Input } from '../components/ui'
import { supabase } from '../lib/supabase'

/**
 * Where a password reset email lands. The link has already signed the user in, so all that's left
 * is choosing a new password.
 */
export function ResetPasswordPage() {
  const { user, loading, endRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (loading) return <FullScreenSpinner />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    endRecovery()
    navigate('/', { replace: true })
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/logo.png" alt="" className="size-11 rounded-xl" />
          <span className="text-3xl font-black tracking-tight">SetSmart</span>
        </div>
        {user ? (
          <form onSubmit={onSubmit} className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold">Set a new password</h1>
              <p className="text-sm text-zinc-400 mt-1">For {user.email}</p>
            </div>
            <Field label="New password" hint="At least 8 characters">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Field label="Confirm new password">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>
            <ErrorText error={error} />
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
              Save password
            </Button>
            <button type="button" className="text-sm text-zinc-400 hover:text-zinc-100" onClick={signOut}>
              Cancel and sign out
            </button>
          </form>
        ) : (
          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
            <h1 className="text-xl font-bold">Link expired</h1>
            <p className="text-sm text-zinc-400">
              This reset link has expired or was already used. Go back to sign in and use "Forgot password?" to get a
              new one.
            </p>
            <Link to="/login" className="block text-accent font-medium text-sm">
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
