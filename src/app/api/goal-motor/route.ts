import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET /api/goal-motor — hábitos recorrentes (itens da agenda com repetição)
// ligados às metas ativas. É o "motor" que conecta a meta à rotina.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: goals } = await admin
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["ativa", "pausada"]);
  const goalIds = (goals ?? []).map((g) => g.id);
  if (goalIds.length === 0) return NextResponse.json({ motors: [] });

  const { data: agenda } = await admin
    .from("agenda_items")
    .select("title, repeat_type, linked_goal_id")
    .eq("user_id", user.id)
    .neq("repeat_type", "none")
    .not("repeat_type", "is", null)
    .in("linked_goal_id", goalIds);

  const motors = (agenda ?? []).map((a) => ({
    goal_id: a.linked_goal_id,
    title: a.title,
    repeat_type: a.repeat_type,
  }));

  return NextResponse.json({ motors });
}
