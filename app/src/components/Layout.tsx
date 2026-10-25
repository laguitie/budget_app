import { NavLink, Outlet } from 'react-router'
import { useHousehold } from '../household/HouseholdContext'
import { supabase } from '../lib/supabase'

export function Layout() {
  const { membership } = useHousehold()

  return (
    <div className="layout">
      <header className="topbar">
        <strong>{membership?.household.name}</strong>
        <nav>
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/miembros">Miembros</NavLink>
          <button
            type="button"
            className="link"
            onClick={() => supabase.auth.signOut()}
          >
            Salir
          </button>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
