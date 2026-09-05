import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addMonths } from "@/lib/financas-budget";

// Agregado de receitas/despesas por mês para o gráfico de tendência.
// Retorna 6 meses (o mês âncora + 5 anteriores), ordem crescente.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const anchor = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  // Intervalo [anchor-5, anchor+1) — limite superior exclusivo evita calcular o
  // último dia do mês (sem comparação de data crua).
  const start = `${addMonths(anchor, -5)}-01`;
  const endExclusive = `${addMonths(anchor, 1)}-01`;

  const { data, error } = await supabase
    .from("financial_transactions")
    .select("date, type, amount")
    .eq("user_id", session.user.id)
    .gte("date", start)
    .lt("date", endExclusive);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Map<string, { receitas: number; despesas: number }>();
  for (let i = 5; i >= 0; i--) {
    totals.set(addMonths(anchor, -i), { receitas: 0, despesas: 0 });
  }

  for (const t of (data ?? [])) {
    const ym = (t.date as string).slice(0, 7);
    const bucket = totals.get(ym);
    if (!bucket) continue;
    const amount = Number(t.amount) || 0;
    if (t.type === "receita") bucket.receitas += amount;
    else bucket.despesas += amount;
  }

  const months = Array.from(totals.entries()).map(([month, v]) => ({ month, ...v }));
  return NextResponse.json({ months });
}
