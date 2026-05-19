-- ── Goals (Metas) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  why_it_matters       TEXT NOT NULL DEFAULT '',
  type                 TEXT NOT NULL CHECK (type IN ('destino', 'direcao')),
  area                 TEXT NOT NULL CHECK (area IN (
                         'saude', 'carreira', 'financas', 'relacionamentos',
                         'desenvolvimento', 'familia', 'lazer', 'espiritualidade'
                       )),
  status               TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida', 'arquivada')),
  target_date          DATE,
  guardian_name        TEXT,
  guardian_contact     TEXT,
  reward               TEXT,
  punishment           TEXT,
  reward_claimed       BOOLEAN NOT NULL DEFAULT FALSE,
  punishment_applied   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Goal Stages (Etapas) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluida')),
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Goal Actions (Ações dentro de cada etapa) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_actions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id   UUID NOT NULL REFERENCES goal_stages(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  if_then    TEXT,
  status     TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
  due_date   DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Weekly Plans (Planejamento Semanal) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  week_start      DATE NOT NULL,               -- sempre segunda-feira
  main_focus      TEXT NOT NULL DEFAULT '',    -- "pedra principal" da semana
  linked_goal_id  UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- ── Weekly Focus Goals (Metas em foco na semana) ──────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_focus_goals (
  weekly_plan_id  UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  PRIMARY KEY (weekly_plan_id, goal_id)
);

-- ── Weekly Reviews (Revisão Semanal) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id  UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  biggest_win     TEXT NOT NULL DEFAULT '',
  blocked_lesson  TEXT NOT NULL DEFAULT '',
  main_learning   TEXT NOT NULL DEFAULT '',
  week_score      SMALLINT NOT NULL DEFAULT 3 CHECK (week_score BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (weekly_plan_id)
);

-- ── Goal AI Events (Rastreamento de alertas da IA) ───────────────────────────
CREATE TABLE IF NOT EXISTS goal_ai_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  goal_id      UUID REFERENCES goals(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
                 'drift_alert', 'deadline', 'milestone', 'weekly_nudge', 'monthly_review'
               )),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at      TIMESTAMPTZ
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_user        ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_stages_goal  ON goal_stages(goal_id, position);
CREATE INDEX IF NOT EXISTS idx_goal_actions_stage ON goal_actions(stage_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_goal_ai_events_user ON goal_ai_events(user_id, triggered_at DESC);
