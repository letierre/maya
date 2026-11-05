import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: cycles, error } = await admin
    .from("quarterly_cycles")
    .select(`*, key_results(*), quarterly_reviews(*)`)
    .eq("user_id", user.id)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false })
    .order("position", { foreignTable: "key_results", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map: nest review (1:1) instead of array
  const mapped = (cycles ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    review: Array.isArray(c.quarterly_reviews) && (c.quarterly_reviews as any[]).length > 0
      ? (c.quarterly_reviews as any[])[0] : null,
    quarterly_reviews: undefined,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { label, year, quarter, start_date, end_date, theme } = body;

  if (!year || !quarter || !start_date || !end_date) {
    return NextResponse.json({ error: "Campos obrigatórios: year, quarter, start_date, end_date" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const cycleLabel = label || `${year}-Q${quarter}`;

  // Complete any currently active cycle before creating a new one
  await admin
    .from("quarterly_cycles")
    .update({ status: "completed" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: cycle, error } = await admin
    .from("quarterly_cycles")
    .insert({
      user_id: user.id,
      label: cycleLabel,
      year,
      quarter,
      start_date,
      end_date,
      theme: theme || null,
    })
    .select()
    .single();

  if (error || !cycle) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(cycle, { status: 201 });
}
