-- 058: monitoramento de gestão — log de erros + sinais de risco + resumo diário do admin.
--
-- 1) error_logs  : registro de erros de API (visibilidade de 500s em produção).
-- 2) safety_flags: check-in com pensamentos autodestrutivos, idempotente por usuário/dia.
-- 3) admin-digest: cron diário que manda um resumo por push aos admins (09:00 São Paulo).

-- a) Log de erros de API (service-role only — sem policy, como 056/057).
create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text,
  message text,
  status int,
  meta jsonb
);
create index if not exists error_logs_created_at_idx on error_logs (created_at desc);
alter table error_logs enable row level security;

-- b) Sinais de risco (pensamentos autodestrutivos no check-in).
create table if not exists safety_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists safety_flags_created_at_idx on safety_flags (created_at desc);
alter table safety_flags enable row level security;

-- c) Cron diário: resumo do admin. pg_cron roda em UTC; 12:00 UTC = 09:00 America/Sao_Paulo.
select cron.unschedule('admin-digest') where exists (
  select 1 from cron.job where jobname = 'admin-digest'
);

select cron.schedule(
  'admin-digest',
  '0 12 * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/admin-digest'
    ) as request_id;
  $job$
);
