-- 047 — Orçamentos recorrentes: segmentos (valor pode mudar ao longo da série)
-- Permite vários segmentos por (categoria, subcategoria), cada um com seu próprio
-- [start_month, end_month] e monthly_limit. Um segmento = um trecho da série
-- com um valor fixo; a mudança de valor "daqui pra frente" cria um novo segmento.

DROP INDEX IF EXISTS recurring_budgets_user_category_subcategory_key;

CREATE UNIQUE INDEX IF NOT EXISTS recurring_budgets_user_category_subcategory_start_key
  ON recurring_budgets (user_id, category, subcategory, start_month);
