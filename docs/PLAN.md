# Plan del proyecto: Budget App familiar

## 1. Objetivo

Una app de presupuesto para el hogar, compartida entre los miembros de la familia, que se usa desde el teléfono y la computadora. Maneja gastos en colones (₡) y dólares ($) con conversión automática según el tipo de cambio del día.

## 2. Alcance

- **Usuarios:** los miembros de un hogar (pareja o familia). Cada hogar ve solo sus propios datos.
- **Plataformas:** web y móvil, con una sola base de código (PWA instalable en el teléfono).
- **Monedas:** colón como moneda principal, con opción de ver todo en dólares.

## 3. MVP (Producto Mínimo Viable)

Primera versión con lo indispensable para el uso diario:

1. Registro e inicio de sesión.
2. Crear un hogar e invitar a otros miembros.
3. Crear y administrar cuentas (efectivo, cuentas bancarias, tarjetas), cada una con su moneda y saldo inicial.
4. Registro rápido de gastos e ingresos: monto, moneda, categoría o subcategoría, cuenta, quién pagó y nota.
5. Transferencias entre cuentas, incluidas las de distinta moneda.
6. Categorías y subcategorías personalizables para gastos, ingresos y presupuestos.
7. Conversión automática ₡/$ con el tipo de cambio del día.
8. Presupuesto mensual por categoría o subcategoría, con barra de progreso.
9. Resumen del mes: gastado contra presupuestado, por categoría y por persona; saldo de cada cuenta.
10. Selector ₡/$ para ver montos y reportes en cualquiera de las dos monedas.

### Fuera del MVP (versiones posteriores)

- Gastos recurrentes (suscripciones, alquiler, servicios).
- Importación de estados de cuenta en CSV.
- Metas de ahorro.
- Reportes históricos y tendencias.
- Presupuestos fijos en dólares por categoría.
- App nativa con Expo (React Native), si la PWA se queda corta.
- Conexión directa con bancos (cobertura limitada en Costa Rica y alta complejidad).

## 4. Stack técnico

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | React + TypeScript + Vite, como PWA | Un solo código para web y móvil, sin tiendas de apps |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) | Login, datos compartidos en tiempo real y reglas de acceso por hogar |
| Seguridad de datos | Row Level Security (RLS) de Postgres | Cada hogar solo accede a sus registros |
| Hosting | Vercel o Netlify, conectado a GitHub | Despliegue automático en cada push |
| CI | GitHub Actions | Lint, pruebas y build en cada pull request |

## 5. Diseño multimoneda

### Reglas

- La moneda base del hogar es el colón (CRC).
- Cada transacción guarda el monto y la moneda **originales**, el tipo de cambio aplicado y los equivalentes en CRC y USD calculados al registrarse.
- El tipo de cambio queda congelado en la transacción: los reportes de meses pasados no cambian cuando cambia el dólar.
- El selector ₡/$ solo elige qué columna sumar; no recalcula.
- Los presupuestos se definen en colones. En la vista en dólares se muestran convertidos con el tipo de cambio actual y marcados como aproximados.
- Los montos se guardan como enteros en céntimos para evitar errores de redondeo.

### Fuente del tipo de cambio

- **Principal:** servicio web de Indicadores Económicos del BCCR (requiere registro con correo y token). Indicadores: 317 (compra) y 318 (venta).
- **Respaldo:** API del Ministerio de Hacienda o Frankfurter (proveedor BCCR).
- El BCCR rechaza llamadas desde el navegador (CORS), así que la consulta corre en una **Supabase Edge Function programada** una vez al día y guarda el resultado en la tabla `exchange_rates`.
- Fines de semana y feriados: se usa el último tipo de cambio publicado.
- La tasa usada para convertir (compra, venta o promedio) es una configuración del hogar.

## 6. Cuentas, transferencias y categorías

### Cuentas
- Tipos: efectivo, cuenta bancaria, tarjeta de crédito, ahorro.
- Cada cuenta tiene moneda y saldo inicial. El saldo actual se calcula a partir del saldo inicial y los movimientos.
- Una cuenta se puede archivar (deja de aparecer, pero conserva su historial).

### Transferencias
- Una transferencia mueve dinero entre dos cuentas del hogar y **no cuenta como gasto ni como ingreso** en el presupuesto ni en los reportes.
- Se guarda como dos movimientos enlazados por un `transfer_id`: una salida de la cuenta origen y una entrada en la cuenta destino.
- Entre cuentas de distinta moneda, el usuario registra el monto que salió y el que llegó, porque el banco aplica su propio tipo de cambio. La app sugiere el monto de llegada con el tipo de cambio del día y muestra la tasa resultante.
- El pago de una tarjeta de crédito es una transferencia desde la cuenta bancaria hacia la tarjeta.

### Categorías y subcategorías
- Dos niveles: categoría y subcategoría (por ejemplo, Hogar → Electricidad, Agua, Internet).
- Un movimiento se asigna a una subcategoría, o directamente a la categoría si no tiene subcategorías.
- El gasto de una categoría incluye el de todas sus subcategorías.
- El presupuesto se puede definir a nivel de categoría, de subcategoría o ambos. Si una categoría tiene presupuestos en sus subcategorías, su presupuesto total es como mínimo la suma de ellos.
- Categorías y subcategorías se pueden renombrar, reordenar y archivar sin perder el historial.

## 7. Modelo de datos

| Tabla | Campos principales |
|---|---|
| `households` | id, nombre, moneda_base (CRC), tasa_preferida (compra/venta/promedio) |
| `household_members` | household_id, user_id, rol (admin/miembro) |
| `invitations` | household_id, correo, token, estado, fecha_expiración |
| `accounts` | id, household_id, nombre, tipo, moneda, saldo_inicial, archivada |
| `categories` | id, household_id, parent_id (null si es categoría principal), nombre, tipo (gasto/ingreso), ícono, color, orden, archivada |
| `transactions` | id, household_id, account_id, category_id, tipo (gasto/ingreso/transferencia), transfer_id, pagado_por, fecha, monto_original, moneda_original, tipo_cambio, monto_crc, monto_usd, nota |
| `budgets` | id, household_id, category_id, mes, monto, moneda |
| `exchange_rates` | fecha, compra, venta, fuente |

## 8. Pantallas del MVP

1. **Inicio de sesión / registro.**
2. **Configuración inicial:** crear hogar, invitar miembros, crear cuentas.
3. **Inicio (resumen del mes):** total gastado contra presupuesto, categorías con barra de progreso, selector ₡/$.
4. **Nuevo gasto:** formulario rápido optimizado para el teléfono.
5. **Nueva transferencia:** cuenta origen, cuenta destino, monto que sale y monto que llega.
6. **Cuentas:** lista con saldo actual de cada cuenta; crear, editar y archivar.
7. **Movimientos:** lista filtrable por mes, categoría, subcategoría, cuenta y persona; editar y eliminar.
8. **Presupuestos:** monto mensual por categoría y subcategoría; copiar el del mes anterior.
9. **Categorías:** árbol de categorías y subcategorías; crear, renombrar, reordenar y archivar.
10. **Ajustes:** miembros, tasa preferida.

## 9. Fases e issues

### Fase 0: Fundaciones
- [ ] Crear el proyecto React + TypeScript + Vite en `/app`.
- [ ] Configurar ESLint, Prettier y Vitest.
- [ ] Crear el proyecto en Supabase y conectar el CLI al repo.
- [ ] Configurar GitHub Actions (lint, pruebas, build).
- [ ] Conectar el repo a Vercel/Netlify.

### Fase 1: Usuarios y hogares
- [ ] Migración: `households`, `household_members`, `invitations` con RLS.
- [ ] Registro e inicio de sesión.
- [ ] Crear hogar al registrarse.
- [ ] Invitar miembros por correo y aceptar invitación.

### Fase 2: Tipo de cambio
- [ ] Registro en el servicio web del BCCR.
- [ ] Migración: `exchange_rates`.
- [ ] Edge Function que consulta BCCR (con respaldo) y guarda el valor del día.
- [ ] Programar la función diaria.
- [ ] Función para obtener el tipo de cambio de una fecha (con el último disponible como fallback).

### Fase 3: Cuentas y categorías
- [ ] Migración: `accounts` y `categories` (con `parent_id`) con RLS.
- [ ] Pantalla de cuentas: crear, editar, archivar y ver saldo.
- [ ] Categorías y subcategorías por defecto al crear un hogar.
- [ ] Pantalla de categorías: crear, renombrar, reordenar y archivar.

### Fase 4: Movimientos y transferencias
- [ ] Migración: `transactions` con RLS.
- [ ] Pantalla de nuevo gasto/ingreso con conversión automática.
- [ ] Transferencias entre cuentas, incluidas las de distinta moneda.
- [ ] Cálculo del saldo de cada cuenta.
- [ ] Lista de movimientos con filtros, edición y borrado.
- [ ] Sincronización en tiempo real entre miembros.

### Fase 5: Presupuestos y resumen
- [ ] Migración: `budgets`.
- [ ] Pantalla de presupuestos por categoría y subcategoría.
- [ ] Resumen del mes con progreso por categoría (incluyendo subcategorías) y por persona.
- [ ] Selector ₡/$ global.

### Fase 6: PWA y lanzamiento
- [ ] Manifest e íconos para instalar en el teléfono.
- [ ] Modo sin conexión básico (registrar gastos y sincronizar después).
- [ ] Pruebas con la familia y ajustes.

## 10. Forma de trabajo en GitHub

- Rama `main` protegida: los cambios entran por pull request.
- Una rama por issue (`feat/nuevo-gasto`, `fix/tipo-cambio-feriados`).
- Milestones de GitHub por fase.
- Secretos (token del BCCR, llaves de Supabase) en GitHub Secrets y variables de entorno, nunca en el código.

## 11. Decisiones pendientes

- Tasa por defecto para convertir: compra, venta o promedio.
- Vercel o Netlify para el hosting.
- Categorías y subcategorías por defecto del hogar.
