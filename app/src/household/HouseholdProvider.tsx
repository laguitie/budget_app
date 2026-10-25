import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { HouseholdContext, type Membership } from './HouseholdContext'

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setMembership(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('household_members')
      .select('role, display_name, household:households!inner(id, name)')
      .eq('user_id', userId)
      .maybeSingle()
    setMembership(data)
    setError(error ? errorMessage(error) : null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al cambiar de usuario
    void refresh()
  }, [refresh])

  return (
    <HouseholdContext.Provider value={{ membership, loading, error, refresh }}>
      {children}
    </HouseholdContext.Provider>
  )
}
