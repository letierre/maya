import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Verify cycle ownership
  const { data: cycle } = await admin
    .from("quarterly_cycles")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!cycle) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const body = await req.json();
  const { title, target, current, unit, area, linked_goal_id } = body;

  if (!title) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }

  // Get next position
  const { count } = await admin
    .from("key_results")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", id);

  const { data: kr, error } = await admin
    .from("key_results")
    .insert({
      cycle_id: id,
      user_id: user.id,
      title,
      target: target ?? 100,
      current: current ?? 0,
      unit: unit || "%",
      area: area || null,
      linked_goal_id: linked_goal_id || null,
      position: count ?? 0,
    })
    .select()
    .single();

  if (error || !kr) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(kr, { status: 201 });
}
