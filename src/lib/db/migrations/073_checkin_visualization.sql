-- Novo hábito "Visualização" no check-in diário (prática guiada de meta).
-- Fonte de verdade = practice_sessions (kind = 'visualization'), igual meditação/respiração.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS visualization BOOLEAN NOT NULL DEFAULT FALSE;
