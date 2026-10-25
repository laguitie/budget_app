/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(__dirname, '../../../../supabase/migrations')

export const users = {
  ana: '00000000-0000-0000-0000-00000000000a',
  beto: '00000000-0000-0000-0000-00000000000b',
  carla: '00000000-0000-0000-0000-00000000000c',
}

// Postgres en memoria con una imitación mínima de lo que Supabase ya trae
// (roles anon/authenticated, esquema auth y auth.uid()) más todas las migraciones.
export async function createTestDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    grant usage on schema auth to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values
      ('${users.ana}', 'ana@example.com'),
      ('${users.beto}', 'Beto@example.com'),
      ('${users.carla}', 'carla@example.com');
  `)
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.endsWith('.sql')) {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
    }
  }

  // Ejecuta una consulta como un usuario (o sin sesión, con null), con RLS activo.
  async function as<T = Record<string, unknown>>(
    userId: string | null,
    sql: string,
    params: unknown[] = [],
  ) {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
      userId ?? '',
    ])
    await db.exec(userId ? 'set role authenticated' : 'set role anon')
    return db.query<T>(sql, params)
  }

  // Consulta como superusuario, sin RLS (para preparar casos de prueba).
  async function asAdmin(sql: string, params: unknown[] = []) {
    await db.exec('reset role')
    return db.query(sql, params)
  }

  return { as, asAdmin }
}
