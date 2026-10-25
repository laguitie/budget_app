// Solo acepta rutas internas, para que ?siguiente= no pueda llevar a otro sitio.
export function safeRedirect(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/'
  return path
}

export function invitationUrl(token: string): string {
  return `${window.location.origin}/invitacion/${token}`
}
