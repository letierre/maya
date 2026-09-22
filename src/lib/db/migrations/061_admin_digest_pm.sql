-- Re-agenda o resumo diário do admin das 09:00 para as 21:00 (São Paulo).
-- 21:00 America/Sao_Paulo = 00:00 UTC (SP é UTC-3 o ano todo, sem horário de verão).
-- Disparar à noite captura o dia completo (DAU, cadastros, etc.) em vez de resumir
-- o dia de manhã cedo.
select cron.unschedule('admin-digest') where exists (
  select 1 from cron.job where jobname = 'admin-digest'
);

select cron.schedule(
  'admin-digest',
  '0 0 * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/admin-digest'
    ) as request_id;
  $job$
);
