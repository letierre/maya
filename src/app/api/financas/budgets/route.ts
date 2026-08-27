import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Garante que a coluna `subcategory` exista (migration 043). Roda de forma
// idempotente — se a coluna/index já existirem, os comandos viram no-op.
let schemaEnsured = false;
async function ensureSubcategorySchema() {
  if (schemaEnsured) return;
  schemaEnsured = true;
  try {
    await db.execute(sql`
      ALTER TABLE financial_budgets ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';

      DO $$
      DECLARE cname text;
      BEGIN
        FOR cname IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'financial_budgets'::regclass AND contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE financial_budgets DROP CONSTRAINT %I', cname);
        END LOOP;
      END $$;

      DROP INDEX IF EXISTS financial_budgets_user_id_category_month_key;

      CREATE UNIQUE INDEX IF NOT EXISTS financial_budgets_user_id_category_month_subcategory_key
        ON financial_budgets (user_id, category, month, subcategory);
    `);
  } catch (e) {
    console.error("[financas/budgets] falha ao garantir schema:", e);
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from("financial_budgets")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("month", month);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { category, monthly_limit, month, subcategory } = body;

  if (!category || monthly_limit === undefined || monthly_limit === null || !month) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  await ensureSubcategorySchema();

  const { data, error } = await supabase
    .from("financial_budgets")
    .upsert({
      user_id: session.user.id,
      category,
      subcategory: subcategory || "",
      monthly_limit: Number(monthly_limit),
      month,
    }, { onConflict: "user_id,category,month,subcategory" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { category, month, subcategory } = await req.json();

  let query = supabase
    .from("financial_budgets")
    .delete()
    .eq("user_id", session.user.id)
    .eq("category", category)
    .eq("month", month);

  // Sem subcategoria → apaga TODOS os orçamentos da categoria (categoria + subcategorias).
  if (subcategory !== undefined && subcategory !== null) {
    query = query.eq("subcategory", subcategory || "");
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
