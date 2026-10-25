import { formatColones, formatShortDate } from './format'

describe('formato', () => {
  it('muestra colones con el símbolo y dos decimales', () => {
    expect(formatColones(456.32)).toMatch(/₡\s?456,32/)
  })

  it('muestra la fecha sin desfase de zona horaria', () => {
    expect(formatShortDate('2026-10-25')).toBe('25 de octubre')
  })
})
