-- Rastreamento de abertura de tela (pageview) por módulo — mede a frequência
-- de uso real (abertura), além da atividade (registros criados).
-- Escrita via POST /api/track (service role). RLS habilitado SEM policy
-- (mesmo padrão de `subscriptions` / `email_verification_codes`): só service role lê/grava.
CREATE TABLE IF NOT EXISTS app_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  event_name  TEXT NOT NULL,
  module      TEXT,
  path        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_events_module_created_idx ON app_events (module, created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_user_created_idx ON app_events (user_id, created_at DESC);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
