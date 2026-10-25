import { useEffect, useState } from 'react'
import type { Database } from '../lib/database.types'
import { formatColones, formatShortDate } from '../lib/format'
import { supabase } from '../lib/supabase'

type Rate = Database['public']['Tables']['exchange_rates']['Row']

export function ExchangeRateCard() {
  const [rate, setRate] = useState<Rate | null>(null)

  useEffect(() => {
    // Si todavía no hay ningún tipo de cambio, la función devuelve una fila vacía.
    supabase
      .rpc('exchange_rate_on')
      .then(({ data }) => setRate(data?.date ? data : null))
  }, [])

  if (!rate) return null

  return (
    <div className="rate-card">
      <span>Tipo de cambio del {formatShortDate(rate.date)}</span>
      <div className="rate-values">
        <span>
          Compra <strong>{formatColones(rate.buy)}</strong>
        </span>
        <span>
          Venta <strong>{formatColones(rate.sell)}</strong>
        </span>
      </div>
      <small>Fuente: {rate.source}</small>
    </div>
  )
}
