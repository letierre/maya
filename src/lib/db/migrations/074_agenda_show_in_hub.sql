-- Flag "mostrar no hub": controla se o item aparece no resumo da semana (hub Lista).
-- Útil para rotinas recorrentes (dormir, banho, almoçar) que entupiam a lista.
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS show_in_hub BOOLEAN NOT NULL DEFAULT true;
