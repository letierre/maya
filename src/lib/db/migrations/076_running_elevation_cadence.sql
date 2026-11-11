-- Módulo de corrida: ganho de elevação (GPS) e cadência (passos por minuto)
ALTER TABLE running_sessions ADD COLUMN IF NOT EXISTS elevation_gain_m REAL;
ALTER TABLE running_sessions ADD COLUMN IF NOT EXISTS steps INTEGER;
ALTER TABLE running_sessions ADD COLUMN IF NOT EXISTS avg_cadence INTEGER; -- passos por minuto
