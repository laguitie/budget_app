// Lógica pura del tipo de cambio (sin Deno ni red), para poder probarla con Vitest.

export type DailyRate = { date: string; buy: number; sell: number }

type SddeResponse = {
  estado?: boolean
  mensaje?: string
  datos?: {
    codigoIndicador?: string
    series?: { fecha?: string; valorDatoPorPeriodo?: number | null }[]
  }[]
}

type HaciendaResponse = {
  compra?: { fecha?: string; valor?: number }
  venta?: { fecha?: string; valor?: number }
}

export const BCCR_BUY = 317
export const BCCR_SELL = 318

const DATE = /^\d{4}-\d{2}-\d{2}$/

function validRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

// Fecha de hoy en Costa Rica (UTC-6, sin horario de verano) más `offsetDays`.
export function costaRicaDate(now: Date, offsetDays = 0): string {
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays)
  return shifted.toISOString().slice(0, 10)
}

// El API del SDDE pide las fechas como yyyy/mm/dd.
export function sddeDate(isoDate: string): string {
  return isoDate.replaceAll('-', '/')
}

export function parseSddeSeries(body: SddeResponse): Map<string, number> {
  if (!body.estado) {
    throw new Error(
      `El BCCR respondió con error: ${body.mensaje ?? 'sin mensaje'}`,
    )
  }
  const values = new Map<string, number>()
  for (const point of body.datos?.[0]?.series ?? []) {
    if (
      point.fecha &&
      DATE.test(point.fecha) &&
      validRate(point.valorDatoPorPeriodo)
    ) {
      values.set(point.fecha, Math.round(point.valorDatoPorPeriodo * 100) / 100)
    }
  }
  return values
}

// Une las series de compra y venta; solo quedan los días que tienen ambas.
export function combineSeries(
  buy: Map<string, number>,
  sell: Map<string, number>,
): DailyRate[] {
  const rates: DailyRate[] = []
  for (const [date, buyValue] of buy) {
    const sellValue = sell.get(date)
    if (sellValue !== undefined)
      rates.push({ date, buy: buyValue, sell: sellValue })
  }
  return rates.sort((a, b) => a.date.localeCompare(b.date))
}

export function parseHacienda(body: HaciendaResponse): DailyRate {
  const { compra, venta } = body
  if (
    !compra?.fecha ||
    !DATE.test(compra.fecha) ||
    compra.fecha !== venta?.fecha ||
    !validRate(compra.valor) ||
    !validRate(venta.valor)
  ) {
    throw new Error('Respuesta de Hacienda con formato inesperado')
  }
  return { date: compra.fecha, buy: compra.valor, sell: venta.valor }
}
