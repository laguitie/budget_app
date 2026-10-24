# Plan del proyecto: Budget App familiar

## 1. Objetivo

Una app de presupuesto para el hogar, compartida entre los miembros de la familia, que se usa desde el teléfono y la computadora. Maneja gastos en colones (₡) y dólares ($) con conversión automática según el tipo de cambio del día.

### Motivación

Hoy el presupuesto se lleva en HomeBudget (iPhone): presupuesto mensual, ingresos y gastos. La mayoría de los pagos se hacen con tarjeta y el banco envía un comprobante por correo, pero cada gasto se vuelve a digitar a mano en la app. Ese trabajo manual es lo que este proyecto quiere eliminar.

### Lo que la diferencia

La base es una app de presupuesto similar a HomeBudget. Lo nuevo es un **asistente de IA** que hace el trabajo repetitivo:

1. **Gastos desde el correo:** cada comprobante de compra que llega por correo se convierte automáticamente en un gasto.
2. **Conciliación de estados de cuenta:** se sube el PDF del estado de cuenta de la tarjeta o el banco y el asistente lo compara contra los movimientos registrados (faltantes, duplicados, montos distintos).
3. **Voz y lenguaje natural:** agregar gastos o ingresos y hacer consultas ("¿cuánto llevo en supermercado este mes?") por voz o texto, desde Siri, desde la app o desde un agente de IA externo.

El MVP construye la base manual, pero el modelo de datos se diseña desde el inicio pensando en el asistente (ver sección 7).

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

- Asistente de IA: gastos desde el correo, conciliación de estados de cuenta en PDF, voz y agentes externos (fases 7 a 9, ver sección 7). Es el objetivo principal del proyecto; queda fuera del MVP solo porque necesita la base de cuentas, categorías y movimientos.
- Importar el historial de HomeBudget (exportación en CSV) para no empezar de cero.
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
| IA | API de Claude (Anthropic), llamada desde Edge Functions | Extraer gastos de correos y PDFs, interpretar instrucciones en lenguaje natural |
| Agentes externos | Servidor MCP (Model Context Protocol) | Que Claude u otros asistentes de IA consulten y registren movimientos |
| Correo entrante | Servicio de correo entrante con webhook (Postmark, Mailgun o Cloudflare Email Routing) | Recibir los comprobantes reenviados y pasarlos a una Edge Function |

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

## 7. Asistente de IA

### Principios

- **Una sola puerta de entrada:** la app, el correo, la voz y los agentes externos registran movimientos por las mismas funciones del backend, con las mismas reglas (conversión de moneda, categorías, RLS). Ningún canal escribe directo en las tablas con reglas propias.
- **Revisión antes de confirmar:** todo movimiento creado por el asistente entra como **pendiente** y aparece en una bandeja para confirmarlo, corregirlo o descartarlo. Cuando las reglas sean confiables, se podrá activar la confirmación automática por remitente o comercio.
- **Aprende de las correcciones:** cuando el usuario corrige la categoría o cuenta de un comercio, se guarda una regla (`merchant_rules`) para la próxima vez.
- **El contenido externo es solo datos:** correos y PDFs pueden traer texto malicioso. El asistente solo extrae campos (fecha, comercio, monto, moneda, últimos dígitos de la tarjeta); nunca sigue instrucciones que vengan dentro del documento, y solo puede crear movimientos pendientes.
- **Cada movimiento sabe de dónde vino:** campo `origen` (manual, correo, estado de cuenta, voz, agente) y referencia al documento original.

### 7.1 Gastos desde el correo

- **Flujo:** un filtro de Gmail reenvía automáticamente los comprobantes del banco a una dirección propia del hogar (ej. `hogar-xxxx@entrada.dominio`). El servicio de correo entrante llama a una Edge Function, que guarda el mensaje, extrae los datos con Claude y crea el gasto pendiente.
- **Alternativa:** leer el buzón con la API de Gmail. Evita configurar el reenvío, pero requiere permisos de lectura del correo y la verificación de Google para OAuth; queda como opción posterior.
- Solo se aceptan remitentes de una lista permitida por hogar (los dominios de los bancos).
- La cuenta se identifica por los últimos 4 dígitos de la tarjeta que trae el comprobante (campo `ultimos_digitos` en `accounts`).
- Se detectan duplicados (mismo monto, fecha y comercio) para no registrar dos veces el mismo gasto.

### 7.2 Conciliación de estados de cuenta

- Se sube el PDF del estado de cuenta y se elige la cuenta y el período.
- Claude extrae cada línea (fecha, descripción, monto, moneda) y la app las empareja con los movimientos del período, tolerando diferencias de uno o dos días y descripciones distintas del mismo comercio.
- Resultado: líneas conciliadas, líneas del estado que faltan en la app (con botón para crearlas) y movimientos de la app que no están en el estado.
- Los PDFs se guardan en Supabase Storage, con acceso limitado al hogar.

### 7.3 Voz, lenguaje natural y agentes externos

- **Comandos en texto o voz:** una Edge Function recibe una instrucción ("gasté 12 mil colones en el súper con la tarjeta BAC") y usa Claude con herramientas (registrar gasto, registrar ingreso, consultar resumen, consultar presupuesto) para ejecutarla.
- **Siri:** un Atajo de iOS dicta la instrucción y la envía por HTTP a esa Edge Function con un token personal; la respuesta se lee en voz alta. No requiere app nativa.
- **Dentro de la app:** un campo de chat o micrófono que usa la misma función.
- **Agentes externos:** un servidor MCP expone las mismas herramientas para que Claude (u otro asistente compatible) consulte y registre movimientos. Se autentica con tokens personales que se pueden revocar.

## 8. Modelo de datos

| Tabla | Campos principales |
|---|---|
| `households` | id, nombre, moneda_base (CRC), tasa_preferida (compra/venta/promedio) |
| `household_members` | household_id, user_id, rol (admin/miembro) |
| `invitations` | household_id, correo, token, estado, fecha_expiración |
| `accounts` | id, household_id, nombre, tipo, moneda, saldo_inicial, ultimos_digitos (tarjetas), archivada |
| `categories` | id, household_id, parent_id (null si es categoría principal), nombre, tipo (gasto/ingreso), ícono, color, orden, archivada |
| `transactions` | id, household_id, account_id, category_id, tipo (gasto/ingreso/transferencia), transfer_id, pagado_por, fecha, monto_original, moneda_original, tipo_cambio, monto_crc, monto_usd, comercio, nota, origen (manual/correo/estado_cuenta/voz/agente), estado (confirmado/pendiente), referencia_origen |
| `budgets` | id, household_id, category_id, mes, monto, moneda |
| `exchange_rates` | fecha, compra, venta, fuente |

Tablas del asistente de IA (fases 7 a 9). Los campos `comercio`, `origen`, `estado` y `referencia_origen` de `transactions` y `ultimos_digitos` de `accounts` se crean desde el MVP para no tener que migrar datos después.

| Tabla | Campos principales |
|---|---|
| `merchant_rules` | id, household_id, patrón del comercio, category_id, account_id |
| `inbound_emails` | id, household_id, remitente, asunto, cuerpo, recibido_en, estado (procesado/error/ignorado), transaction_id |
| `allowed_senders` | household_id, dominio o correo del remitente |
| `statements` | id, household_id, account_id, período, ruta del PDF, estado |
| `statement_lines` | id, statement_id, fecha, descripción, monto, moneda, transaction_id, estado (conciliada/faltante/diferencia) |
| `api_tokens` | id, household_id, user_id, nombre, hash del token, último_uso, revocado |

## 9. Pantallas del MVP

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

Pantallas del asistente (fases 7 a 9):

- **Pendientes:** bandeja de movimientos creados por el asistente para confirmar, corregir o descartar.
- **Conciliación:** subir un estado de cuenta en PDF y revisar el resultado línea por línea.
- **Asistente:** chat y micrófono para dar instrucciones y hacer consultas.
- **Integraciones (en Ajustes):** dirección de correo del hogar, remitentes permitidos, reglas por comercio y tokens para Siri y agentes externos.

## 10. Fases e issues

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

### Fase 7: Gastos desde el correo
- [ ] Reunir comprobantes reales de cada banco/tarjeta (sin datos sensibles) como casos de prueba.
- [ ] Migraciones: `inbound_emails`, `allowed_senders`, `merchant_rules`.
- [ ] Configurar el servicio de correo entrante y la dirección del hogar.
- [ ] Edge Function: recibir el correo, validar el remitente, extraer los datos con Claude y crear el gasto pendiente.
- [ ] Detección de duplicados.
- [ ] Bandeja de pendientes: confirmar, corregir y descartar.
- [ ] Guardar reglas por comercio a partir de las correcciones.
- [ ] Instrucciones para crear el filtro de reenvío en Gmail.

### Fase 8: Conciliación de estados de cuenta
- [ ] Migraciones: `statements`, `statement_lines` y bucket de Storage con acceso por hogar.
- [ ] Subir el PDF y extraer las líneas con Claude.
- [ ] Algoritmo de emparejamiento con tolerancia de fechas y descripciones.
- [ ] Pantalla de resultados: crear faltantes, revisar diferencias.

### Fase 9: Voz y agentes externos
- [ ] Migración: `api_tokens`; pantalla para crear y revocar tokens.
- [ ] Edge Function de comandos en lenguaje natural con herramientas (registrar, consultar).
- [ ] Atajo de iOS para Siri, con instrucciones de instalación.
- [ ] Chat y micrófono dentro de la app.
- [ ] Servidor MCP con las mismas herramientas.

## 11. Forma de trabajo en GitHub

- Rama `main` protegida: los cambios entran por pull request.
- Una rama por issue (`feat/nuevo-gasto`, `fix/tipo-cambio-feriados`).
- Milestones de GitHub por fase.
- Secretos (token del BCCR, llaves de Supabase, llave de la API de Claude, llave del servicio de correo) en GitHub Secrets y variables de entorno, nunca en el código.
- Los correos y estados de cuenta de prueba que se versionen en el repo deben ir anonimizados.

## 12. Decisiones pendientes

- Tasa por defecto para convertir: compra, venta o promedio.
- Vercel o Netlify para el hosting.
- Categorías y subcategorías por defecto del hogar. Se pueden tomar de las que ya se usan en HomeBudget.
- Cómo llegan los correos: reenvío automático a una dirección propia (recomendado para empezar) o lectura del buzón con la API de Gmail.
- Servicio de correo entrante: Postmark, Mailgun o Cloudflare Email Routing (este último requiere un dominio propio en Cloudflare).
- Cuándo activar la confirmación automática de gastos del correo, en lugar de la bandeja de pendientes.
- Qué bancos y tarjetas cubrir primero (según los comprobantes que llegan hoy).
