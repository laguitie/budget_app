// @vitest-environment node
import { createTestDb, users } from './pglite'

describe('tipo de cambio', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    db = await createTestDb()
    await db.asAdmin(`
      insert into public.exchange_rates (date, buy, sell, source) values
        ('2026-10-23', 452.44, 456.32, 'BCCR'),
        ('2026-10-24', 450.04, 456.32, 'BCCR')
    `)
  })

  it('cualquier usuario con sesión lo lee, aunque no tenga hogar', async () => {
    const { rows } = await db.as(
      users.carla,
      `select * from public.exchange_rates`,
    )
    expect(rows).toHaveLength(2)
  })

  it('sin sesión no se puede leer', async () => {
    await expect(
      db.as(null, `select * from public.exchange_rates`),
    ).rejects.toThrow('permission denied')
  })

  it('los usuarios no pueden escribirlo', async () => {
    await expect(
      db.as(
        users.ana,
        `insert into public.exchange_rates (date, buy, sell, source) values ('2026-10-25', 1, 1, 'x')`,
      ),
    ).rejects.toThrow('permission denied')
    await expect(
      db.as(users.ana, `update public.exchange_rates set sell = 1`),
    ).rejects.toThrow('permission denied')
  })

  it('usa el último publicado si el día no tiene dato', async () => {
    const { rows } = await db.as<{ date: string; sell: string }>(
      users.ana,
      `select date::text, sell::text from public.exchange_rate_on('2026-10-26')`,
    )
    expect(rows).toEqual([{ date: '2026-10-24', sell: '456.32' }])
  })

  it('no inventa un tipo de cambio antes del primer dato', async () => {
    const { rows } = await db.as<{ date: string | null }>(
      users.ana,
      `select date from public.exchange_rate_on('2020-01-01')`,
    )
    expect(rows).toEqual([{ date: null }])
  })
})
