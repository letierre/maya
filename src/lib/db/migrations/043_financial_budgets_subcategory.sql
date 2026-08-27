-- 043 — Orçamento por subcategoria
-- Permite definir limites por subcategoria (não só por categoria).
-- A chave única muda de (user_id, category, month) para
-- (user_id, category, month, subcategory), com subcategory = '' para orçamento da categoria toda.

ALTER TABLE financial_budgets
  ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';

-- Remove a unique antiga (que impedia sub-orçamentos na mesma categoria/mês).
-- Descobre o nome real da constraint em vez de assumir o padrão.
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'financial_budgets'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE financial_budgets DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- Caso a unique antiga seja um índice (não constraint), derruba pelo nome padrão.
DROP INDEX IF EXISTS financial_budgets_user_id_category_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS financial_budgets_user_id_category_month_subcategory_key
  ON financial_budgets (user_id, category, month, subcategory);
