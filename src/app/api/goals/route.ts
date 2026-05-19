import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: goals, error } = await admin
    .from("goals")
    .select(`*, goal_stages(*, goal_actions(*))`)
    .eq("user_id", session.user.id)
    .neq("status", "arquivada")
    .order("created_at", { ascending: true })
    .order("position", { foreignTable: "goal_stages", ascending: true })
    .order("created_at", { foreignTable: "goal_stages.goal_actions", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(goals ?? []);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { title, description, why_it_matters, type, area, target_date,
          guardian_name, guardian_contact, reward, punishment, first_stage } = body;

  if (!title || !why_it_matters || !type || !area) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Check active goal limit (max 5)
  const { count } = await admin
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("status", "ativa");

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: "Limite de 5 metas ativas atingido" }, { status: 400 });
  }

  const { data: goal, error } = await admin
    .from("goals")
    .insert({
      user_id: session.user.id,
      title, description, why_it_matters, type, area,
      target_date: target_date || null,
      guardian_name: guardian_name || null,
      guardian_contact: guardian_contact || null,
      reward: reward || null,
      punishment: punishment || null,
    })
    .select()
    .single();

  if (error || !goal) return NextResponse.json({ error: error?.message }, { status: 500 });

  // Create first stage if provided
  if (first_stage) {
    await admin.from("goal_stages").insert({
      goal_id: goal.id,
      title: first_stage,
      position: 0,
    });
  }

  return NextResponse.json(goal, { status: 201 });
}
