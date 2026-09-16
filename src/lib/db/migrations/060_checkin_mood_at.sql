-- Registra o horário em que o usuário definiu o humor no check-in diário,
-- para a Maya saber QUANDO aquele humor foi registrado (manhã, tarde, noite).
-- NULL quando o check-in não tem humor (nenhum chip de humor selecionado).
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS mood_at timestamptz;
