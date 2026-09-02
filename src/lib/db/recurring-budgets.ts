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
      CREATE UNIQUE INDEX IF NOT EXISTS recurring_budgets_user_category_subcategory_key
        ON recurring_budgets (user_id, category, subcategory);
    `);
  } catch (e) {
    console.error("[financas/budgets] falha ao garantir schema de recorrentes:", e);
  }
}
