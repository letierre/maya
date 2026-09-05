import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Garante que a tabela `recurring_budgets` exista (migration 046). Idempotente —
// se a tabela/index já existirem, os comandos viram no-op.
let ensured = false;
export async function ensureRecurringSchema() {
  if (ensured) return;
  ensured = true;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recurring_budgets (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL,
        category      TEXT NOT NULL,
        subcategory   TEXT NOT NULL DEFAULT '',
        monthly_limit NUMERIC NOT NULL,
        start_month   TEXT NOT NULL,
        end_month     TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      DROP INDEX IF EXISTS recurring_budgets_user_category_subcategory_key;

      CREATE UNIQUE INDEX IF NOT EXISTS recurring_budgets_user_category_subcategory_start_key
        ON recurring_budgets (user_id, category, subcategory, start_month);

      ALTER TABLE recurring_budgets ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users manage own recurring budgets" ON recurring_budgets;
      CREATE POLICY "Users manage own recurring budgets"
        ON recurring_budgets
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    `);
  } catch (e) {
    console.error("[financas/budgets] falha ao garantir schema de recorrentes:", e);
  }
}
