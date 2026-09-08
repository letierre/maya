-- 049_meal_benefits.sql
-- Adiciona a coluna `beneficios` (array de frases curtas) às refeições analisadas.
-- Aplicar via SQL Editor do Supabase (ver memória "Ambiente dev").
ALTER TABLE meals ADD COLUMN IF NOT EXISTS beneficios jsonb;
