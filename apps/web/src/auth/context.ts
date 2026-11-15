import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/** For components rendered inside <RequireAuth>, where a user is guaranteed. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser must be used inside an authenticated route')
  return user
}
