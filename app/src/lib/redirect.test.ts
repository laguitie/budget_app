import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/invitacion/abc')).toBe('/invitacion/abc')
  })

  it('rechaza sitios externos y valores vacíos', () => {
    expect(safeRedirect('https://malicioso.com')).toBe('/')
    expect(safeRedirect('//malicioso.com')).toBe('/')
    expect(safeRedirect(null)).toBe('/')
  })
})
