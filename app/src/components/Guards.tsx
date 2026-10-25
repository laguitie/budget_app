import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useHousehold } from '../household/HouseholdContext'

export function Loading() {
  return <p className="loading">Cargando…</p>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/ingresar?siguiente=${next}`} replace />
  }
  return children
}

export function RequireHousehold({ children }: { children: ReactNode }) {
  const { membership, loading, error } = useHousehold()

  if (loading) return <Loading />
  if (error) return <p className="error">{error}</p>
  if (!membership) return <Navigate to="/crear-hogar" replace />
  return children
}
