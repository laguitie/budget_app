# CLAUDE.md

Budget App familiar: app de presupuesto compartida por hogar, web y móvil (PWA), en colones (₡) y dólares ($).

El plan completo (alcance, modelo de datos, pantallas y fases) está en [docs/PLAN.md](docs/PLAN.md). Léelo antes de empezar una tarea nueva y marca los issues completados ahí.

## Estructura

- `app/`: frontend React + TypeScript + Vite (PWA).
- `supabase/migrations/`: migraciones SQL de Postgres.
- `supabase/functions/`: Supabase Edge Functions (Deno).
- `docs/`: plan y documentación.

## Comandos (desde `app/`)

- `npm run dev`: servidor de desarrollo.
- `npm run build`: chequeo de tipos y build de producción.
- `npm run lint`: ESLint.
- `npm run format`: Prettier (`npm run format:check` solo verifica).
- `npm test`: Vitest.

La app lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de `app/.env.local` (plantilla en `app/.env.example`).

## Supabase (desde la raíz del repo)

- Proyecto: `jycidmxkgwrfjtlixxkb`. El CLI se usa con `npx supabase`.
- `npx supabase migration new <nombre>`: crea una migración en `supabase/migrations/`.
- `npx supabase db push`: aplica las migraciones pendientes al proyecto remoto.
- `npx supabase gen types typescript --linked > app/src/lib/database.types.ts`: regenera los tipos después de cada migración.
- No hay Docker en este entorno, así que no se usa `supabase start`; las migraciones se prueban contra el proyecto remoto. Revisa bien cada migración antes de aplicarla.

## Reglas del dominio

- Los montos se guardan como enteros en céntimos, nunca como decimales.
- Cada transacción guarda monto y moneda originales, el tipo de cambio aplicado y los equivalentes en CRC y USD. El tipo de cambio queda congelado: los reportes pasados no se recalculan.
- El selector ₡/$ solo elige qué columna sumar; no convierte.
- Las transferencias son dos movimientos enlazados por `transfer_id` y no cuentan como gasto ni ingreso.
- Toda tabla con datos del hogar lleva `household_id` y políticas RLS que limitan el acceso a los miembros del hogar.
- El tipo de cambio del BCCR se consulta solo desde una Edge Function (el BCCR bloquea CORS), nunca desde el navegador.

## Forma de trabajo

- La interfaz y la documentación van en español.
- Una rama por issue (`feat/...`, `fix/...`) y cambios a `main` por pull request.
- Los secretos (token del BCCR, llaves de Supabase) van en variables de entorno o GitHub Secrets, nunca en el código. Solo `.env.example` se versiona.
