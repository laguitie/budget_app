import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CopyLink } from '../components/CopyLink'
import { useHousehold } from '../household/HouseholdContext'
import type { Database } from '../lib/database.types'
import { errorMessage } from '../lib/errors'
import { invitationUrl } from '../lib/redirect'
import { supabase } from '../lib/supabase'

type Tables = Database['public']['Tables']
type Member = Pick<
  Tables['household_members']['Row'],
  'user_id' | 'display_name' | 'role'
>
type Invitation = Pick<
  Tables['invitations']['Row'],
  'id' | 'email' | 'token' | 'expires_at'
>

export function MembersPage() {
  const { membership } = useHousehold()
  const householdId = membership?.household.id
  const isAdmin = membership?.role === 'admin'
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [newLink, setNewLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!householdId) return
    const [membersResult, invitationsResult] = await Promise.all([
      supabase
        .from('household_members')
        .select('user_id, display_name, role')
        .eq('household_id', householdId)
        .order('joined_at'),
      isAdmin
        ? supabase
            .from('invitations')
            .select('id, email, token, expires_at')
            .eq('household_id', householdId)
            .eq('status', 'pendiente')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ])
    const loadError = membersResult.error ?? invitationsResult.error
    if (loadError) setError(errorMessage(loadError))
    setMembers(membersResult.data ?? [])
    setInvitations(invitationsResult.data ?? [])
  }, [householdId, isAdmin])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la lista
    void load()
  }, [load])

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    if (!householdId) return
    setSubmitting(true)
    setError(null)
    setNewLink(null)
    const { data, error } = await supabase.rpc('create_invitation', {
      p_household_id: householdId,
      p_email: email,
    })
    setSubmitting(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    setNewLink(invitationUrl(data))
    setEmail('')
    await load()
  }

  async function revoke(id: string) {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'revocada' })
      .eq('id', id)
    if (error) setError(errorMessage(error))
    setNewLink(null)
    await load()
  }

  return (
    <section>
      <h1>Miembros</h1>
      <ul className="list">
        {members.map((member) => (
          <li key={member.user_id}>
            {member.display_name}
            {member.role === 'admin' && (
              <span className="badge">Administrador</span>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <h2>Invitar a alguien</h2>
          <form onSubmit={handleInvite}>
            <label>
              Correo de la persona
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear invitación'}
            </button>
          </form>
          {newLink && (
            <div className="notice">
              <p>
                Envíale este enlace (por WhatsApp, por ejemplo). Debe crear su
                cuenta o ingresar con el correo invitado. Vence en 7 días.
              </p>
              <CopyLink url={newLink} />
            </div>
          )}

          {invitations.length > 0 && (
            <>
              <h2>Invitaciones pendientes</h2>
              <ul className="list">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="stack">
                    <div className="row">
                      <span>{invitation.email}</span>
                      <button
                        type="button"
                        className="link"
                        onClick={() => revoke(invitation.id)}
                      >
                        Revocar
                      </button>
                    </div>
                    <small>
                      Vence el{' '}
                      {new Date(invitation.expires_at).toLocaleDateString(
                        'es-CR',
                      )}
                    </small>
                    <CopyLink url={invitationUrl(invitation.token)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
