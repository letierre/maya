import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");       // YYYY-MM
  const from = req.nextUrl.searchParams.get("from");         // YYYY-MM-DD (inclusive)
  const to = req.nextUrl.searchParams.get("to");             // YYYY-MM-DD (inclusive)
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);

  let query = supabase
    .from("financial_transactions")
    .select("*")
    .eq("user_id", session.user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500))
    .range(offset, offset + Math.min(limit, 500) - 1);

  if (from || to) {
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
  } else if (month) {
    // Calculate correct last day of the month
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // e.g. Feb → 28/29, Apr → 30
    query = query
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${String(lastDay).padStart(2, "0")}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { type, amount, category, subcategory, description, date } = body;

  if (!type || !amount || !category || !date) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      user_id: session.user.id,
      type,
      amount: Number(amount),
      category,
      subcategory: subcategory || null,
      description: description || null,
      date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
