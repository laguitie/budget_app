import { createContext, useContext } from 'react'
import type { Database } from '../lib/database.types'

type Tables = Database['public']['Tables']

export type Membership = Pick<
  Tables['household_members']['Row'],
  'role' | 'display_name'
> & {
  household: Pick<Tables['households']['Row'], 'id' | 'name'>
}

export type HouseholdState = {
  membership: Membership | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const HouseholdContext = createContext<HouseholdState | null>(null)

export function useHousehold(): HouseholdState {
  const value = useContext(HouseholdContext)
  if (!value)
    throw new Error('useHousehold debe usarse dentro de HouseholdProvider')
  return value
}
