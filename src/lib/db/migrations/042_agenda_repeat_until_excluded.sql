-- Suporte a exclusão parcial de compromissos repetidos:
--  * repeat_until  → limita a série até uma data (excluir "deste em diante")
--  * excluded      → marca uma ocorrência isolada como excluída (excluir "apenas este")
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS repeat_until DATE;
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT false;
