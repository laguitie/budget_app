const crc = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatColones(value: number): string {
  return crc.format(value)
}

// '2026-10-25' → '25 de octubre'. Se interpreta como fecha local, sin hora.
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'long',
  })
}
