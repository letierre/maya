import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: cycle, error } = await admin
    .from("quarterly_cycles")
    .select(`*, key_results(*), quarterly_reviews(*)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .order("position", { foreignTable: "key_results", ascending: true })
    .single();

  if (error || !cycle) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const mapped = {
    ...cycle,
    review: Array.isArray(cycle.quarterly_reviews) && (cycle.quarterly_reviews as any[]).length > 0
      ? (cycle.quarterly_reviews as any[])[0] : null,
    quarterly_reviews: undefined,
  };

  return NextResponse.json(mapped);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const body = await req.json();

  // Verify ownership
  const { data: existing } = await admin
    .from("quarterly_cycles")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const { data: cycle, error } = await admin
    .from("quarterly_cycles")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !cycle) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(cycle);
}
