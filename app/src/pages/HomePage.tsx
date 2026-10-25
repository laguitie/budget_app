import { Link } from 'react-router'
import { useHousehold } from '../household/HouseholdContext'

export function HomePage() {
  const { membership } = useHousehold()

  return (
    <section>
      <h1>Hola, {membership?.display_name}</h1>
      <p>Aquí irá el resumen del mes.</p>
      <p>
        Mientras tanto, puedes <Link to="/miembros">invitar a tu familia</Link>.
      </p>
    </section>
  )
}
