-- Módulo de corpo: histórico de medidas para evolução do usuário.
-- Cada lançamento (peso, medidas, gordura, atividade, objetivo) vira uma linha
-- datada; a tela /corpo registra/edita e mostra a evolução ao longo do tempo.
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight_kg REAL,
  height_cm REAL,
  body_fat_pct REAL,
  neck_cm REAL,
  chest_cm REAL,
  waist_cm REAL,
  hip_cm REAL,
  arm_cm REAL,
  thigh_cm REAL,
  calf_cm REAL,
  activity_level TEXT,
  goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx
  ON body_measurements (user_id, recorded_at DESC);

-- RLS: o usuário autenticado lê os próprios lançamentos. Writes seguem via
-- service role nas rotas de API (mesmo padrão de subscriptions/running).
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own body measurements" ON body_measurements;
CREATE POLICY "Users read own body measurements"
  ON body_measurements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
