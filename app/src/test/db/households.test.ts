// @vitest-environment node
import { createTestDb, users } from './pglite'

const { ana, beto, carla } = users
type Db = Awaited<ReturnType<typeof createTestDb>>

async function createHousehold(db: Db) {
  const { rows } = await db.as<{ id: string }>(
    ana,
    `select public.create_household('Casa Ana', 'Ana') as id`,
  )
  return rows[0].id
}

async function invite(db: Db, householdId: string, email: string) {
  const { rows } = await db.as<{ token: string }>(
    ana,
    `select public.create_invitation($1, $2) as token`,
    [householdId, email],
  )
  return rows[0].token
}

describe('hogares', () => {
  let db: Db
  let householdId: string

  beforeEach(async () => {
    db = await createTestDb()
    householdId = await createHousehold(db)
  })

  it('quien crea el hogar queda como administrador', async () => {
    const { rows } = await db.as(
      ana,
      `select role from public.household_members`,
    )
    expect(rows).toEqual([{ role: 'admin' }])
  })

  it('no permite pertenecer a dos hogares', async () => {
    await expect(
      db.as(ana, `select public.create_household('Otra', 'Ana')`),
    ).rejects.toThrow('Ya perteneces a un hogar.')
  })

  it('rechaza un nombre de hogar vacío', async () => {
    await expect(
      db.as(carla, `select public.create_household('   ', 'Carla')`),
    ).rejects.toThrow('households_name_check')
  })

  it('otro usuario no ve el hogar, sus miembros ni sus invitaciones', async () => {
    await invite(db, householdId, 'beto@example.com')
    for (const table of ['households', 'household_members', 'invitations']) {
      const { rows } = await db.as(carla, `select * from public.${table}`)
      expect(rows).toHaveLength(0)
    }
  })

  it('sin sesión no se pueden leer las tablas', async () => {
    await expect(
      db.as(null, `select * from public.households`),
    ).rejects.toThrow('permission denied')
  })

  it('solo el administrador renombra el hogar', async () => {
    const token = await invite(db, householdId, 'beto@example.com')
    await db.as(beto, `select public.accept_invitation($1, 'Beto')`, [token])

    const byMember = await db.as(
      beto,
      `update public.households set name = 'X'`,
    )
    expect(byMember.affectedRows).toBe(0)
    const byAdmin = await db.as(ana, `update public.households set name = 'Y'`)
    expect(byAdmin.affectedRows).toBe(1)
  })

  it('nadie cambia campos protegidos ni su propio rol', async () => {
    await expect(
      db.as(ana, `update public.households set created_by = auth.uid()`),
    ).rejects.toThrow('permission denied')
    await expect(
      db.as(ana, `update public.household_members set role = 'miembro'`),
    ).rejects.toThrow('permission denied')
    await expect(
      db.as(
        carla,
        `insert into public.household_members values ($1, auth.uid(), 'admin', 'C')`,
        [householdId],
      ),
    ).rejects.toThrow('permission denied')
  })

  it('cada miembro edita solo su propio nombre', async () => {
    const token = await invite(db, householdId, 'beto@example.com')
    await db.as(beto, `select public.accept_invitation($1, 'Beto')`, [token])

    const own = await db.as(
      beto,
      `update public.household_members set display_name = 'Roberto' where user_id = auth.uid()`,
    )
    expect(own.affectedRows).toBe(1)
    const other = await db.as(
      beto,
      `update public.household_members set display_name = 'X' where user_id <> auth.uid()`,
    )
    expect(other.affectedRows).toBe(0)
  })
})

describe('invitaciones', () => {
  let db: Db
  let householdId: string

  beforeEach(async () => {
    db = await createTestDb()
    householdId = await createHousehold(db)
  })

  it('se pueden ver sin sesión con el enlace', async () => {
    const token = await invite(db, householdId, ' Beto@Example.com ')
    const { rows } = await db.as(
      null,
      `select * from public.get_invitation($1)`,
      [token],
    )
    expect(rows).toEqual([
      {
        household_name: 'Casa Ana',
        email: 'beto@example.com',
        status: 'pendiente',
        invited_by_name: 'Ana',
      },
    ])
  })

  it('un enlace inexistente no devuelve nada', async () => {
    const { rows } = await db.as(
      null,
      `select * from public.get_invitation(gen_random_uuid())`,
    )
    expect(rows).toHaveLength(0)
  })

  it('reinvitar revoca el enlace anterior', async () => {
    const first = await invite(db, householdId, 'beto@example.com')
    const second = await invite(db, householdId, 'beto@example.com')
    expect(second).not.toBe(first)
    const { rows } = await db.as(
      ana,
      `select status from public.invitations where token = $1`,
      [first],
    )
    expect(rows).toEqual([{ status: 'revocada' }])
  })

  it('solo el administrador invita', async () => {
    await expect(
      db.as(carla, `select public.create_invitation($1, 'z@example.com')`, [
        householdId,
      ]),
    ).rejects.toThrow('Solo un administrador del hogar puede invitar.')
  })

  it('solo la acepta quien tiene el correo invitado', async () => {
    const token = await invite(db, householdId, 'beto@example.com')
    await expect(
      db.as(carla, `select public.accept_invitation($1, 'Carla')`, [token]),
    ).rejects.toThrow('La invitación es para beto@example.com.')
    await expect(
      db.as(null, `select public.accept_invitation($1, 'X')`, [token]),
    ).rejects.toThrow('permission denied')
  })

  it('al aceptarla se entra como miembro, una sola vez', async () => {
    const token = await invite(db, householdId, 'beto@example.com')
    const { rows } = await db.as<{ id: string }>(
      beto,
      `select public.accept_invitation($1, 'Beto') as id`,
      [token],
    )
    expect(rows[0].id).toBe(householdId)

    const members = await db.as(
      beto,
      `select role from public.household_members`,
    )
    expect(members.rows).toHaveLength(2)
    const invitations = await db.as(beto, `select * from public.invitations`)
    expect(invitations.rows).toHaveLength(0)
    await expect(
      db.as(beto, `select public.create_invitation($1, 'z@example.com')`, [
        householdId,
      ]),
    ).rejects.toThrow('Solo un administrador')
    await expect(
      db.as(beto, `select public.accept_invitation($1, 'Beto')`, [token]),
    ).rejects.toThrow('La invitación ya fue aceptada.')
    await expect(invite(db, householdId, 'beto@example.com')).rejects.toThrow(
      'Esa persona ya es miembro del hogar.',
    )
  })

  it('el administrador revoca, y una revocada no se reactiva', async () => {
    const token = await invite(db, householdId, 'carla@example.com')
    const revoke = await db.as(
      ana,
      `update public.invitations set status = 'revocada' where token = $1`,
      [token],
    )
    expect(revoke.affectedRows).toBe(1)
    const reactivate = await db.as(
      ana,
      `update public.invitations set status = 'pendiente' where token = $1`,
      [token],
    )
    expect(reactivate.affectedRows).toBe(0)
    await expect(
      db.as(carla, `select public.accept_invitation($1, 'Carla')`, [token]),
    ).rejects.toThrow('La invitación no existe o fue revocada.')
  })

  it('una invitación vencida no se puede aceptar', async () => {
    const token = await invite(db, householdId, 'carla@example.com')
    await db.asAdmin(
      `update public.invitations set expires_at = now() - interval '1 day' where token = $1`,
      [token],
    )
    const { rows } = await db.as(
      null,
      `select status from public.get_invitation($1)`,
      [token],
    )
    expect(rows).toEqual([{ status: 'vencida' }])
    await expect(
      db.as(carla, `select public.accept_invitation($1, 'Carla')`, [token]),
    ).rejects.toThrow('La invitación venció.')
  })
})
