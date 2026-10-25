import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { HouseholdProvider } from './household/HouseholdProvider'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  },
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <HouseholdProvider>
          <AppRoutes />
        </HouseholdProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App sin sesión', () => {
  it('envía al inicio de sesión', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Ingresar' }),
    ).toBeInTheDocument()
  })

  it('muestra el registro', async () => {
    renderAt('/registro')
    expect(
      await screen.findByRole('heading', { name: 'Crear cuenta' }),
    ).toBeInTheDocument()
  })
})
