-- Módulo de corrida: tipo de atividade ("run" | "walk") para o check-in do dia
ALTER TABLE running_sessions ADD COLUMN IF NOT EXISTS activity_type TEXT;
