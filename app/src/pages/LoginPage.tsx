import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { PasswordInput } from '../components/PasswordInput'
import { errorMessage } from '../lib/errors'
import { safeRedirect } from '../lib/redirect'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const next = safeRedirect(params.get('siguiente'))
  const [email, setEmail] = useState(params.get('correo') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={next} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) setError(errorMessage(error))
    setSubmitting(false)
  }

  const registerParams = new URLSearchParams(params)

  return (
    <main className="card">
      <h1>Ingresar</h1>
      <form onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p>
        ¿No tienes cuenta?{' '}
        <Link to={`/registro?${registerParams}`}>Crear una cuenta</Link>
      </p>
    </main>
  )
}
