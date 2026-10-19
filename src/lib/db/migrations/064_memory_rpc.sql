-- Migration 064: RPCs de memória vetorial (Fase 2)
-- Rodar no SQL Editor do Supabase, APÓS o 063 (pgvector já ativo).
-- Idempotente (create or replace).

-- Busca por similaridade: filtra por usuário e só fatos não arquivados.
-- A similaridade é cosseno (1 = idêntico). O filtro user_id é inegociável:
-- nunca fazer busca vetorial cruzando usuários.
create or replace function match_memory_facts(
  p_user_id uuid,
  query_embedding text,
  match_count int default 3
)
returns table (
  memory_id uuid,
  fact text,
  similarity float
)
language sql stable
as $$
  select um.id, um.fact,
         1 - (mv.embedding <=> query_embedding::vector) as similarity
  from memory_vectors mv
  join user_memories um on um.id = mv.ref_id
  where mv.user_id = p_user_id
    and mv.ref_type = 'fact'
    and um.archived = false
  order by mv.embedding <=> query_embedding::vector
  limit match_count;
$$;

-- Insere fato + vetor atomicamente; devolve o id do fato novo.
create or replace function insert_memory_fact(
  p_user_id uuid,
  p_fact text,
  p_kind text,
  p_event_date date,
  p_temporal_hint text,
  p_source text,
  p_importance int,
  p_confidence numeric,
  p_embedding text
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into user_memories (user_id, fact, kind, event_date, temporal_hint, source, importance, confidence)
  values (p_user_id, p_fact, p_kind, p_event_date, p_temporal_hint, p_source, p_importance, p_confidence)
  returning id into new_id;

  insert into memory_vectors (user_id, ref_type, ref_id, text, embedding)
  values (p_user_id, 'fact', new_id, p_fact, p_embedding::vector);

  return new_id;
end;
$$;

-- Atualiza o texto do fato e re-embeds o vetor (merge de fatos complementares).
create or replace function update_memory_fact(
  p_memory_id uuid,
  p_fact text,
  p_embedding text
)
returns void
language plpgsql
as $$
begin
  update user_memories set fact = p_fact where id = p_memory_id;
  update memory_vectors set text = p_fact, embedding = p_embedding::vector
  where ref_type = 'fact' and ref_id = p_memory_id;
end;
$$;
