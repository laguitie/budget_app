const authMessages: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  email_not_confirmed: 'Confirma tu correo antes de ingresar.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  over_email_send_rate_limit:
    'Se enviaron demasiados correos. Intenta de nuevo en unos minutos.',
  over_request_rate_limit:
    'Demasiados intentos. Intenta de nuevo en unos minutos.',
  email_address_invalid: 'El correo no es válido.',
}

// Errores que las funciones de la base de datos lanzan con un mensaje ya en español.
const databaseCodes = new Set(['P0001', '42501'])

type ErrorLike = { code?: string; message?: string } | null | undefined

export function errorMessage(error: ErrorLike): string {
  if (error?.code && authMessages[error.code]) return authMessages[error.code]
  if (error?.code && databaseCodes.has(error.code) && error.message) {
    return error.message
  }
  return 'Ocurrió un error. Intenta de nuevo.'
}
