import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
