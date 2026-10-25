import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// La app se carga aparte para que un error al arrancar (por ejemplo, variables
// de entorno faltantes) se muestre en pantalla en vez de dejarla en blanco.
import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    root.render(
      <main className="card">
        <h1>No se pudo iniciar la app</h1>
        <p className="error">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </main>,
    )
  })
