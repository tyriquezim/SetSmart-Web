import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type Client = SupabaseClient

/** Throw Supabase errors so callers (e.g. TanStack Query) see a rejected promise. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
