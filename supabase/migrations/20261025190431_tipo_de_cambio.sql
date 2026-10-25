-- Fase 2: tipo de cambio colón/dólar.
--
-- Un registro por día con el tipo de cambio de referencia de compra y venta.
-- Lo escribe solo la Edge Function `exchange-rates` (con la llave de servicio);
-- los usuarios con sesión solo lo leen.

create table public.exchange_rates (
  date date primary key,
  buy numeric(10, 2) not null check (buy > 0),
  sell numeric(10, 2) not null check (sell > 0),
  source text not null,
  fetched_at timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;

revoke all on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to authenticated;

create policy "Cualquier usuario con sesión lee el tipo de cambio"
  on public.exchange_rates for select to authenticated
  using (true);

-- Tipo de cambio vigente en una fecha: el de ese día o, si no hay (fin de
-- semana, feriado o falla de la consulta), el último publicado antes.
create function public.exchange_rate_on(
  p_date date default (now() at time zone 'America/Costa_Rica')::date
)
returns public.exchange_rates
language sql
stable
set search_path = ''
as $$
  select *
  from public.exchange_rates
  where date <= p_date
  order by date desc
  limit 1;
$$;

revoke execute on function public.exchange_rate_on(date) from public, anon;
grant execute on function public.exchange_rate_on(date) to authenticated;
