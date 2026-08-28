import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Guard: não permite remover subcategoria que já tem transações/orçamentos.
  if (Array.isArray(body.subcats)) {
    const { data: existing } = await admin
      .from("user_categories")
      .select("subcats")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    const oldSubs: string[] = existing?.subcats ?? [];
    const newSubs: string[] = body.subcats;
    const removed = oldSubs.filter((s) => !newSubs.includes(s));

    if (removed.length > 0) {
      const legacyId = `user_${id}`;
      const [{ count: txCount }, { count: budgetCount }] = await Promise.all([
        admin
          .from("financial_transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("category", legacyId)
          .in("subcategory", removed),
        admin
          .from("financial_budgets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("category", legacyId)
          .in("subcategory", removed),
      ]);

      if ((txCount ?? 0) > 0 || (budgetCount ?? 0) > 0) {
        return NextResponse.json(
          {
            error: "has_records",
            message: "Uma das subcategorias removidas tem registros. Você pode ocultá-la em vez de removê-la.",
          },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await admin
    .from("user_categories")
    .update(body)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  // Find the category to get its type (for determining the ID prefix used in transactions)
  const { data: cat } = await admin
    .from("user_categories")
    .select("id, type")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (!cat) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
  }

  const legacyId = `user_${cat.id}`;

  // Guard: não permite excluir categoria que já tem registros (transações ou
  // orçamentos). O usuário pode apenas ocultá-la, para não deixar valores "no ar".
  const [{ count: txCount }, { count: budgetCount }] = await Promise.all([
    admin
      .from("financial_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("category", legacyId),
    admin
      .from("financial_budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("category", legacyId),
  ]);

  if ((txCount ?? 0) > 0 || (budgetCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "has_records",
        message: "Esta categoria tem registros. Você pode ocultá-la em vez de excluir.",
        txCount: txCount ?? 0,
        budgetCount: budgetCount ?? 0,
      },
      { status: 409 },
    );
  }

  // Delete the category
  const { error } = await admin
    .from("user_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
