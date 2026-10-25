import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Loading } from '../components/Guards'
import { useHousehold } from '../household/HouseholdContext'
import type { Database } from '../lib/database.types'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

type InvitationInfo =
  Database['public']['Functions']['get_invitation']['Returns'][number]

const statusMessages: Record<string, string> = {
  aceptada: 'Esta invitación ya fue aceptada.',
  revocada: 'Esta invitación fue revocada.',
  vencida: 'Esta invitación venció. Pide que te envíen una nueva.',
}

export function AcceptInvitationPage() {
  const { token = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { membership, refresh } = useHousehold()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState<string>(
    user?.user_metadata.full_name ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .rpc('get_invitation', { p_token: token })
      .maybeSingle()
      .then(({ data, error }) => {
        setInvitation(data)
        if (error) setError(errorMessage(error))
        setLoading(false)
      })
  }, [token])

  if (loading || authLoading) return <Loading />
  if (membership) return <Navigate to="/" replace />

  if (!invitation) {
    return (
      <main className="card">
        <h1>Invitación no encontrada</h1>
        <p>{error ?? 'Revisa que el enlace esté completo.'}</p>
      </main>
    )
  }

  if (invitation.status !== 'pendiente') {
    return (
      <main className="card">
        <h1>Invitación a {invitation.household_name}</h1>
        <p>{statusMessages[invitation.status]}</p>
      </main>
    )
  }

  const invitedBy = invitation.invited_by_name ?? 'Alguien'
  const authParams = new URLSearchParams({
    correo: invitation.email,
    siguiente: `/invitacion/${token}`,
  })

  async function handleAccept(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('accept_invitation', {
      p_token: token,
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
      <h1>Te invitaron a {invitation.household_name}</h1>
      <p>
        {invitedBy} te invitó a compartir el presupuesto del hogar. La
        invitación es para <strong>{invitation.email}</strong>.
      </p>
      {user ? (
        <form onSubmit={handleAccept}>
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
            {submitting ? 'Uniéndote…' : 'Unirme al hogar'}
          </button>
        </form>
      ) : (
        <div className="actions">
          <Link className="button" to={`/registro?${authParams}`}>
            Crear cuenta
          </Link>
          <Link to={`/ingresar?${authParams}`}>Ya tengo cuenta</Link>
        </div>
      )}
    </main>
  )
}
