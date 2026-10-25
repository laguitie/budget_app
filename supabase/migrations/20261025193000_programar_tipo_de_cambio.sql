-- Fase 2: consulta automática del tipo de cambio.
--
-- Cada 6 horas, pg_cron llama a la Edge Function `exchange-rates` con pg_net.
-- El encabezado x-cron-secret sale del secreto `exchange_rates_cron_secret` de
-- Supabase Vault, que se crea aparte (no se guarda en el repo).
--
-- Solo corre donde existen pg_cron y pg_net (Supabase); en el Postgres en
-- memoria de las pruebas se omite.

do $migration$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
    or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron o pg_net no están disponibles; no se programa el tipo de cambio.';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;
  create extension if not exists pg_net with schema extensions;

  perform cron.schedule(
    'tipo-de-cambio',
    '15 */6 * * *',
    $job$
      select net.http_post(
        url := 'https://jycidmxkgwrfjtlixxkb.supabase.co/functions/v1/exchange-rates',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'exchange_rates_cron_secret'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );
end;
$migration$;
