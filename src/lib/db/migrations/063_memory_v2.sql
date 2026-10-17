-- Migration 063: Memória da Maya v2 — fatos estruturados + vetores + resumos
-- ---------------------------------------------------------------------------
-- ADITIVA e NÃO-DESTRUTIVA. Idempotente (pode rodar de novo sem erro).
-- Rodar no SQL Editor do Supabase (conexão direta ao Postgres falha no dev).
--
-- O que faz:
--   1) Habilita pgvector (extensão `vector`).
--   2) Adiciona colunas novas em `user_memories` (com defaults seguros — nada
--      é apagado; fatos existentes viram kind='event', importance=2).
--   3) Cria `memory_vectors` (uma busca cobre fatos + resumos + episódios).
--   4) Cria `memory_summaries` (camada compilada L3, estilo Claude Code).
--   5) Liga RLS nas 3 tabelas (defesa em profundidade; o service_role ignora).
--
-- Próximo passo (app, não SQL): backfill de kind/importance com 1 passada LLM.

-- 1) Vetores -----------------------------------------------------------------
create extension if not exists vector;

-- 2) Colunas novas em user_memories ------------------------------------------
alter table user_memories
  add column if not exists kind            text not null default 'event',
  add column if not exists event_date      date,
  add column if not exists temporal_hint   text,
  add column if not exists source          text not null default 'chat',
  add column if not exists importance      integer not null default 2,
  add column if not exists confidence      numeric(3,2) not null default 0.8,
  add column if not exists cluster_label   text,
  add column if not exists archived        boolean not null default false,
  add column if not exists superseded_by   uuid,
  add column if not exists last_accessed_at timestamptz;

-- 3) Vetores (unificada: fact | summary | episode) ---------------------------
create table if not exists memory_vectors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ref_type    text not null check (ref_type in ('fact', 'summary', 'episode')),
  ref_id      uuid not null,
  text        text not null,
  embedding   vector(1024) not null,
  created_at  timestamptz not null default now()
);
-- Índice p/ o filtro obrigatório por usuário (a busca vetorial SEMPRE filtra
-- user_id ANTES do ranking — nunca fazer similaridade cruzando usuários).
create index if not exists memory_vectors_user_ref
  on memory_vectors (user_id, ref_type, ref_id);

-- 4) Resumos compilados (L3) -------------------------------------------------
create table if not exists memory_summaries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  granularity        text not null check (granularity in ('daily', 'weekly', 'monthly')),
  summary            text not null default '',
  source_memory_ids  uuid[] not null default '{}',
  stale              boolean not null default false,
  regenerated_from   uuid,
  created_at         timestamptz not null default now()
);
create index if not exists memory_summaries_user_period
  on memory_summaries (user_id, period_end desc);

-- 5) RLS (o service_role do app ignora; protege acesso autenticado direto) ---
alter table user_memories    enable row level security;
alter table memory_vectors   enable row level security;
alter table memory_summaries enable row level security;

create policy "user read own memories"   on user_memories    for select using (auth.uid() = user_id);
create policy "user insert own memories" on user_memories    for insert with check (auth.uid() = user_id);
create policy "user update own memories" on user_memories    for update using (auth.uid() = user_id);

create policy "user read own vectors"    on memory_vectors   for select using (auth.uid() = user_id);
create policy "user insert own vectors"  on memory_vectors   for insert with check (auth.uid() = user_id);
create policy "user delete own vectors"  on memory_vectors   for delete using (auth.uid() = user_id);

create policy "user read own summaries"   on memory_summaries for select using (auth.uid() = user_id);
create policy "user insert own summaries" on memory_summaries for insert with check (auth.uid() = user_id);
