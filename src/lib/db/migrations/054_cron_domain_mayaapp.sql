-- Re-point cron jobs to the new production domain (mayaapp.life).
--
-- Histórico das URLs hardcoded:
--   sleep-reminders : projeto-saude-red.vercel.app (007) → projeto-saude-tau.vercel.app (045)
--   trial-reminders : projeto-saude-tau.vercel.app (050)
--
-- Produção agora é mayaapp.life. Re-agenda ambos com a URL correta.

-- sleep-reminders (a cada minuto)
select cron.unschedule('sleep-reminders') where exists (
  select 1 from cron.job where jobname = 'sleep-reminders'
);

select cron.schedule(
  'sleep-reminders',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/sleep-reminders'
    ) as request_id;
  $job$
);

-- trial-reminders (a cada 30 min)
select cron.unschedule('trial-reminders') where exists (
  select 1 from cron.job where jobname = 'trial-reminders'
);

select cron.schedule(
  'trial-reminders',
  '*/30 * * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/trial-reminders'
    ) as request_id;
  $job$
);
