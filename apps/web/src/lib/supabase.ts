import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Email links (password reset, sign-up confirmation) land with details in the URL hash, which the
// client below reads and then clears. Note them first so the app can react even if it misses the event.
const linkParams = new URLSearchParams(window.location.hash.slice(1))
/** True when the page was opened from a password reset email. */
export const openedFromRecoveryLink = linkParams.get('type') === 'recovery'
/** Set when an email link was invalid, e.g. expired or already used. */
export const emailLinkError =
  linkParams.get('error_code') === 'otp_expired'
    ? 'That email link has expired or was already used. Sign in, or use "Forgot password?" to get a new reset link.'
    : linkParams.get('error_description')

export const isSupabaseConfigured = Boolean(url && anonKey)

// A placeholder client keeps imports safe when env vars are missing; the app
// shows a setup screen instead of making requests in that case.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key')
