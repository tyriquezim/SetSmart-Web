import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/context'
import { Button, ErrorText, Field, FullScreenSpinner, Input } from '../components/ui'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'reset'

export function AuthPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (loading) return <FullScreenSpinner />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        // With email confirmation enabled (Supabase default) there is no session yet.
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/settings`,
        })
        if (error) throw error
        setNotice('If an account exists for that email, a reset link is on its way.')
        setMode('signin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/favicon.svg" alt="" className="size-11" />
          <span className="text-3xl font-black tracking-tight">SetSmart</span>
        </div>
        <form onSubmit={onSubmit} className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
          <h1 className="text-xl font-bold">{title}</h1>
          {notice && <p className="text-sm text-lime-200 bg-lime-400/10 rounded-xl px-3 py-2">{notice}</p>}
          {mode === 'signup' && (
            <Field label="Name">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            </Field>
          )}
          <Field label="Email">
            {(id) => (
              <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            )}
          </Field>
          {mode !== 'reset' && (
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              )}
            </Field>
          )}
          <ErrorText error={error} />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </Button>
          <div className="flex justify-between text-sm">
            {mode === 'signin' ? (
              <>
                <button type="button" className="text-zinc-400 hover:text-zinc-100" onClick={() => setMode('reset')}>
                  Forgot password?
                </button>
                <button type="button" className="text-accent font-medium" onClick={() => setMode('signup')}>
                  Create account
                </button>
              </>
            ) : (
              <button type="button" className="text-accent font-medium" onClick={() => setMode('signin')}>
                ← Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
