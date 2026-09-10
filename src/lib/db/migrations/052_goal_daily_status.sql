-- ── Goal Daily Status — reflexão diária por meta (avançou/parcial/nao) ───────
-- Uma linha por meta por dia. Guarda a reflexão manual do usuário no check-in
-- ("a meta andou hoje?"). O estado "avançou travado" (derivado de uma atividade
-- concluída ligada à meta) é calculado em tempo real pela API, não armazenado aqui.
CREATE TABLE IF NOT EXISTS goal_daily_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao',   -- 'avançou' | 'parcial' | 'nao'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, goal_id, date)
);

CREATE INDEX IF NOT EXISTS idx_goal_daily_status_user_date ON goal_daily_status(user_id, date);
