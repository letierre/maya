import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ensureRecurringSchema } from "@/lib/db/recurring-budgets";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await ensureRecurringSchema();

  const { data, error } = await supabase
    .from("recurring_budgets")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { category, subcategory, monthly_limit, start_month, end_month } = body;

  if (!category || monthly_limit === undefined || monthly_limit === null || !start_month) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  await ensureRecurringSchema();

  const { data, error } = await supabase
    .from("recurring_budgets")
    .upsert({
      user_id: session.user.id,
      category,
      subcategory: subcategory || "",
      monthly_limit: Number(monthly_limit),
      start_month,
      end_month: end_month || null,
    }, { onConflict: "user_id,category,subcategory,start_month" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { category, subcategory } = await req.json();
  if (!category) return NextResponse.json({ error: "Categoria obrigatória" }, { status: 400 });

  await ensureRecurringSchema();

  let query = supabase
    .from("recurring_budgets")
    .delete()
    .eq("user_id", session.user.id)
    .eq("category", category);

  if (subcategory !== undefined && subcategory !== null) {
    query = query.eq("subcategory", subcategory || "");
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
