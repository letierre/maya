-- Vincula itens da agenda (compromissos e tarefas) à Roda da Vida.
-- A coluna area permite que itens criados diretamente na agenda contem
-- como atividades planejadas por área, assim como o planejador semanal.
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS area TEXT;
