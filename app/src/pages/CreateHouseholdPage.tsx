import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Loading } from '../components/Guards'
import { useHousehold } from '../household/HouseholdContext'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export function CreateHouseholdPage() {
  const { user } = useAuth()
  const { membership, loading, refresh } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState<string>(
    user?.user_metadata.full_name ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Loading />
  if (membership) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('create_household', {
      p_name: name,
      p_display_name: displayName,
    })
    if (error) {
      setError(errorMessage(error))
      setSubmitting(false)
      return
    }
    await refresh()
    navigate('/', { replace: true })
  }

  return (
    <main className="card">
      <h1>Crea tu hogar</h1>
      <p>
        El hogar agrupa las cuentas, los gastos y el presupuesto que compartes
        con tu familia.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre del hogar
          <input
            required
            maxLength={80}
            placeholder="Casa Pérez Mora"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Tu nombre
          <input
            required
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear hogar'}
        </button>
      </form>
      <p className="hint">
        ¿Te invitaron a un hogar? Abre el enlace de la invitación que te
        enviaron.
      </p>
      <button
        type="button"
        className="link"
        onClick={() => supabase.auth.signOut()}
      >
        Salir
      </button>
    </main>
  )
}
