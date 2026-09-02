-- 046 — Orçamentos recorrentes
-- Templates de recorrência: um orçamento pode se repetir por N meses ou "sempre".
-- Na leitura de um mês, os templates ativos são materializados; a linha explícita
-- de financial_budgets (se houver) vence.

CREATE TABLE IF NOT EXISTS recurring_budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  category      TEXT NOT NULL,
  subcategory   TEXT NOT NULL DEFAULT '',  -- '' = orçamento da categoria toda
  monthly_limit NUMERIC NOT NULL,
  start_month   TEXT NOT NULL,             -- YYYY-MM, primeiro mês da série
  end_month     TEXT,                      -- YYYY-MM (inclusivo); NULL = "sempre"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_budgets_user_category_subcategory_key
  ON recurring_budgets (user_id, category, subcategory);
