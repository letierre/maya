-- Enable pg_cron (requires superuser — run in Supabase SQL editor as postgres)
create extension if not exists pg_cron with schema extensions;

-- Enable pg_net for HTTP calls from SQL
create extension if not exists pg_net with schema extensions;

-- Grant usage to postgres role (needed in some Supabase versions)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Remove any previous version of this job
select cron.unschedule('sleep-reminders') where exists (
  select 1 from cron.job where jobname = 'sleep-reminders'
);

-- Schedule: every minute, call the sleep-reminders endpoint
-- CRON_SECRET env var must NOT be set on Vercel (or remove the check),
-- since pg_net calls without authorization header.
select cron.schedule(
  'sleep-reminders',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://projeto-saude-red.vercel.app/api/cron/sleep-reminders'
    ) as request_id;
  $job$
);
