import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { PasswordInput } from '../components/PasswordInput'
import { errorMessage } from '../lib/errors'
import { safeRedirect } from '../lib/redirect'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 8

export function RegisterPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const next = safeRedirect(params.get('siguiente'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.get('correo') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (user) return <Navigate to={next} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      )
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    })
    setSubmitting(false)
    if (error) {
      setError(errorMessage(error))
    } else if (!data.session) {
      // El proyecto pide confirmar el correo antes de iniciar sesión.
      setConfirmationSent(true)
    }
  }

  if (confirmationSent) {
    return (
      <main className="card">
        <h1>Revisa tu correo</h1>
        <p>
          Te enviamos un enlace a <strong>{email}</strong> para confirmar tu
          cuenta. Después de confirmarla puedes ingresar.
        </p>
      </main>
    )
  }

  return (
    <main className="card">
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Tu nombre
          <input
            autoComplete="given-name"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Correo
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>Al menos {MIN_PASSWORD_LENGTH} caracteres.</small>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to={`/ingresar?${params}`}>Ingresar</Link>
      </p>
    </main>
  )
}
