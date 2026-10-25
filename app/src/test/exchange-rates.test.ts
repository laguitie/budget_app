import {
  combineSeries,
  costaRicaDate,
  parseHacienda,
  parseSddeSeries,
  sddeDate,
} from '../../../supabase/functions/exchange-rates/rates.ts'

function sdde(series: { fecha: string; valorDatoPorPeriodo: number | null }[]) {
  return {
    estado: true,
    mensaje: 'Consulta exitosa',
    datos: [{ codigoIndicador: '317', series }],
  }
}

describe('tipo de cambio', () => {
  it('usa la fecha de Costa Rica, no la de UTC', () => {
    // 25/10 a las 03:00 UTC todavía es 24/10 en Costa Rica.
    expect(costaRicaDate(new Date('2026-10-25T03:00:00Z'))).toBe('2026-10-24')
    expect(costaRicaDate(new Date('2026-10-25T12:00:00Z'))).toBe('2026-10-25')
    expect(costaRicaDate(new Date('2026-10-31T12:00:00Z'), 1)).toBe(
      '2026-11-01',
    )
  })

  it('convierte la fecha al formato del SDDE', () => {
    expect(sddeDate('2026-10-25')).toBe('2026/10/25')
  })

  it('lee la serie del BCCR, redondea a céntimos e ignora datos inválidos', () => {
    const values = parseSddeSeries(
      sdde([
        { fecha: '2026-10-24', valorDatoPorPeriodo: 450.04 },
        { fecha: '2026-10-25', valorDatoPorPeriodo: 456.31999999 },
        { fecha: '2026-10-26', valorDatoPorPeriodo: null },
        { fecha: '2026-10-27', valorDatoPorPeriodo: 0 },
      ]),
    )
    expect([...values]).toEqual([
      ['2026-10-24', 450.04],
      ['2026-10-25', 456.32],
    ])
  })

  it('falla si el BCCR responde con error', () => {
    expect(() =>
      parseSddeSeries({ estado: false, mensaje: 'Token inválido' }),
    ).toThrow('Token inválido')
  })

  it('une compra y venta solo en los días que tienen ambas', () => {
    const buy = new Map([
      ['2026-10-25', 450.04],
      ['2026-10-24', 450.04],
      ['2026-10-26', 451],
    ])
    const sell = new Map([
      ['2026-10-24', 456.32],
      ['2026-10-25', 456.32],
    ])
    expect(combineSeries(buy, sell)).toEqual([
      { date: '2026-10-24', buy: 450.04, sell: 456.32 },
      { date: '2026-10-25', buy: 450.04, sell: 456.32 },
    ])
  })

  it('lee la respuesta de Hacienda', () => {
    expect(
      parseHacienda({
        venta: { fecha: '2026-10-25', valor: 456.32 },
        compra: { fecha: '2026-10-25', valor: 450.04 },
      }),
    ).toEqual({ date: '2026-10-25', buy: 450.04, sell: 456.32 })
    expect(() => parseHacienda({ compra: { fecha: '2026-10-25' } })).toThrow()
  })
})
