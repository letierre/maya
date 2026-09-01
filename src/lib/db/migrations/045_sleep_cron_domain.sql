-- Fix the sleep-reminders cron job to point at the current production domain.
-- 007_sleep_cron.sql hardcoded projeto-saude-red.vercel.app (old domain).
-- Production is projeto-saude-tau.vercel.app. Re-schedule with the correct URL.

select cron.unschedule('sleep-reminders') where exists (
  select 1 from cron.job where jobname = 'sleep-reminders'
);

select cron.schedule(
  'sleep-reminders',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://projeto-saude-tau.vercel.app/api/cron/sleep-reminders'
    ) as request_id;
  $job$
);
