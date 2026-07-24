-- ── Agenda Items (Compromissos & Tarefas) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  title             TEXT NOT NULL,
  item_type         TEXT NOT NULL DEFAULT 'tarefa'
                      CHECK (item_type IN ('compromisso', 'tarefa')),
  date              DATE NOT NULL,                            -- data específica
  start_time        TIME,                                     -- apenas compromissos
  end_time          TIME,                                     -- apenas compromissos
  priority          TEXT NOT NULL DEFAULT 'importante_nao_urgente'
                      CHECK (priority IN (
                        'importante_urgente',
                        'importante_nao_urgente',
                        'nao_importante_urgente',
                        'nao_importante_nao_urgente'
                      )),
  emoji             TEXT,                                     -- ícone visual
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'concluida')),
  linked_goal_id    UUID REFERENCES goals(id) ON DELETE SET NULL,
  linked_action_id  UUID REFERENCES goal_actions(id) ON DELETE SET NULL,
  linked_weekly_task_id UUID REFERENCES weekly_tasks(id) ON DELETE SET NULL,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agenda_items_user_date_idx ON agenda_items(user_id, date);
CREATE INDEX IF NOT EXISTS agenda_items_goal_idx ON agenda_items(linked_goal_id);
CREATE INDEX IF NOT EXISTS agenda_items_task_idx ON agenda_items(linked_weekly_task_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_agenda_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agenda_items_updated_at ON agenda_items;
CREATE TRIGGER agenda_items_updated_at
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION update_agenda_items_updated_at();
