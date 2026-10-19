-- Migration 066: manutenção de memória (Fase 4) — backfill de embeddings + compilação L3
-- Rodar no SQL Editor do Supabase, APÓS o 065.
-- NÃO-destrutiva: só cria índice único + funções + agenda o cron. Nada é apagado.

-- 1) Índice único (ref_type, ref_id): garante 1 vetor por fato/resumo/episódio.
--    Torna o backfill idempotente (on conflict do nothing) e impede vetor duplicado
--    (que apareceria 2x no recall).
create unique index if not exists memory_vectors_ref_unique
  on memory_vectors (ref_type, ref_id);

-- 2) Fatos sem vetor (memórias pré-Fase 2 que nunca foram embedadas).
create or replace function get_unembedded_facts(p_limit int default 500)
returns table (memory_id uuid, user_id uuid, fact text)
language sql stable
as $$
  select um.id, um.user_id, um.fact
  from user_memories um
  left join memory_vectors mv
    on mv.ref_type = 'fact' and mv.ref_id = um.id
  where um.archived = false
    and mv.id is null
  order by um.created_at asc
  limit p_limit;
$$;

-- 3) Insere um vetor de forma idempotente (backfill). O cast ::vector é feito no SQL —
--    o supabase-js não consegue gravar o tipo vector direto.
create or replace function insert_memory_vector(
  p_user_id uuid,
  p_ref_type text,
  p_ref_id uuid,
  p_text text,
  p_embedding text
)
returns void
language plpgsql
as $$
begin
  insert into memory_vectors (user_id, ref_type, ref_id, text, embedding)
  values (p_user_id, p_ref_type, p_ref_id, p_text, p_embedding::vector)
  on conflict (ref_type, ref_id) do nothing;
end;
$$;

-- 4) Usuários com >= p_min fatos ainda não resumidos (candidatos à compilação).
--    "Ainda não resumidos" = não aparecem em nenhum source_memory_ids de summary.
create or replace function get_compile_candidates(p_min int default 20)
returns table (user_id uuid, pending_count bigint)
language sql stable
as $$
  with summarized as (
    select s.user_id, unnest(s.source_memory_ids) as memory_id
    from memory_summaries s
  )
  select um.user_id, count(*)::bigint as pending_count
  from user_memories um
  where um.archived = false
    and um.id not in (
      select memory_id from summarized s2 where s2.user_id = um.user_id
    )
  group by um.user_id
  having count(*) >= p_min
  order by count(*) desc;
$$;

-- 5) Agenda o cron de manutenção (a cada hora). Backfill é barato quando não há
--    nada pendente; compilação só age quando um usuário cruza o limiar.
select cron.unschedule('memory-maintenance') where exists (
  select 1 from cron.job where jobname = 'memory-maintenance'
);

select cron.schedule(
  'memory-maintenance',
  '0 * * * *',
  $job$
    select net.http_get(
      url := 'https://mayaapp.life/api/cron/memory-maintenance'
    ) as request_id;
  $job$
);
