import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// A placeholder client keeps imports safe when env vars are missing; the app
// shows a setup screen instead of making requests in that case.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key')
