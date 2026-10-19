-- Migration 065: enrich match_memory_facts p/ o recall por gatilho (Fase 3)
-- Rodar no SQL Editor do Supabase, após o 064.
-- IMPORTANTE: o tipo de retorno muda, então precisa DROP antes (não dá só
-- create or replace). Sem dependências — seguro de dropar.

drop function if exists match_memory_facts(uuid, text, integer);

create function match_memory_facts(
  p_user_id uuid,
  query_embedding text,
  match_count int default 3
)
returns table (
  memory_id uuid,
  fact text,
  created_at timestamptz,
  event_date date,
  temporal_hint text,
  similarity float
)
language sql stable
as $$
  select um.id, um.fact, um.created_at, um.event_date, um.temporal_hint,
         1 - (mv.embedding <=> query_embedding::vector) as similarity
  from memory_vectors mv
  join user_memories um on um.id = mv.ref_id
  where mv.user_id = p_user_id
    and mv.ref_type = 'fact'
    and um.archived = false
  order by mv.embedding <=> query_embedding::vector
  limit match_count;
$$;
