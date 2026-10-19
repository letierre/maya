-- Migration 068: contagens/paginação exatas de memória (painel admin)
-- O PostgREST devolve no máx. 1000 linhas por query, o que cegava o painel
-- (lista de fatos e contagem de vetores travavam em 1000). Estas funções
-- fazem o join direto no SQL — contagem exata e página com flag de vetor.

-- Conta quantos fatos ATIVOS do usuário ainda não têm vetor.
create or replace function count_unembedded_facts(p_user_id uuid)
returns bigint
language sql stable
as $$
  select count(*)
  from user_memories um
  left join memory_vectors mv
    on mv.ref_type = 'fact' and mv.ref_id = um.id
  where um.user_id = p_user_id
    and um.archived = false
    and mv.id is null;
$$;

-- Página de fatos (com flag has_vector) — paginação por offset, sem teto do
-- PostgREST atrapalhando (o p_limit da página é pequeno, 500).
create or replace function get_user_memories(
  p_user_id uuid,
  p_offset int default 0,
  p_limit int default 500
)
returns table (
  id uuid, fact text, kind text, event_date date, temporal_hint text,
  importance int, confidence numeric, archived boolean, superseded_by uuid,
  created_at timestamptz, has_vector boolean
)
language sql stable
as $$
  select um.id, um.fact, um.kind, um.event_date, um.temporal_hint,
         um.importance, um.confidence, um.archived, um.superseded_by,
         um.created_at,
         (mv.id is not null) as has_vector
  from user_memories um
  left join memory_vectors mv
    on mv.ref_type = 'fact' and mv.ref_id = um.id
  where um.user_id = p_user_id
  order by um.created_at desc
  limit p_limit offset p_offset;
$$;
