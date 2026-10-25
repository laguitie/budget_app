// Consulta el tipo de cambio de referencia del BCCR y lo guarda en
// public.exchange_rates. La llama un cron de la base de datos varias veces al día.
//
// Secretos: BCCR_TOKEN (token del SDDE) y EXCHANGE_RATES_CRON_SECRET (lo envía
// el cron en el encabezado x-cron-secret). SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY los provee Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  BCCR_BUY,
  BCCR_SELL,
  combineSeries,
  costaRicaDate,
  type DailyRate,
  parseHacienda,
  parseSddeSeries,
  sddeDate,
} from './rates.ts'

const SDDE_URL =
  'https://apim.bccr.fi.cr/SDDE/api/Bccr.GE.SDDE.Publico.Indicadores.API/indicadoresEconomicos'
const HACIENDA_URL = 'https://api.hacienda.go.cr/indicadores/tc/dolar'
const DAYS_BACK = 10

async function fetchJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}`)
  return response.json()
}

async function fetchBccr(
  token: string,
  from: string,
  to: string,
): Promise<DailyRate[]> {
  const query = new URLSearchParams({
    fechaInicio: sddeDate(from),
    fechaFin: sddeDate(to),
    idioma: 'ES',
  })
  const headers = { Authorization: `Bearer ${token}` }
  const [buy, sell] = await Promise.all(
    [BCCR_BUY, BCCR_SELL].map(async (code) =>
      parseSddeSeries(
        await fetchJson(`${SDDE_URL}/${code}/series?${query}`, headers),
      ),
    ),
  )
  return combineSeries(buy, sell)
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('EXCHANGE_RATES_CRON_SECRET')
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const now = new Date()
  const from = costaRicaDate(now, -DAYS_BACK)
  // Incluye mañana: el BCCR publica la tasa del día siguiente por la tarde.
  const to = costaRicaDate(now, 1)

  let rates: DailyRate[] = []
  let source = 'BCCR'
  const errors: string[] = []

  try {
    rates = await fetchBccr(Deno.env.get('BCCR_TOKEN') ?? '', from, to)
  } catch (error) {
    errors.push(`BCCR: ${error instanceof Error ? error.message : error}`)
  }

  if (rates.length === 0) {
    try {
      rates = [parseHacienda(await fetchJson(HACIENDA_URL))]
      source = 'Hacienda'
    } catch (error) {
      errors.push(`Hacienda: ${error instanceof Error ? error.message : error}`)
    }
  }

  if (rates.length === 0) {
    console.error('No se obtuvo el tipo de cambio', errors)
    return Response.json(
      { error: 'No se obtuvo el tipo de cambio', errors },
      { status: 502 },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const fetchedAt = now.toISOString()
  const { error } = await supabase
    .from('exchange_rates')
    .upsert(rates.map((rate) => ({ ...rate, source, fetched_at: fetchedAt })))

  if (error) {
    console.error('No se pudo guardar el tipo de cambio', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    source,
    saved: rates.length,
    latest: rates.at(-1),
    errors,
  })
})
