-- Fase 1: hogares, miembros e invitaciones.
--
-- Cada usuario pertenece a un solo hogar (por ahora). Las tablas solo se leen
-- directamente; las escrituras que tienen reglas (crear hogar, invitar, aceptar)
-- pasan por funciones RPC para que sean atómicas y no dependan del cliente.

-- Tipos -----------------------------------------------------------------------

create type public.member_role as enum ('admin', 'miembro');
create type public.rate_preference as enum ('compra', 'venta', 'promedio');
create type public.invitation_status as enum ('pendiente', 'aceptada', 'revocada');

-- Tablas ----------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  base_currency text not null default 'CRC' check (base_currency in ('CRC', 'USD')),
  rate_preference public.rate_preference not null default 'venta',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'miembro',
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- Un hogar por usuario en el MVP. Se puede quitar si se soportan varios hogares.
  constraint household_members_one_household_per_user unique (user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  token uuid not null unique default gen_random_uuid(),
  status public.invitation_status not null default 'pendiente',
  invited_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz
);

create index invitations_household_id_idx on public.invitations (household_id);

-- Funciones de apoyo para las políticas RLS ---------------------------------
-- Van en un esquema privado (no expuesto por la API) y con security definer
-- para que las políticas de household_members no se llamen a sí mismas.

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = (select auth.uid())
  );
$$;

create function private.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function private.is_household_member(uuid) from public;
revoke execute on function private.is_household_admin(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_admin(uuid) to authenticated;

-- Permisos y RLS --------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;

revoke all on public.households, public.household_members, public.invitations from anon, authenticated;

grant select on public.households to authenticated;
grant update (name, rate_preference) on public.households to authenticated;

grant select on public.household_members to authenticated;
grant update (display_name) on public.household_members to authenticated;

grant select on public.invitations to authenticated;
grant update (status) on public.invitations to authenticated;

create policy "Los miembros ven su hogar"
  on public.households for select to authenticated
  using (private.is_household_member(id));

create policy "Los administradores editan su hogar"
  on public.households for update to authenticated
  using (private.is_household_admin(id))
  with check (private.is_household_admin(id));

create policy "Los miembros ven a los miembros de su hogar"
  on public.household_members for select to authenticated
  using (private.is_household_member(household_id));

create policy "Cada miembro edita su propio nombre"
  on public.household_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Los administradores ven las invitaciones de su hogar"
  on public.invitations for select to authenticated
  using (private.is_household_admin(household_id));

create policy "Los administradores revocan invitaciones pendientes"
  on public.invitations for update to authenticated
  using (private.is_household_admin(household_id) and status = 'pendiente')
  with check (status = 'revocada');

-- RPC: crear hogar ------------------------------------------------------------

create function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  if exists (select 1 from public.household_members where user_id = v_user_id) then
    raise exception 'Ya perteneces a un hogar.' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_name), v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, v_user_id, 'admin', btrim(p_display_name));

  return v_household_id;
end;
$$;

-- RPC: invitar a un miembro ---------------------------------------------------
-- Si ya había una invitación pendiente para ese correo, se revoca y se crea una
-- nueva con otro enlace (sirve también para reenviar una invitación vencida).

create function public.create_invitation(p_household_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_token uuid;
begin
  if not private.is_household_admin(p_household_id) then
    raise exception 'Solo un administrador del hogar puede invitar.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.household_members m
    join auth.users u on u.id = m.user_id
    where m.household_id = p_household_id
      and lower(u.email) = v_email
  ) then
    raise exception 'Esa persona ya es miembro del hogar.' using errcode = 'P0001';
  end if;

  update public.invitations
  set status = 'revocada'
  where household_id = p_household_id
    and email = v_email
    and status = 'pendiente';

  insert into public.invitations (household_id, email, invited_by)
  values (p_household_id, v_email, v_user_id)
  returning token into v_token;

  return v_token;
end;
$$;

-- RPC: ver una invitación por su enlace ---------------------------------------
-- Se puede llamar sin sesión, para mostrar "Te invitaron a ..." antes de
-- registrarse. Solo quien tiene el enlace conoce el token.

create function public.get_invitation(p_token uuid)
returns table (
  household_name text,
  email text,
  status text,
  invited_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    h.name,
    i.email,
    case
      when i.status = 'pendiente' and i.expires_at < now() then 'vencida'
      else i.status::text
    end,
    m.display_name
  from public.invitations i
  join public.households h on h.id = i.household_id
  left join public.household_members m
    on m.household_id = i.household_id and m.user_id = i.invited_by
  where i.token = p_token;
$$;

-- RPC: aceptar una invitación -------------------------------------------------

create function public.accept_invitation(p_token uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.invitations;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.invitations
  where token = p_token
  for update;

  if not found or v_invitation.status = 'revocada' then
    raise exception 'La invitación no existe o fue revocada.' using errcode = 'P0001';
  end if;

  if v_invitation.status = 'aceptada' then
    raise exception 'La invitación ya fue aceptada.' using errcode = 'P0001';
  end if;

  if v_invitation.expires_at < now() then
    raise exception 'La invitación venció. Pide que te envíen una nueva.' using errcode = 'P0001';
  end if;

  select lower(email) into v_user_email from auth.users where id = v_user_id;

  if v_user_email is distinct from v_invitation.email then
    raise exception 'La invitación es para %. Inicia sesión con ese correo.', v_invitation.email
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.household_members where user_id = v_user_id) then
    raise exception 'Ya perteneces a un hogar.' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_invitation.household_id, v_user_id, 'miembro', btrim(p_display_name));

  update public.invitations
  set status = 'aceptada', accepted_by = v_user_id, accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.household_id;
end;
$$;

-- Permisos de las RPC ---------------------------------------------------------

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.create_invitation(uuid, text) from public, anon;
revoke execute on function public.get_invitation(uuid) from public;
revoke execute on function public.accept_invitation(uuid, text) from public, anon;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text) to authenticated;
grant execute on function public.get_invitation(uuid) to anon, authenticated;
grant execute on function public.accept_invitation(uuid, text) to authenticated;
