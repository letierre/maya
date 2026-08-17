-- ── day_of_week nullable: tarefas "Em aberto" ─────────────────────────────────
-- A migration 009 criou day_of_week como NOT NULL, mas o app sempre representou
-- tarefas "Em aberto" (sem dia definido) com day_of_week = NULL. Alinha o schema
-- com a realidade do código. O CHECK (day_of_week BETWEEN 0 AND 6) continua
-- valendo para valores não-nulos; NULL passa no CHECK (Postgres só falha em FALSE).
ALTER TABLE weekly_tasks ALTER COLUMN day_of_week DROP NOT NULL;
