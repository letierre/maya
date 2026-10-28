-- ── Sessões de Pausa (Meditação & Respiração Consciente) ─────────────────
-- Registra cada sessão concluída. A marcação no check-in do dia é derivada
-- desta tabela (fonte de verdade), igual a running_sessions/reading_sessions.

CREATE TABLE IF NOT EXISTS practice_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  kind             TEXT NOT NULL,           -- 'meditation' | 'breathing'
  pattern          TEXT,                    -- ex.: 'breath'|'body'|'kindness'|'gratitude' (meditação) ou 'calm'|'box'|'478' (respiração)
  date             TEXT NOT NULL,           -- YYYY-MM-DD (data local do usuário)
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_date ON practice_sessions(user_id, date);
