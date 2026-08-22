-- Adiciona o hábito de leitura ao check-in diário.
-- Preenchido automaticamente ao registrar uma sessão de leitura (igual à corrida).
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;
