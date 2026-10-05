-- Agenda o cron do "push proativo da Maya": a cada 5 min, a rota checa se há
-- usuários que ainda não falaram com a Maya hoje e, dentro da janela ativa deles,
-- manda uma saudação + uma pergunta curta por push (2 notificações quase juntas).
-- Regras: 1x a cada 2–3 dias, folga extra se não respondeu a anterior, e nunca
-- interrompe quem já conversou hoje.

select cron.unschedule('maya-proactive') where exists (
  select 1 from cron.job where jobname = 'maya-proactive'
);

select cron.schedule(
  'maya-proactive',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/maya-proactive'
    ) as request_id;
  $job$
);
