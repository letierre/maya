-- Trial sem cartão: aviso push ~24h antes de expirar.
--
-- 1) Coluna de idempotência — marca quem já recebeu o lembrete (evita reenvio
--    a cada rodada do cron).
alter table subscriptions add column if not exists trial_reminded_at timestamptz;

-- 2) Agenda o cron (a cada 30 min) que chama o endpoint /api/cron/trial-reminders,
--    lembrando quem está nas últimas 24h de trial.
select cron.unschedule('trial-reminders') where exists (
  select 1 from cron.job where jobname = 'trial-reminders'
);

select cron.schedule(
  'trial-reminders',
  '*/30 * * * *',
  $job$
    select net.http_get(
      url := 'https://projeto-saude-tau.vercel.app/api/cron/trial-reminders'
    ) as request_id;
  $job$
);
