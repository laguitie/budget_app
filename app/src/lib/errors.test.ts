import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('traduce errores conocidos de inicio de sesión', () => {
    expect(errorMessage({ code: 'invalid_credentials', message: 'x' })).toBe(
      'Correo o contraseña incorrectos.',
    )
  })

  it('usa el mensaje en español de las funciones de la base de datos', () => {
    expect(
      errorMessage({ code: 'P0001', message: 'Ya perteneces a un hogar.' }),
    ).toBe('Ya perteneces a un hogar.')
  })

  it('no muestra mensajes técnicos desconocidos', () => {
    expect(errorMessage({ code: '23505', message: 'duplicate key' })).toBe(
      'Ocurrió un error. Intenta de nuevo.',
    )
    expect(errorMessage(null)).toBe('Ocurrió un error. Intenta de nuevo.')
  })
})
