-- Uso de IA por chamada (tokens + modelo) para custo EXATO, substituindo a
-- estimativa por constantes. Escrita via logAiUsage (service role).
-- RLS habilitado SEM policy (só service role lê/grava) — mesmo padrão de
-- `subscriptions` / `app_events`.
CREATE TABLE IF NOT EXISTS ai_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  feature       TEXT NOT NULL,
  model         TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_feature_created_idx ON ai_usage (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON ai_usage (user_id, created_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
