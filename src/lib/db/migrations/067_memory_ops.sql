-- Migration 067: log de operações de memória (Fase 5)
-- Trilha de auditoria do que a Maya GRAVOU/compilou por usuário — para inspeção
-- no painel admin. Não-destrutiva: só cria tabela + índice.
--
-- `op`: write (fato novo) | merge (fundiu) | supersede (substituiu) |
--       duplicate (descartou) | compile (resumo L3) | backfill (embutiu antigo).

create table if not exists memory_ops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  op          text not null check (op in ('write','merge','supersede','duplicate','compile','backfill')),
  ref_type    text,
  ref_id      uuid,
  detail      text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists memory_ops_user_time
  on memory_ops (user_id, created_at desc);
create index if not exists memory_ops_time
  on memory_ops (created_at desc);

alter table memory_ops enable row level security;
-- Sem políticas públicas: só o service_role (rotas admin) lê/escreve.
